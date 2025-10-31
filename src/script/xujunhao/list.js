/**
 * API Ready 函数 - 应用主程序入口
 * 初始化应用所有组件和事件监听器，管理学习笔记列表的显示和交互
 * 包含音频播放、手势识别、数据同步等核心功能
 */
apiready = function () {
  // 常量定义
  const DOUBLE_CLICK_THRESHOLD = 300; // 双击判定时间间隔(ms)
  const DOUBLE_CLICK_DELAY_THRESHOLD = 500; // 列表项双击检测间隔(ms)
  const DEBOUNCE_DELAY = 1000; // 防抖延迟时间(ms)
  const VOICE_COMMENT_GAIN = 6.0; // 语音评论增益倍数
  const NORMAL_AUDIO_GAIN = 1.0; // 普通音频增益倍数
  const GROUP_SIZE = 12; // 每组音频数量
  const PAGE_SIZE = 50; // 每页笔记数量
  const REPEAT_COUNT = 3; // 音频重复次数
  const AUDIO_PART_COUNT = 3; // 每组音频段数
  const ANIMATION_DELAY = 500; // 动画延迟时间(ms)

  // CSS选择器常量
  const SELECTORS = {
    CONTAINER: "div.container",
    AUDIO_PLAYER: "#audioPlayer",
    AUDIO_TEXT_DISPLAY: "#audioTextDisplay",
    NORMAL_PLAY_NUMBER: ".normal-play-number",
    NOTE_COMMENT: ".note-comment",
    UNLIMITED_PLAY_NUMBER: ".unlimited-play-number",
    HANDLE_LEFT: ".handle-double-click-left",
    HANDLE_RIGHT: ".handle-double-click-right",
    PLAY_AUDIO_LIST: ".play-audio-list",
    PROGRESS_BAR: "#progressBar",
    PROGRESS_TEXT: "#progressText",
    PLAYING_ITEM: "span.playing-item",
    CLICKED_ITEMS: "div.container span.clicked, div.container span.forgeted",
    ALL_SPANS: "div.container span:not(.more-button)",
  };

  let voiceCommentList = [];
  const sync = createSyncLogic();
  setTimeout(() => {
    api.closeWin({
      name: "category",
    });
    api.closeWin({
      name: "studyInfo",
    });
    api.closeWin({
      name: "card",
    });
    api.closeWin({
      name: "category-search",
    });
  }, 1000);
  /**
   * 播放背景音乐
   * 重置背景音乐播放位置并根据配置调整音量
   * 然后开始播放背景音乐
   * @returns {void}
   */
  function playBgm() {
    listBgm.currentTime = 0;
    const listBgmVolume = getVolumeByPath(listBgm.src);
    listBgm.volume = listBgmVolume;
    listBgm.play().catch(() => {});
  }

  // 全局状态变量
  let currentToast = null;
  let noteCnMap = {};
  let isNoticeVoicePlaying = false;
  let audioUnlimitedPlayNumber = 0;
  let unlimited = false;
  const audioPlayer = getElement(SELECTORS.AUDIO_PLAYER);

  // 音频上下文变量
  let audioCtx = null;
  let sourceNode = null;
  let gainNode = null;

  /**
   * 初始化音频增益通道
   * 创建AudioContext和增益节点，建立音频处理管道
   * 用于控制不同类型音频的音量增益（如语音评论的6倍增益）
   * @returns {void}
   */
  function initGainChannel() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!sourceNode) {
      sourceNode = audioCtx.createMediaElementSource(audioPlayer);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;
      sourceNode.connect(gainNode).connect(audioCtx.destination);
    }
  }
  initGainChannel();
  const _origPlay = audioPlayer.play.bind(audioPlayer);
  /**
   * 重写音频播放器的play方法
   * 自动处理AudioContext解锁和音量增益控制
   * 语音评论自动应用6倍增益，普通音频保持原音量
   * @returns {Promise} 返回原始play方法的Promise
   */
  audioPlayer.play = function () {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    gainNode.gain.value = voiceCommentList.includes(audioPlayer.src) ? VOICE_COMMENT_GAIN : NORMAL_AUDIO_GAIN;
    return _origPlay();
  };

  // 音频播放状态变量
  let audioPlayIndex = { value: 0 };
  let audioList = [];
  let audioListDiv = null;
  let audioSpeed = 1;

  // UI和数据状态变量
  let messageIsShow = false;
  let noteListOnShow = [];
  let clickedNoteIdArr = [];
  let playListIsPlaying = false;
  localStorage.setItem("playListIsPlaying", playListIsPlaying);

  // 手势状态标志
  let isShaking = false;
  let isLongPressing = false;

  /**
   * 获取DOM元素的辅助函数
   * @param {string} selector - CSS选择器
   * @returns {HTMLElement|null} DOM元素
   */
  const getElement = (selector) => document.querySelector(selector);

  /**
   * 获取所有匹配的DOM元素
   * @param {string} selector - CSS选择器
   * @returns {NodeList} DOM元素列表
   */
  const getElements = (selector) => document.querySelectorAll(selector);

  /**
   * 初始化应用程序
   * 执行基础设置、检查删除记录和添加事件监听器
   * 确保应用在前台时正确响应用户交互
   */
  listInit();
  checkLastDeleteNote();
  api.addEventListener(
    {
      name: "swipeleft",
    },
    function (ret, err) {
      shakeThePhone();
      if (isShaking || isLongPressing || playListIsPlaying) {
        return false;
      }
      prepareToGotoCardPage("left");
    }
  );
  api.addEventListener(
    {
      name: "swiperight",
    },
    function (ret, err) {
      shakeThePhone();
      if (isShaking || isLongPressing || playListIsPlaying) {
        return false;
      }
      prepareToGotoCardPage("right");
    }
  );
  api.addEventListener(
    {
      name: "keyback",
    },
    function (ret, err) {
      keyback();
    }
  );
  api.addEventListener(
    {
      name: "resume",
    },
    function (ret, err) {
      getStartTimeStamp();
      appToFront("list resume");
      checkNeedSyncByUpdateTimeStamp();
      if (!playListIsPlaying) {
        listInit();
      }
    }
  );
  api.addEventListener(
    {
      name: "pause",
    },
    function (ret, err) {
      appToBack();
    }
  );
  /**
   * 添加摇晃事件监听器
   * 处理设备摇晃手势，触发音频播放列表或笔记操作
   * @returns {void}
   */
  function addListShakeEventListener() {
    removeListShakeEventListener();
    api.addEventListener(
      {
        name: "shake",
      },
      function (ret, err) {
        if (localStorage.getItem("appState") === "back") {
          return;
        }
        if (Swal.isVisible()) {
          return;
        }
        if (isShaking || isLongPressing) {
          return false;
        }
        isShaking = true;
        setTimeout(() => {
          isShaking = false;
        }, DEBOUNCE_DELAY);
        if (localStorage.getItem("appState") === "front") {
          if (playListIsPlaying) {
            return;
          } else {
            const checkedNoteList = document.querySelectorAll(
              "div.container span.clicked, div.container span.forgeted"
            );
            if (checkedNoteList.length !== 0) {
              multiHandleClickedNote();
            } else {
              playAudioList();
            }
          }
        }
      }
    );
  }
  addListShakeEventListener();
  /**
   * 添加长按事件监听器
   * 处理设备长按手势，触发笔记评论编辑或音频播放
   * @returns {void}
   */
  function addListLongpressEventListener() {
    removeListLongpressEventListener();
    api.addEventListener(
      {
        name: "longpress",
      },
      function (ret, err) {
        if (Swal.isVisible()) {
          return;
        }
        if (isShaking || isLongPressing) {
          return false;
        }
        isLongPressing = true;
        setTimeout(() => {
          isLongPressing = false;
        }, DEBOUNCE_DELAY);
        if (playListIsPlaying) {
          helpNoteComment();
          return;
        } else {
          const checkedNoteList = document.querySelectorAll("div.container span.clicked, div.container span.forgeted");
          if (checkedNoteList.length !== 0) {
            multiHandleClickedNote();
          } else {
            playAudioList();
          }
        }
      }
    );
  }
  addListLongpressEventListener();
  /**
   * 移除摇晃事件监听器
   * @returns {void}
   */
  function removeListShakeEventListener() {
    api.removeEventListener({
      name: "shake",
    });
  }

  /**
   * 移除长按事件监听器
   * @returns {void}
   */
  function removeListLongpressEventListener() {
    api.removeEventListener({
      name: "longpress",
    });
  }
  /**
   * 帮助笔记评论功能
   * 在音频播放时长按触发，允许用户添加或编辑当前笔记的文本评论
   * @returns {void}
   */
  function helpNoteComment() {
    if (isNoticeVoicePlaying) {
      return;
    }
    removeTranslate();
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    const currentPlayNoteId = audioPlayer.dataset.currentNoteId;
    const currentPlayNote = noteListOnShow.find((item) => item.id === currentPlayNoteId);
    const currentSide2 = currentPlayNote.side2;
    let commentText = extractComment(currentSide2);
    getElement(SELECTORS.NORMAL_PLAY_NUMBER).classList.remove("show");
    getElement(SELECTORS.NOTE_COMMENT).classList.remove("show");
    Swal.fire({
      title: "😎有文本笔记?",
      input: "textarea",
      inputValue: commentText,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "添加",
      cancelButtonText: "取消",
      reverseButtons: true,
      focusConfirm: false,
      customClass: {
        popup: "swal-custom-popup",
        confirmButton: "swal-button--confirm",
        cancelButton: "swal-button--cancel",
      },
    }).then((result) => {
      getElement(SELECTORS.NORMAL_PLAY_NUMBER).classList.add("show");
      getElement(SELECTORS.NOTE_COMMENT).classList.add("show");
      if (result.isConfirmed) {
        const newCommentText = result.value.trim();
        const updatedSide2 = updateSide2WithComment(currentSide2, newCommentText);
        currentPlayNote.side2 = updatedSide2;
        noteListOnShow = noteListOnShow.map((note) => {
          if (note.id === currentPlayNoteId) {
            return { ...note, side2: updatedSide2 };
          }
          return note;
        });
        updateCardSide2(currentPlayNoteId, updatedSide2);
        showMessage("修改文本笔记成功!", 1000, "donesuccess2", "success");
        const commentElement = getElement(SELECTORS.NOTE_COMMENT);
        if (newCommentText) {
          commentElement.textContent = "✎ " + newCommentText;
        } else {
          commentElement.textContent = "";
        }
      }
      audioPlayer.play().catch(() => {});
    });
  }
  /**
   * 格式化谐音助记文本
   * 将用户输入的助记内容格式化为标准格式（添加「」标记）
   * @param {string} newMnemonic - 用户输入的助记文本
   * @returns {string} 格式化后的助记文本
   */
  function formatMnemonic(newMnemonic) {
    newMnemonic = newMnemonic.replace("📣", "").trim();
    const items = newMnemonic
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    return items.map((item) => `「${item}」`).join(", ");
  }
  /**
   * 更新笔记的Side2内容中的评论部分
   * @param {string} side2 - 原始Side2内容
   * @param {string} newComment - 新的评论内容
   * @returns {string} 更新后的Side2内容
   */
  function updateSide2WithComment(side2, newComment) {
    if (newComment === "") {
      return side2
        .split(/\n/)
        .filter((line) => !line.includes("✎"))
        .join("\n");
    }
    if (!/[。？！；：、.,?!;:]/.test(newComment.slice(-1))) {
      newComment += "。";
    }
    const commentLine = "✎ " + newComment;
    const lines = side2.trim().split(/\n/);
    let commentFound = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("✎")) {
        lines[i] = commentLine;
        commentFound = true;
        break;
      }
    }
    if (!commentFound) {
      lines.push("\n");
      lines.push(commentLine);
    }
    return lines.join("\n");
  }
  /**
   * 更新当前笔记Side2中的谐音助记内容
   * @param {string} side2 - 原始Side2内容
   * @param {string} newMnemonic - 新的谐音助记内容
   * @returns {string} 更新后的Side2内容
   */
  function updateSide2WithMnemonic(side2, newMnemonic) {
    const formattedMnemonic = formatMnemonic(newMnemonic);
    let lines = side2.trim().split(/\n/);
    let newLines = lines.filter((line) => !line.includes("📣"));
    if (formattedMnemonic) {
      const mnemonicLine = "📣" + formattedMnemonic;
      newLines.push(mnemonicLine);
    }
    return newLines.join("\n");
  }
  /**
   * 从文本中提取评论内容
   * @param {string} text - 包含评论的文本
   * @returns {string} 提取出的评论内容，如果没有则返回空字符串
   */
  function extractComment(text) {
    const lines = text.split(/\n/);
    for (let line of lines) {
      if (line.includes("✎")) {
        return line.replace("✎", "").trim();
      }
    }
    return "";
  }
  /**
   * 从文本中提取记忆助记内容
   * @param {string} text - 包含助记的文本
   * @returns {string} 提取出的助记内容，如果没有则返回空字符串
   */
  function extractMemorize(text) {
    const sentences = text.split(/\n/);
    for (let sentence of sentences) {
      if (sentence.includes("📣")) {
        return sentence.replace(/[「」]/g, "").trim();
      }
    }
    return "";
  }
  let leftLastClickTime = 0;
  let rightLastClickTime = 0;
  /**
   * 左侧点击区域事件处理
   * 单击：播放/暂停当前音频
   * 双击：跳过当前音符（标记为未记住）
   */
  const handleLeft = document.querySelector(".handle-double-click-left");
  handleLeft.addEventListener("click", function () {
    if (isNoticeVoicePlaying) return;
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - leftLastClickTime;
    if (timeDifference < DOUBLE_CLICK_THRESHOLD) {
      const playAudioListElement = document.querySelector(".play-audio-list");
      playAudioListElement.classList.add("inner-shadow-red");
      setTimeout(() => {
        playAudioListElement.classList.remove("inner-shadow-red");
      }, 500);
      skipCurrentNote(false);
    } else {
      if (audioPlayer.paused) {
        if (unlimited) {
          playUnlimitedTrack();
        } else {
          audioPlayer.play().catch(() => {});
        }
      } else {
        removeTranslate();
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
    }
    leftLastClickTime = currentTime;
  });
  /**
   * 右侧点击区域事件处理
   * 单击：显示/隐藏中文翻译
   * 双击：跳过当前音符（标记为已记住）
   */
  const handleRight = document.querySelector(".handle-double-click-right");
  handleRight.addEventListener("click", function () {
    if (isNoticeVoicePlaying) return;
    const currentTime = Date.now();
    const timeDifference = currentTime - rightLastClickTime;
    if (timeDifference < DOUBLE_CLICK_THRESHOLD) {
      const playAudioListElement = document.querySelector(".play-audio-list");
      playAudioListElement.classList.add("inner-shadow-green");
      setTimeout(() => {
        playAudioListElement.classList.remove("inner-shadow-green");
      }, 500);
      shakeThePhone();
      skipCurrentNote(true);
    } else {
      let currentAudio = audioList[audioPlayIndex.value - 1];
      let audioTextDisplay = document.querySelector("#audioTextDisplay");
      let newContent;
      if (audioPlayer.paused) {
        newContent = `<h1>${currentAudio.text}</h1>`;
        adjustAudioTextSize(currentAudio.text);
        if (unlimited) playUnlimitedTrack();
        else audioPlayer.play().catch(() => {});
      } else {
        newContent = `<h1>${currentAudio.text}</h1><h1>『${currentAudio.cnText}』</h1>`;
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        adjustAudioTextSize(`<h1>${currentAudio.text}</h1><h1>『${currentAudio.cnText}』</h1>`);
      }
      audioTextDisplay.classList.remove("animate__animated", "animate__zoomIn");
      void audioTextDisplay.offsetWidth;
      audioTextDisplay.innerHTML = newContent;
      audioTextDisplay.classList.add("animate__animated", "animate__zoomIn");
    }
    rightLastClickTime = currentTime;
  });
  /**
   * 跳过当前音符并更新笔记等级
   * @param {boolean} isRemember - true表示记住(升级)，false表示忘记(降级)
   * @returns {void}
   */
  function skipCurrentNote(isRemember) {
    let nextSrc = "";
    removeTranslate();
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    let currIndex = audioPlayIndex.value - 1;
    if (currIndex < 0) currIndex = 0;
    let currentAudio = audioList[currIndex];
    if (currentAudio.id) {
      nextSrc = isRemember ? "./audio/done2.mp3" : "./audio/gap_590.mp3";
      let note = queryNoteById(currentAudio.id);
      const now = Math.floor(Date.now() / 1000);
      if (isRemember) {
        note.level = Number(note.level) + 1;
        note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(note.level);
      } else {
        note.level = Math.max(Number(note.level) - 1, 0);
        note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(0);
      }
      note.updateTimeStamp = now;
      updateNoteByData({
        id: note.id,
        level: note.level,
        remindTimeStamp: note.remindTimeStamp,
        isDelete: note.isDelete,
        updateTimeStamp: note.updateTimeStamp,
      });
      addCodeToAlignment(note.alignCode);
      const noteElement = document.querySelector(`span[data-id="${note.id}"]`);
      if (noteElement) {
        noteElement.remove();
      }
      noteListOnShow = noteListOnShow.filter((item) => item.id !== note.id);
    }
    if (unlimited) {
      audioUnlimitedPlayNumber = 0;
      document.querySelector(".unlimited-play-number").textContent = 0;
    }
    const totalGroups = Math.ceil(audioList.length / GROUP_SIZE);
    const currGroupIndex = Math.ceil((currIndex + 1) / GROUP_SIZE);
    const isLastAudio = currIndex >= audioList.length - 1;
    const isInLastGroup = currGroupIndex >= totalGroups;
    if (isLastAudio || isInLastGroup) {
      playPromptAudio("./audio/end.mp3", () => {
        playAudioList("stop");
      });
      return;
    }
    if (!nextSrc) {
      nextSrc = "./audio/gap_590.mp3";
    }
    playPromptAudio(nextSrc, () => {
      doSkipNext(currentAudio, currIndex);
    });
  }
  /**
   * 执行跳到下一个笔记的逻辑
   * @param {Object} currentAudio - 当前音频对象
   * @param {number} currIndex - 当前索引
   * @returns {void}
   */
  function doSkipNext(currentAudio, currIndex) {
    if (!currentAudio.noteIndex) {
      playNextTrack();
      return;
    }
    let nextNoteIndex = currentAudio.noteIndex + 1;
    let foundIndex = -1;
    for (let i = currIndex + 1; i < audioList.length; i++) {
      if (audioList[i].noteIndex === nextNoteIndex) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex === -1) {
      playPromptAudio("./audio/end.mp3", () => {
        playAudioList("stop");
      });
      return;
    }
    audioPlayIndex.value = foundIndex;
    playNextTrack();
  }
  /**
   * 重置音频播放器状态
   * @param {HTMLAudioElement} player - 音频播放器元素
   * @returns {void}
   */
  function resetAudioPlayer(player) {
    if (!player.paused) {
      removeTranslate();
      player.pause();
    }
    player.currentTime = 0;
    player.src = "";
  }
  /**
   * 创建音频播放列表的UI元素
   * @returns {HTMLElement} 创建的播放列表容器元素
   */
  function createAudioListElement() {
    let playAudioListDiv = document.createElement("div");
    playAudioListDiv.className = "play-audio-list";
    playAudioListDiv.style.opacity = "0";
    playAudioListDiv.style.transform =
      "scale(0.5) rotate(90deg) translateX(calc(50vh - 50vw)) translateY(calc(50vw - 50vh))";
    let audioTextDisplay = document.createElement("div");
    audioTextDisplay.id = "audioTextDisplay";
    audioTextDisplay.innerHTML = "";
    playAudioListDiv.appendChild(audioTextDisplay);
    let progressContainerDiv = document.createElement("div");
    progressContainerDiv.className = "progress-container";
    let progressBarDiv = document.createElement("div");
    progressBarDiv.className = "progress-bar";
    progressBarDiv.id = "progressBar";
    progressBarDiv.style.width = "0%";
    let progressTextSpan = document.createElement("span");
    progressTextSpan.className = "progress-text";
    progressTextSpan.id = "progressText";
    progressTextSpan.textContent = "0%";
    progressBarDiv.appendChild(progressTextSpan);
    progressContainerDiv.appendChild(progressBarDiv);
    playAudioListDiv.appendChild(progressContainerDiv);
    document.body.appendChild(playAudioListDiv);
    return playAudioListDiv;
  }
  /**
   * 显示/隐藏播放列表动画
   * @param {HTMLElement} elem - 要执行动画的元素
   * @param {boolean} show - true显示，false隐藏
   * @returns {void}
   */
  function animateElement(elem, show) {
    if (elem) {
      setTimeout(() => {
        if (show) {
          document.querySelector(".handle-double-click-left").style.display = "block";
          document.querySelector(".handle-double-click-right").style.display = "block";
          elem.style.opacity = "1";
          elem.style.transform = "scale(1) rotate(90deg) translateX(calc(50vh - 50vw)) translateY(calc(50vw - 50vh))";
        } else {
          document.querySelector(".handle-double-click-left").style.display = "none";
          document.querySelector(".handle-double-click-right").style.display = "none";
          document.querySelector(".normal-play-number").classList.remove("show");
          document.querySelector(".normal-play-number").textContent = "";
          document.querySelector(".note-comment").classList.remove("show");
          document.querySelector(".note-comment").textContent = "";
          elem.style.opacity = "0";
          setTimeout(function () {
            elem.remove();
            audioUnlimitedPlayNumber = 0;
            document.querySelector(".unlimited-play-number").textContent = 0;
            unlimited = false;
          }, 500);
        }
      }, 0);
    }
  }
  /**
   * 从笔记列表中提取音频源
   * @param {Array<Object>} notes - 笔记列表
   * @param {boolean} isUnlimitedMode - 是否为无限模式
   * @returns {Array<Object>} 音频源列表
   */
  function extractAudioSources(notes, isUnlimitedMode = false) {
    let sources = [];
    let parser = new DOMParser();
    let foundJapaneseText = false;
    let divSpanCard = document.querySelectorAll("div.container span:not(.more-button)");
    notes.forEach((note, index) => {
      const processAudioTag = (content) => {
        let doc = parser.parseFromString(marked.parse(content), "text/html");
        return doc.querySelector("audio") ? getPathByUrl(doc.querySelector("audio").src) : null;
      };
      const extractJapaneseText = (cardElement) => {
        let cardInnerHTML = cardElement.innerHTML;
        let text = cardInnerHTML.replace(/🖼️|🔊|🌐/g, "");
        if (text.includes("『") || text.includes("』")) {
          return text.trim();
        }
        const morphemeRegex = /((?:<span\s+class=["']morpheme["'][^>]*>[\s\S]*?<\/span>\s*)+)/;
        const morphemeMatch = note.side2.match(morphemeRegex);
        const isListenFullText = note.side1.includes("听力全文");
        if (morphemeMatch) {
          if (isListenFullText) {
            if (text.trim().startsWith("📚")) {
              return text.trim();
            } else {
              return "📚" + text.trim();
            }
          } else {
            return morphemeMatch[1].trim();
          }
        }
        const rubyRegex = /<ruby>[\s\S]*?<\/ruby>/g;
        if (text.match(rubyRegex)) {
          if (isListenFullText) {
            if (text.trim().startsWith("📚")) {
              return text.trim();
            } else {
              return "📚" + text.trim();
            }
          } else {
            return text.trim();
          }
        }
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        if (japaneseRegex.test(text)) {
          if (isListenFullText) {
            if (text.trim().startsWith("📚")) {
              return text.trim();
            } else {
              return "📚" + text.trim();
            }
          } else {
            return text.trim();
          }
        }
        return text.trim();
      };
      let audio1 = processAudioTag(note.side1);
      let audio2 = processAudioTag(note.side2) || "./audio/forget.mp3";
      let japaneseText = extractJapaneseText(divSpanCard[index]);
      let chineseText = divSpanCard[index].dataset.cn || "暂无中文...";
      let audioLevel = divSpanCard[index].dataset.level
        ? Number(divSpanCard[index].dataset.level.replace("level", ""))
        : 0;
      if (japaneseText) {
        foundJapaneseText = true;
      }
      if (audio1 && japaneseText && audio1.trim() !== "") {
        let audioObject = {
          text: japaneseText,
          src: audio1.trim(),
          id: note.id,
          cnText: chineseText,
          level: audioLevel,
        };
        if (isUnlimitedMode) {
          sources.push(audioObject);
        } else {
          for (let g = 1; g <= REPEAT_COUNT; g++) {
            for (let p = 1; p <= AUDIO_PART_COUNT; p++) {
              sources.push({
                text: japaneseText,
                cnText: chineseText,
                level: audioLevel,
                src: audio1.trim(),
                id: note.id,
                noteIndex: index + 1,
                groupIndex: g,
                partIndex: p,
              });
            }
            sources.push({
              text: japaneseText,
              cnText: chineseText,
              level: audioLevel,
              src: audio2.trim(),
              id: note.id,
              noteIndex: index + 1,
              groupIndex: g,
              partIndex: AUDIO_PART_COUNT + 1,
            });
          }
        }
      }
    });
    if (!foundJapaneseText) {
      return [];
    }
    return sources;
  }
  /**
   * 更新进度条显示
   * @param {number} currentSong - 当前播放的歌曲序号
   * @param {number} totalSongs - 总歌曲数量
   * @returns {void}
   */
  function updateProgressBar(currentSong, totalSongs) {
    const percentage = (currentSong / totalSongs) * 100;
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    progressBar.style.width = percentage + "%";
    progressText.textContent = percentage.toFixed(0) + "%";
  }
  /**
   * 播放下一首音频（公共函数）
   * 处理音频队列播放逻辑，包括进度更新和播放结束处理
   * @returns {void}
   */
  function playNextTrack() {
    if (audioPlayIndex.value < audioList.length) {
      let currentAudio = audioList[audioPlayIndex.value];
      updateProgressBar(audioPlayIndex.value, audioList.length);
      audioPlayer.src = currentAudio.src;
      audioPlayer.dataset.currentNoteId = currentAudio.id;
      audioPlayIndex.value++;
      let normalPlayNumberEl = document.querySelector(".normal-play-number");
      let noteCommentEl = document.querySelector(".note-comment");
      if (currentAudio.noteIndex) {
        let label = currentAudio.noteIndex + "-" + currentAudio.groupIndex + "-" + currentAudio.partIndex;
        normalPlayNumberEl.textContent = label;
        normalPlayNumberEl.classList.add("show");
        if (!noteCommentEl.textContent) {
          const currentPlayNoteId = audioPlayer.dataset.currentNoteId;
          const currentPlayNote = noteListOnShow.find((item) => item.id === currentPlayNoteId);
          const currentSide2 = currentPlayNote.side2;
          let commentText = extractComment(currentSide2);
          if (commentText && commentText.trim() !== "") {
            commentText = "✎ " + commentText;
            if (noteCommentEl.textContent !== commentText) {
              noteCommentEl.textContent = commentText;
            }
          }
        }
        noteCommentEl.classList.add("show");
      } else {
        normalPlayNumberEl.textContent = "";
        normalPlayNumberEl.classList.remove("show");
        noteCommentEl.textContent = "";
        noteCommentEl.classList.remove("show");
      }
      let audioTextDisplay = document.querySelector("#audioTextDisplay");
      if (audioTextDisplay.innerHTML !== `<h1>${currentAudio.text}</h1>`) {
        audioTextDisplay.classList.remove("animate__zoomIn");
        void audioTextDisplay.offsetWidth;
        audioTextDisplay.innerHTML = `<h1>${currentAudio.text}</h1>`;
        audioTextDisplay.classList.add("animate__animated", "animate__zoomIn");
        adjustAudioTextSize(currentAudio.text);
      }
      const playRate = Math.round((1 + Number(currentAudio.level) * 0.2) * 10) / 10;
      audioPlayer.playbackRate = playRate;
      audioPlayer.play().catch(() => {});
      audioPlayer.onended = () => {
        updateProgressBar(audioPlayIndex.value, audioList.length);
        if (audioPlayIndex.value < audioList.length) {
          let nextAudio = audioList[audioPlayIndex.value];
          if (currentAudio.noteIndex && nextAudio.noteIndex && nextAudio.noteIndex !== currentAudio.noteIndex) {
            skipCurrentNote(false);
          } else {
            playNextTrack();
          }
        } else {
          let currIndex = audioPlayIndex.value - 1;
          if (currIndex < 0) currIndex = 0;
          let currentAudio = audioList[currIndex];
          if (currentAudio.id) {
            let note = queryNoteById(currentAudio.id);
            note.level = Math.max(Number(note.level) - 1, 0);
            const now = Math.floor(Date.now() / 1000);
            note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(0);
            note.updateTimeStamp = now;
            updateNoteByData({
              id: note.id,
              level: note.level,
              remindTimeStamp: note.remindTimeStamp,
              isDelete: note.isDelete,
              updateTimeStamp: note.updateTimeStamp,
            });
            addCodeToAlignment(note.alignCode);
            const noteElement = document.querySelector(`span[data-id="${note.id}"]`);
            if (noteElement) {
              noteElement.remove();
            }
            noteListOnShow = noteListOnShow.filter((item) => item.id !== note.id);
          }
          updateProgressBar(audioList.length, audioList.length);
          playPromptAudio("./audio/end.mp3", () => {
            setTimeout(() => {
              audioPlayer.playbackRate = 1;
              resetAudioPlayer(audioPlayer);
              playListIsPlaying = false;
              localStorage.setItem("playListIsPlaying", playListIsPlaying);
              audioPlayer.onended = null;
              animateElement(audioListDiv, false);
              addListShakeEventListener();
              const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
              if (divSpanCardList.length === 0) {
                checkRemind();
              }
            }, 10);
          });
        }
      };
    } else {
      playPromptAudio("./audio/end.mp3", () => {
        setTimeout(() => {
          updateProgressBar(audioList.length, audioList.length);
          audioPlayer.playbackRate = 1;
          resetAudioPlayer(audioPlayer);
          playListIsPlaying = false;
          localStorage.setItem("playListIsPlaying", playListIsPlaying);
          audioPlayer.onended = null;
          animateElement(audioListDiv, false);
          const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
          if (divSpanCardList.length === 0) {
            checkRemind();
          }
        }, 500);
      });
    }
  }
  /**
   * 从包含假名发音的HTML字符串中提取纯文本
   * 删除掉用于注音的<rt>与<rp>标签及其内容
   * @param {string} htmlString - 含有假名注音标记的HTML字符串
   * @returns {string} 纯文本字符串，仅包含原本的文字内容
   */
  function extractBaseText(htmlString) {
    const container = document.createElement("div");
    container.innerHTML = htmlString;
    container.querySelectorAll("rt, rp").forEach((el) => el.remove());
    return container.textContent;
  }
  /**
   * 根据文本长度自动调节audioTextDisplay字体大小
   * @param {string} text - 要显示的文本内容
   * @returns {void}
   */
  function adjustAudioTextSize(text) {
    if (text.includes('<span class="morpheme">')) {
      text = extractBaseText(text);
    }
    const audioTextDisplay = document.querySelector("#audioTextDisplay");
    const baseSize = 6;
    const maxChars = 33;
    const length = text.length;
    const exponent = 0.25;
    let newSize = baseSize * Math.pow(maxChars / length, exponent);
    const scaleFactor = 0.8;
    newSize = newSize * scaleFactor;
    const minFontSize = 1.6;
    const maxFontSize = 7.2;
    if (newSize < minFontSize) {
      newSize = minFontSize;
    } else if (newSize > maxFontSize) {
      newSize = maxFontSize;
    }
    audioTextDisplay.style.fontSize = newSize + "vw";
  }
  /**
   * 播放无限循环模式音频
   * 支持单个音频无限重复播放，显示播放次数统计
   * @returns {void}
   */
  function playUnlimitedTrack() {
    const unlimitedPlayNumber = document.querySelector(".unlimited-play-number");
    if (audioPlayIndex.value < audioList.length) {
      updateProgressBar(audioPlayIndex.value, audioList.length);
      let currentAudio = audioList[audioPlayIndex.value];
      audioPlayer.src = currentAudio.src;
      audioPlayer.dataset.currentNoteId = currentAudio.id;
      if (currentAudio.id) {
        audioPlayer.loop = true;
        let lastTime = 0;
        let isPlaying = false;
        audioPlayer.onplay = function () {
          isPlaying = true;
          lastTime = audioPlayer.currentTime;
        };
        audioPlayer.onpause = function () {
          isPlaying = false;
          lastTime = audioPlayer.currentTime;
        };
        audioPlayer.ontimeupdate = function () {
          let current = audioPlayer.currentTime;
          if (current < lastTime) {
            audioUnlimitedPlayNumber++;
            unlimitedPlayNumber.textContent = audioUnlimitedPlayNumber;
          }
          lastTime = current;
        };
      } else {
        audioPlayer.loop = false;
        audioPlayer.ontimeupdate = null;
        audioUnlimitedPlayNumber = 0;
      }
      let audioTextDisplay = document.querySelector("#audioTextDisplay");
      if (audioTextDisplay.innerHTML !== `<h1>${currentAudio.text}</h1>`) {
        audioTextDisplay.classList.remove("animate__zoomIn");
        void audioTextDisplay.offsetWidth;
        audioTextDisplay.innerHTML = `<h1>${currentAudio.text}</h1>`;
        audioTextDisplay.classList.add("animate__animated", "animate__zoomIn");
      }
      const playRate = Math.round((1 + Number(currentAudio.level) * 0.2) * 10) / 10;
      audioPlayer.playbackRate = playRate;
      audioPlayer.play().catch(() => {});
      audioPlayer.onended = function () {
        if (!audioPlayer.loop) {
          updateProgressBar(audioPlayIndex.value, audioList.length);
          audioPlayIndex.value++;
          playUnlimitedTrack();
        }
      };
    } else {
      updateProgressBar(audioList.length, audioList.length);
      const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
      divSpanCardList.forEach((item) => {});
      if (divSpanCardList.length === 0) {
        checkRemind();
      }
      setTimeout(() => {
        audioPlayer.playbackRate = 1;
        resetAudioPlayer(audioPlayer);
        playListIsPlaying = false;
        localStorage.setItem("playListIsPlaying", playListIsPlaying);
        audioPlayer.onended = null;
        playPromptAudio("./audio/end.mp3", () => {
          animateElement(audioListDiv, false);
          const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
          if (divSpanCardList.length === 0) {
            checkRemind();
          }
        });
      }, 500);
    }
  }
  /**
   * 启动无限循环播放模式
   * @returns {void}
   */
  function unlimitedMode() {
    audioListDiv = createAudioListElement();
    animateElement(audioListDiv, true);
    playListIsPlaying = true;
    localStorage.setItem("playListIsPlaying", playListIsPlaying);
    playPromptAudio("./audio/readyonly.mp3", () => {
      doUnlimitedMode();
    });
  }
  /**
   * 执行无限模式的具体逻辑
   * @returns {void}
   */
  function doUnlimitedMode() {
    const unlimitedPlayNumber = document.querySelector(".unlimited-play-number");
    unlimitedPlayNumber.textContent = audioUnlimitedPlayNumber;
    unlimitedPlayNumber.classList.add("show");
    document.querySelector(".normal-play-number").classList.remove("show");
    document.querySelector(".note-comment").classList.remove("show");
    audioSpeed = 1;
    audioPlayIndex = { value: 0 };
    playListIsPlaying = true;
    localStorage.setItem("playListIsPlaying", playListIsPlaying);
    audioList = extractAudioSources(noteListOnShow, true);
    playUnlimitedTrack();
    audioPlayIndex.value++;
  }
  /**
   * 启动变速播放模式
   * @param {number|string} value - 播放速度百分比值
   * @returns {void}
   */
  function speedMode(value) {
    removeListShakeEventListener();
    audioListDiv = createAudioListElement();
    animateElement(audioListDiv, true);
    playPromptAudio("./audio/readyonly.mp3", () => {
      doSpeedMode(value);
    });
  }
  /**
   * 执行变速播放模式的具体逻辑
   * @param {number|string} value - 播放速度百分比值
   * @returns {void}
   */
  function doSpeedMode(value) {
    if (value === null || value === "") {
      value = 100;
    }
    audioSpeed = parseInt(value) / 100;
    audioPlayIndex = { value: 0 };
    playListIsPlaying = true;
    localStorage.setItem("playListIsPlaying", playListIsPlaying);
    audioList = extractAudioSources(noteListOnShow);
    document.querySelector(".normal-play-number").textContent = "";
    document.querySelector(".normal-play-number").classList.add("show");
    document.querySelector(".note-comment").textContent = "";
    document.querySelector(".note-comment").classList.add("show");
    document.querySelector(".unlimited-play-number").classList.remove("show");
    playNextTrack();
  }
  /**
   * 播放提示音频
   * @param {string} src - 音频文件路径
   * @param {Function} callback - 播放完成后的回调函数
   * @returns {void}
   */
  function playPromptAudio(src, callback) {
    let normalPlayNumberEl = document.querySelector(".normal-play-number");
    let noteCommentEl = document.querySelector(".note-comment");
    normalPlayNumberEl.textContent = "";
    normalPlayNumberEl.classList.remove("show");
    noteCommentEl.textContent = "";
    noteCommentEl.classList.remove("show");
    isNoticeVoicePlaying = true;
    let promptPlayer = new Audio();
    promptPlayer.src = src;
    const promptPlayerVolume = getVolumeByPath(src);
    promptPlayer.volume = promptPlayerVolume;
    promptPlayer.playbackRate = 1;
    promptPlayer.play().catch(() => {});
    let showContent = "";
    if (src.includes("gap_590.mp3")) {
      showContent = "Next!🎉";
    } else if (src.includes("done2.mp3")) {
      showContent = "Skip!⏩";
    } else if (src.includes("readyonly.mp3")) {
      showContent = "Are you ready?";
    } else if (src.includes("end.mp3")) {
      showContent = "Finish!";
      updateProgressBar(audioList.length, audioList.length);
    }
    const audioTextDisplay = document.querySelector("#audioTextDisplay");
    if (audioTextDisplay) {
      audioTextDisplay.classList.remove("animate__animated", "animate__zoomIn");
      audioTextDisplay.innerHTML = `<h1><span class="prompt">${showContent}</span></h1>`;
      void audioTextDisplay.offsetWidth;
      audioTextDisplay.classList.add("animate__animated", "animate__zoomIn");
    }
    promptPlayer.onended = function () {
      isNoticeVoicePlaying = false;
      if (typeof callback === "function") callback();
    };
  }
  /**
   * 播放音频列表
   * @param {string} action - 操作类型，"play"或"stop"
   * @returns {void}
   */
  function playAudioList(action = "play") {
    if (action === "stop") {
      addListShakeEventListener();
      addListLongpressEventListener();
      if (document.querySelector("div.play-audio-list")) {
        resetAudioPlayer(audioPlayer);
        animateElement(document.querySelector("div.play-audio-list"), false);
        playListIsPlaying = false;
        localStorage.setItem("playListIsPlaying", playListIsPlaying);
        const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
        if (divSpanCardList.length === 0) {
          checkRemind();
        }
      }
      if (unlimited) {
        unlimited = false;
        audioPlayer.loop = false;
        const unlimitedPlayNumber = document.querySelector(".unlimited-play-number");
        unlimitedPlayNumber.innerHTML = "0";
        unlimitedPlayNumber.classList.remove("show");
      }
      return;
    }
    speedMode("100");
  }
  /**
   * 返回键事件处理函数
   * 根据当前状态执行不同的返回逻辑：关闭弹窗、停止播放或返回分类页面
   * @returns {void}
   */
  function keyback() {
    if (Swal.isVisible()) {
      Swal.close();
      return;
    }
    if (playListIsPlaying) {
      playAudioList("stop");
    } else {
      const listItem = document.querySelector("span.playing-item");
      if (listItem) {
        stopPlayingAndRestore(audioPlayer, listItem);
        listItem.classList.remove("clicked", "forgeted");
        removeTranslate();
      } else {
        const checkedNoteList = document.querySelectorAll("div.container span.clicked, div.container span.forgeted");
        if (checkedNoteList.length) {
          checkedNoteList.forEach((item) => {
            item.classList.remove("clicked", "forgeted");
            removeTranslate();
          });
          clickedNoteIdArr = [];
        } else {
          localStorage.removeItem("selectedCategoryList");
          localStorage.setItem("needSubSearch", "true");
          api.removeEventListener({
            name: "shake",
          });
          api.removeEventListener({
            name: "longpress",
          });
          api.openWin({
            name: "category",
            url: "./category.html",
            animation: {
              type: "push",
              subType: "from_left",
            },
          });
        }
      }
    }
  }
  /**
   * 停止播放并恢复页面状态
   * @param {HTMLAudioElement} audioPlayer - 音频播放器
   * @param {HTMLElement} listItem - 列表项元素
   * @returns {void}
   */
  function stopPlayingAndRestore(audioPlayer, listItem) {
    removeTranslate();
    audioPlayer.pause();
    restorePageState();
    listItem.classList.remove("playing-item");
  }
  /**
   * 初始化应用程序
   * 清空数组、清除通知、关闭消息提示并检查是否需要提醒
   * @returns {void}
   */
  function listInit() {
    noteListOnShow = [];
    api.cancelNotification({ id: -1 });
    api.setAppIconBadge({ badge: 0 });
    closeAllActionMessage();
    closeAllEnvMessage();
    checkRemind();
  }
  /**
   * 检查是否需要提醒用户学习
   * 查询数据库中需要提醒的笔记并显示，如果没有则播放背景音乐并返回分类页面
   * @returns {void}
   */
  function checkRemind() {
    const currentCategoryList = JSON.parse(localStorage.getItem("selectedCategoryList"));
    const needSubSearch = localStorage.getItem("needSubSearch") === "true";
    const allRemindNotes = queryRemindNotesPaginated(0, PAGE_SIZE, currentCategoryList, needSubSearch);
    if (allRemindNotes.length === 0) {
      document.querySelector("div.container").style.backgroundColor = "rgba(0, 0, 0, 0.2)";
      document.querySelector("div.container").innerHTML = "";
      playBgm();
      keyback();
    } else {
      document.querySelector("div.container").innerHTML = "";
      showNoteList(allRemindNotes);
    }
  }
  /**
   * 处理双击选中笔记的多重操作（不包括当前双击的笔记）
   * @param {string} noteId - 当前双击的笔记ID
   * @returns {void}
   */
  function multiHandleClickedNoteForDoubleClick(noteId) {
    const listItem = document.querySelector("span.playing-item");
    if (listItem) {
      stopPlayingAndRestore(audioPlayer, listItem);
    }
    let divSpanCardClickedList = document.querySelectorAll("div.container span.clicked, div.container span.forgeted");
    const updateCloudNoteArr = [];
    divSpanCardClickedList.forEach((item, index) => {
      if (item.dataset.id == noteId) {
        return;
      }
      const id = item.dataset.id;
      const note = queryNoteById(id);
      note.level = Number(note.level);
      const now = Math.floor(Date.now() / 1000);
      if (item.classList.contains("clicked")) {
        note.level += 1;
        note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(note.level);
      } else {
        note.level = Math.max(Number(note.level) - 1, 0);
        note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(0);
      }
      note.updateTimeStamp = Math.floor(Date.now() / 1000);
      const updateNoteData = {
        id: note.id,
        level: note.level,
        remindTimeStamp: note.remindTimeStamp,
        isDelete: note.isDelete,
      };
      updateNoteByData(updateNoteData);
      addCodeToAlignment(note.alignCode);
    });
    audioPlayer.onended = null;
    if (!audioPlayer.paused) {
      removeTranslate();
      audioPlayer.pause();
    }
  }
  /**
   * 处理多个选中笔记的批量操作
   * 根据选中状态更新笔记等级并从页面移除
   * @returns {void}
   */
  function multiHandleClickedNote() {
    const listItem = document.querySelector("span.playing-item");
    if (listItem) {
      stopPlayingAndRestore(audioPlayer, listItem);
    }
    let divSpanCardClickedList = document.querySelectorAll("div.container span.clicked, div.container span.forgeted");
    const updateCloudNoteArr = [];
    divSpanCardClickedList.forEach((item, index) => {
      const id = item.dataset.id;
      const note = queryNoteById(id);
      note.level = Number(note.level);
      const now = Math.floor(Date.now() / 1000);
      if (item.classList.contains("clicked")) {
        note.level += 1;
        note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(note.level);
      } else {
        note.level = Math.max(Number(note.level) - 1, 0);
        note.remindTimeStamp = now + getRemindTimeDiffByLevelNumber(0);
      }
      note.updateTimeStamp = Math.floor(Date.now() / 1000);
      const updateNoteData = {
        id: note.id,
        level: note.level,
        remindTimeStamp: note.remindTimeStamp,
        isDelete: note.isDelete,
      };
      updateNoteByData(updateNoteData);
      addCodeToAlignment(note.alignCode);
      item.remove();
      noteListOnShow = noteListOnShow.filter((note) => note.id !== id);
    });
    const handledNumber = divSpanCardClickedList.length;
    let alertMessage = `搞定${handledNumber}条笔记!🎉`;
    showMessage(alertMessage, 2000, "welldone", "success");
    audioPlayer.onended = null;
    if (!audioPlayer.paused) {
      removeTranslate();
      audioPlayer.pause();
    }
    audioPlayer.src = "./audio/6.mp3";
    audioPlayer.play().catch(() => {});
    messageIsShow = true;
    setTimeout(() => {
      messageIsShow = false;
    }, 1000);
    const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
    if (divSpanCardList.length === 0) {
      checkRemind();
    }
  }
  /**
   * 递归顺序播放音频列表
   * @param {HTMLAudioElement} audioPlayer - 音频播放器
   * @param {Array<string>} audioSrcList - 音频源列表
   * @param {HTMLElement} item - 关联的列表项元素
   * @returns {void}
   */
  function playSequentialAudio(audioPlayer, audioSrcList, item) {
    if (audioSrcList.length === 0) {
      stopPlayingAndRestore(audioPlayer, item);
      return;
    }
    if (audioSrcList.every((src) => !src || src.trim() === "" || src === "undefined" || src === "null")) {
      return;
    }
    const currentSrc = audioSrcList.shift();
    audioPlayer.src = currentSrc;
    audioPlayer.dataset.currentNoteId = item.dataset.id;
    audioPlayer.playbackRate = audioSpeed;
    const levelStr = item.dataset.level || "level0";
    const level = parseInt(levelStr.replace("level", ""), 10) || 0;
    const playRate = Math.round((1 + level * 0.2) * 10) / 10;
    audioPlayer.playbackRate = playRate;
    audioPlayer.play().catch(() => {});
    audioPlayer.onended = function () {
      playSequentialAudio(audioPlayer, audioSrcList, item);
    };
  }
  /**
   * 高亮文本中的关键词
   * @param {string} text - 原始文本
   * @param {Array<string>} keywords - 关键词数组
   * @returns {string} 高亮处理后的HTML文本
   */
  function highlightKeywords(text, keywords) {
    if (!keywords.length) return text;
    keywords.forEach((keyword) => {
      const regex = new RegExp(`(${keyword})`, "gi");
      text = text.replace(regex, `<b>$1</b>`);
    });
    return text;
  }
  /**
   * 显示翻译提示
   * @param {HTMLElement} item - 触发显示翻译的元素
   * @returns {void}
   */
  function showTranslate(item) {
    removeTranslate();
    const text = item.textContent.trim();
    if (text === "听力全文" || text === "听力原文" || text === "阅读原文" || text === "阅读全文") {
      return;
    }
    let textType = "";
    if (text === item.dataset.jp) {
      textType = "japanese";
    } else if (text === item.dataset.cn) {
      textType = "chinese";
    }
    if (textType === "") {
      return;
    }
    if (textType === "japanese" && item.dataset.cn) {
      let transContent = `『${item.dataset.cn}』`;
      let transLevel = item.dataset.level;
      currentToast = showMessage(transContent, "long", "trans", transLevel);
      return;
    }
    if (textType === "chinese" && item.dataset.jp) {
      let transContent = `「${item.dataset.jp}」`;
      let transLevel = item.dataset.level;
      currentToast = showMessage(transContent, "long", "trans", transLevel);
      return;
    }
  }
  /**
   * 移除翻译提示
   * @returns {void}
   */
  function removeTranslate() {
    if (currentToast) {
      currentToast.hideToast();
      currentToast = null;
    }
  }
  /**
   * 展示笔记列表
   * @param {Array<Object>} noteList - 笔记数据列表
   * @param {string} fromAction - 来源操作类型
   * @returns {void}
   */
  function showNoteList(noteList, fromAction = "") {
    if (!noteList || noteList.length === 0) {
      keyback();
      return;
    }
    noteCnMap = {};
    if (noteList.length === 0) {
      keyback();
      return;
    }
    noteListOnShow = noteListOnShow.concat(noteList);
    noteList.forEach((note) => {
      const parser = new DOMParser();
      if (note.side1) {
        const doc1 = parser.parseFromString(marked.parse(note.side1), "text/html");
        const audio1 = doc1.querySelector("audio");
        if (audio1) note.audio1 = getPathByUrl(audio1.src);
      }
      if (note.side2) {
        const doc2 = parser.parseFromString(marked.parse(note.side2), "text/html");
        const audio2 = doc2.querySelector("audio");
        if (audio2) {
          note.audio2 = getPathByUrl(audio2.src);
          if (audio2.classList.contains("voice-comment")) {
            if (note.audio2) {
              if (note.audio2.startsWith("file://")) {
                voiceCommentList.push(note.audio2);
              } else {
                voiceCommentList.push("file://" + note.audio2);
              }
            } else {
              if (audio2.src.startsWith("file://")) {
                voiceCommentList.push(audio2.src);
              } else {
                voiceCommentList.push("file://" + audio2.src);
              }
            }
          }
        }
      }
      const combinedContent = (note.side1 || "") + (note.side2 || "");
      const cnRegex = /『([^』]+)』/;
      const cnMatch = cnRegex.exec(combinedContent);
      note.cn = "";
      if (cnMatch) {
        note.cn = cnMatch[1];
      }
      const jpRegex = /((?:<span\s+class=["']morpheme["'][^>]*>[\s\S]*?<\/span>\s*)+)/;
      const jpMatch = jpRegex.exec(combinedContent);
      note.jp = "";
      if (jpMatch) {
        let fragment = jpMatch[1];
        fragment = fragment.replace(/<rt>.*?<\/rt>/g, "");
        fragment = fragment.replace(/<[^>]+>/g, "");
        fragment = fragment.replace(/（.*?）/g, "");
        fragment = fragment.replace(/\(.*?\)/g, "");
        const jpText = fragment.trim();
        if (jpText) {
          note.jp = jpText;
        }
      }
    });
    let noteDataToHtml = noteList
      .map((item, index) => {
        let htmlContent = marked.parse(item.side1);
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlContent, "text/html");
        let textContent = doc.body.textContent || "";
        textContent = textContent.split("\n")[0];
        if (
          textContent === "听力全文" ||
          textContent === "听力原文" ||
          textContent === "阅读原文" ||
          textContent === "阅读全文"
        ) {
          if (!textContent.startsWith("📚")) {
            textContent = "📚" + textContent;
          }
        }
        const baseAttributes = `data-src1="${item.audio1}" data-src2="${item.audio2}" class="title-list level${item.level}" data-level="level${item.level}" data-index="${index}" data-id="${item.id}"`;
        const cnAttribute = item.cn ? ` data-cn="${item.cn}"` : "";
        const jpAttribute = item.jp ? ` data-jp="${item.jp}"` : "";
        return `<span ${baseAttributes}${cnAttribute}${jpAttribute}>${textContent}</span>`;
      })
      .join("");
    document.querySelector("div.container").innerHTML += noteDataToHtml;
    if (fromAction === "showMore") {
      setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight);
      }, 0);
    }
    document.querySelectorAll("span").forEach((item) => {
      let lastClickTimeStamp = 0;
      function normalizeSrc(src) {
        return src.replace(/^file:\/\//, "");
      }
      item.onclick = function () {
        if (messageIsShow) {
          return;
        }
        let hasClicked = this.classList.contains("clicked");
        let hasForgeted = this.classList.contains("forgeted");
        if (!hasClicked && !hasForgeted) {
          this.classList.add("clicked");
          this.classList.remove("forgeted");
          showTranslate(this);
        } else if (hasClicked && !hasForgeted) {
          this.classList.remove("clicked");
          this.classList.add("forgeted");
        } else if (!hasClicked && hasForgeted) {
          this.classList.remove("clicked", "forgeted");
          removeTranslate();
        }
        let currentTime = Date.now();
        if (currentTime - lastClickTimeStamp < DOUBLE_CLICK_DELAY_THRESHOLD) {
          lastClickTimeStamp = currentTime;
          listItemDoubleClick(this);
        } else {
          lastClickTimeStamp = currentTime;
          if (this.classList.contains("clicked")) {
            oneClick(this);
          } else if (this.classList.contains("forgeted")) {
            const audioSrcList = [this.dataset.src1];
            const normalizeSrcAudioSrcList = audioSrcList.map((src) => normalizeSrc(src));
            const isCurrentlyPlaying =
              this.classList.contains("playing-item") &&
              normalizeSrcAudioSrcList.includes(normalizeSrc(audioPlayer.src));
            if (isCurrentlyPlaying) {
              stopPlayingAndRestore(audioPlayer, this);
            }
          }
        }
      };
    });
    const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
    const currentCategoryList = JSON.parse(localStorage.getItem("selectedCategoryList")) || [];
    const needSubSearch = localStorage.getItem("needSubSearch") === "true";
    const isHasMoreResult = hasMoreData(divSpanCardList.length, PAGE_SIZE, currentCategoryList, needSubSearch);
    const isHasMore = isHasMoreResult.isHasMore;
    if (isHasMore) {
      let moreButton = document.createElement("span");
      moreButton.className = "title-list more-button";
      moreButton.textContent = numberToEmoji(isHasMoreResult.lastPage);
      moreButton.onclick = function () {
        let offset = document.querySelectorAll("div.container span:not(.more-button)").length;
        document.querySelector("div.container").removeChild(moreButton);
        let nextRemindNotes = queryRemindNotesPaginated(offset, PAGE_SIZE, currentCategoryList, needSubSearch);
        showNoteList(nextRemindNotes, "showMore");
      };
      document.querySelector("div.container").appendChild(moreButton);
    }
    const noteCount = document.querySelectorAll("div.container span:not(.more-button)").length;
    const noteCountMessage = `当前共有 ${noteCount} 条笔记!`;
    showMessage(noteCountMessage, 2000, "yanhua", "success");
    FontAdjuster.init([".container span", "#audioTextDisplay"]);
  }
  /**
   * 恢复页面状态
   * 移除所有播放相关的CSS类，恢复正常显示
   * @returns {void}
   */
  function restorePageState() {
    let divSpanCard = document.querySelectorAll("div.container span");
    divSpanCard.forEach((item) => {
      item.classList.remove("playing-item");
    });
  }
  /**
   * 处理列表项双击事件
   * @param {HTMLElement} listItem - 被双击的列表项
   * @returns {void}
   */
  function listItemDoubleClick(listItem) {
    listItem.classList.add("clicked");
    listItem.classList.remove("forgeted");
    const noteId = listItem.dataset.id;
    multiHandleClickedNoteForDoubleClick(noteId);
    localStorage.setItem("doubleClickMode", "true");
    prepareToGotoCardPage("left", noteId);
  }
  /**
   * 处理列表项单击事件
   * @param {HTMLElement} listItem - 被单击的列表项
   * @returns {void}
   */
  function oneClick(listItem) {
    let divSpanCard = document.querySelectorAll("div.container span");
    const audioSrcList = [listItem.dataset.src1];
    if (audioSrcList.every((src) => !src || src.trim() === "" || src === "undefined" || src === "null")) {
      return;
    }
    divSpanCard.forEach((item) => {
      item.classList.remove("playing-item");
    });
    listItem.classList.add("clicked", "playing-item");
    audioPlayer.dataset.currentNoteId = listItem.dataset.id;
    playSequentialAudio(audioPlayer, [...audioSrcList], listItem);
  }
  /**
   * 播放指定音频文件
   * @param {string} audioSrc - 音频文件路径
   * @returns {void}
   */
  function playAudio(audioSrc) {
    if (audioPlayer.src === audioSrc) {
      if (audioPlayer.paused) {
        audioPlayer.play().catch(() => {});
      } else {
        removeTranslate();
        audioPlayer.pause();
      }
    } else {
      audioPlayer.src = audioSrc;
      audioPlayer.play().catch(() => {});
    }
  }
  /**
   * 跳转到卡片页面
   * @param {string} direction - 跳转方向("left"或"right")
   * @returns {void}
   */
  function gotoCardPage(direction) {
    localStorage.setItem("listToCardDirection", direction);
    let subType = "";
    if (direction === "left") {
      subType = "from_right";
    } else {
      subType = "from_left";
    }
    api.openWin({
      name: "card",
      url: "./card.html",
      pageParam: { clickedNoteIdArr: JSON.stringify(clickedNoteIdArr) },
      animation: {
        type: "push",
        subType: subType,
      },
    });
  }
  /**
   * 准备跳转到卡片页面
   * 收集选中的笔记ID并设置相关参数
   * @param {string} direction - 跳转方向
   * @param {string} [selectId] - 特定选中的笔记ID
   * @returns {void}
   */
  function prepareToGotoCardPage(direction, selectId) {
    const divSpanCardList = document.querySelectorAll("div.container span:not(.more-button)");
    const divSpanCardClickedList = document.querySelectorAll("div.container span.clicked");
    if (selectId) {
      clickedNoteIdArr = [selectId];
    } else {
      clickedNoteIdArr = [];
      if (divSpanCardClickedList.length !== 0) {
        divSpanCardClickedList.forEach((item) => {
          clickedNoteIdArr.push(item.dataset.id);
        });
      } else {
        divSpanCardList.forEach((item) => {
          clickedNoteIdArr.push(item.dataset.id);
        });
      }
    }
    api.removeEventListener({
      name: "shake",
    });
    api.removeEventListener({
      name: "longpress",
    });
    if (direction === "right") {
      localStorage.setItem("listenMode", "true");
    }
    gotoCardPage(direction);
  }
};
