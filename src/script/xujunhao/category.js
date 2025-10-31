/**
 * 页面入口生命周期：apiready
 *
 * 职责概览：
 * - 关闭可能残留的窗口（card, studyInfo, list, category-search）以防堆叠
 * - 初始化分类页交互（摇一摇、长按、左右滑动）、BGM 与提示音播放
 * - 查询与渲染有待复习的分类概览，处理空数据与下一次提醒时间
 * - 监听前后台切换、返回键、摇一摇、长按、左右滑事件
 * - 触发对齐/同步相关逻辑（alignNotesByCode 等）
 *
 * 重要状态：
 * - playListIsPlaying: 是否正在播放随机音乐叠层
 * - isShaking / isLongPressing: 简单节流，避免重复触发手势
 *
 * 外部依赖与副作用：
 * - 使用 APICloud 的 api.* 能力（事件、窗口、下载、通知、图标角标等）
 * - 读写 localStorage（appState、selectedCategoryList、currentSearchContent 等）
 * - 操作 DOM（渲染分类、创建进度条层、控制 audio 元素）
 */
apiready = function () {
  const sync = createSyncLogic();
  const categoryInfo = {};
  setTimeout(() => {
    api.closeWin({
      name: "card",
    });
    api.closeWin({
      name: "studyInfo",
    });
    api.closeWin({
      name: "list",
    });
    api.closeWin({
      name: "category-search",
    });
  }, 500);
  let playListIsPlaying = false;
  let isShaking = true;
  let isLongPressing = true;
  setTimeout(() => {
    isShaking = false;
    isLongPressing = false;
  }, 1000);
  const listBgm = document.querySelector(".category-bgm");
  const categoryHold = document.querySelector(".category-hold");
  const categoryMark = document.querySelector(".category-mark");
  const studyInfoMark = document.querySelector(".study-info-mark");
  /**
   * 播放分类页背景音乐
   * - 音量依据音频路径查表映射
   * - 从头开始播放，异常时静默
   */
  function playBgm() {
    listBgm.currentTime = 0;
    const bgmVolume = getVolumeByPath(listBgm.src);
    listBgm.volume = bgmVolume;
    listBgm.play().catch(() => {});
  }
  /**
   * 播放“选中保持”提示音
   * - 用于分类被选中时的反馈
   */
  function playHold() {
    categoryHold.currentTime = 0;
    const holdVolume = getVolumeByPath(categoryHold.src);
    categoryHold.volume = holdVolume;
    categoryHold.play().catch(() => {});
  }
  /**
   * 播放“标记进入列表页”提示音
   * - 进入 list 页前的短促提示
   */
  function playMark() {
    categoryMark.currentTime = 0;
    const markVolume = getVolumeByPath(categoryMark.src);
    categoryMark.volume = markVolume;
    categoryMark.play().catch(() => {});
  }
  /**
   * 播放“查看学习信息”提示音
   * - 左滑进入 studyInfo 页前提示
   */
  function playStudyInfoMark() {
    studyInfoMark.currentTime = 0;
    const studyInfoMarkVolume = getVolumeByPath(studyInfoMark.src);
    studyInfoMark.volume = studyInfoMarkVolume;
    studyInfoMark.play().catch(() => {});
  }
  playBgm();
  checkLastDeleteNote();
  categoryInit();
  api.addEventListener(
    {
      name: "keyback",
    },
    function (ret, err) {
      if (playListIsPlaying) {
        stopPlayRandomMusic();
        return;
      }
      if (Swal.isVisible()) {
        Swal.close();
        return;
      }
      /* 返回键有两个功能, 一个是取消选中, 一个是切后台
					如果有选中的分类, 则取消选中
					如果没有选中的分类, 则切后台 */
      if (document.querySelectorAll("span.selected").length > 0) {
        document.querySelectorAll("span.selected").forEach((item) => {
          item.classList.remove("selected");
          item.classList.add("no-selected");
          item.style.backgroundImage = "none";
        });
        return false;
      }
      api.toLauncher();
    }
  );
  api.addEventListener(
    {
      name: "resume",
    },
    function (ret, err) {
      if (!playListIsPlaying) {
        addCategoryShakeEventListener();
      }
      getStartTimeStamp();
      appToFront("category, resume");
      checkNeedSyncByUpdateTimeStamp();
      categoryInit();
    }
  );
  api.addEventListener(
    {
      name: "pause",
    },
    function (ret, err) {
      removeCategoryShakeEventListener();
      appToBack();
    }
  );
  api.addEventListener(
    {
      name: "longpress",
    },
    function (ret, err) {
      if (isLongPressing || isShaking) {
        return false;
      }
      isLongPressing = true;
      longPressCategory();
      setTimeout(() => {
        isLongPressing = false;
      }, 1000);
    }
  );
  /**
   * 绑定“摇一摇”事件监听
   * - 带节流（isShaking, isLongPressing）与 appState 前后台判断
   * - 触发随机音乐播放并临时移除监听，结束后再恢复
   */
  function addCategoryShakeEventListener() {
    removeCategoryShakeEventListener();
    api.addEventListener(
      {
        name: "shake",
      },
      function (ret, err) {
        if (localStorage.getItem("appState") === "back") {
          return;
        }
        if (isShaking || isLongPressing) {
          return false;
        }
        isShaking = true;
        if (localStorage.getItem("appState") === "front") {
          handleShakeCategory();
        }
        setTimeout(() => {
          isShaking = false;
        }, 1000);
      }
    );
  }
  addCategoryShakeEventListener();
  /**
   * 解绑“摇一摇”事件监听
   */
  function removeCategoryShakeEventListener() {
    api.removeEventListener({
      name: "shake",
    });
  }
  api.addEventListener(
    {
      name: "swipeleft",
    },
    function (ret, err) {
      shakeThePhone();
      if (isShaking || isLongPressing) {
        return false;
      }
      prepareToGotoListPage();
    }
  );
  api.addEventListener(
    {
      name: "swiperight",
    },
    function (ret, err) {
      shakeThePhone();
      if (isShaking || isLongPressing) {
        return false;
      }
      prepareToStudyInfoPage();
    }
  );
  /**
   * 进入列表页前的准备：
   * - 采集已选中的分类；若无选中则默认全选
   * - 存入 localStorage.selectedCategoryList
   * - 移除手势监听并打开 list.html
   */
  function prepareToGotoListPage() {
    playMark();
    let selectedCategoryList = [];
    const categoryListDOM = document.querySelectorAll("div.container span");
    const selectedCategoryListDOM = document.querySelectorAll("div.container span.selected");
    if (selectedCategoryListDOM.length === 0) {
      categoryListDOM.forEach((item) => {
        selectedCategoryList.push(item.dataset.category);
      });
    } else {
      selectedCategoryListDOM.forEach((item) => {
        selectedCategoryList.push(item.dataset.category);
      });
    }
    localStorage.setItem("selectedCategoryList", JSON.stringify(selectedCategoryList));
    api.removeEventListener({
      name: "shake",
    });
    api.removeEventListener({
      name: "longpress",
    });
    api.openWin({
      name: "list",
      url: "./list.html",
      animation: {
        type: "push",
        subType: "from_right",
      },
    });
  }
  /**
   * 进入学习信息页前的准备：
   * - 播放提示音，移除手势监听，打开 study-info.html
   */
  function prepareToStudyInfoPage() {
    playStudyInfoMark();
    api.removeEventListener({
      name: "shake",
    });
    api.removeEventListener({
      name: "longpress",
    });
    api.openWin({
      name: "studyInfo",
      url: "./study-info.html",
      animation: {
        type: "push",
        subType: "from_left",
      },
    });
  }
  /**
   * 摇一摇处理：获取并播放随机音乐
   * - 关闭可能存在的弹窗
   * - 显示加载提示、调用随机音乐接口、错误提示
   * - 成功后播放并移除摇一摇监听，待播放结束再恢复
   */
  async function handleShakeCategory() {
    swal.close();
    if (playListIsPlaying) {
      return;
    }
    showLoadingMessage("正在获取随机音乐...");
    const musicResponse = getRandomSong();
    const musicItem = musicResponse.data;
    closeLoadingMessage();
    if (musicResponse.errno != 0) {
      showMessage(musicResponse.message, 2000, "songerror2", "error");
      return;
    }
    playRandomMusic(musicItem);
    removeCategoryShakeEventListener();
  }
  /**
   * 更换随机音乐（在播放层已打开的情况下触发）
   */
  async function changeMusic() {
    showLoadingMessage("正在获取随机音乐...");
    const musicResponse = getRandomSong();
    const musicItem = musicResponse.data;
    closeLoadingMessage();
    if (musicResponse.errno != 0) {
      showMessage(musicResponse.message, 2000, "songerror2", "error");
      return;
    }
    playRandomMusic(musicItem);
  }
  /**
   * 批量下载音乐资源到本地
   * @param {Array<{src:string}>} musicList - 待下载音乐数组
   * - 跳过已存在文件
   * - 逐项下载，记录成功/失败数，并提示最终结果
   */
  function downloadMusicToLocal(musicList) {
    let currentIndex = 0;
    let successCount = 0;
    let failCount = 0;
    const total = musicList.length;
    musicList.forEach((item, index) => {
      const path = getPathByUrl(item.src);
      if (path) {
        showMusicDoneMessage(`文件已存在, 跳过下载 [${index + 1}/${total}]`);
        return;
      }
      currentIndex = index + 1;
      showMusicDownLoadingMessage(`正在下载: [${currentIndex}/${total}]`);
      const savePath = api.fsDir + "/download/" + item.src.split("/").pop();
      api.download(
        {
          url: item.src,
          savePath: savePath,
          report: false,
          cache: false,
          allowResume: false,
        },
        function (ret, err) {
          if (ret && ret.state === 1) {
            successCount++;
            showMusicDoneMessage(`下载成功: [${currentIndex}/${total}]`);
            insertUrl(item.src, savePath);
          } else {
            failCount++;
            showMusicDownLoadingMessage(`下载失败: [${currentIndex}/${total}]`);
          }
          if (currentIndex === total) {
            showMusicResultMessage(`下载完成! 成功: ${successCount}, 失败: ${failCount}`);
          }
        }
      );
    });
  }
  /**
   * 创建随机音乐播放层（含标题与进度条）
   * @returns {HTMLDivElement} 根节点元素
   */
  function createAudioListElement() {
    let playAudioListDiv = document.createElement("div");
    playAudioListDiv.className = "play-audio-list";
    playAudioListDiv.style.opacity = "0";
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
   * 更新播放进度条
   * @param {number} playTime - 已播放时长（秒）
   * @param {number} totalTime - 总时长（秒）
   */
  function updateProgressBar(playTime, totalTime) {
    if (playTime < 0) {
      return;
    }
    var percentage = (playTime / totalTime) * 100;
    var progressBar = document.getElementById("progressBar");
    var progressText = document.getElementById("progressText");
    if (percentage === 0) {
      progressBar.style.width = "0%";
      progressText.textContent = "";
      return;
    }
    if (percentage > 100) {
      percentage = 100;
    }
    progressBar.style.width = percentage + "%";
    progressText.textContent = percentage.toFixed(0) + "%";
  }
  /**
   * 渐显/渐隐播放层，并在隐藏动画结束后移除节点
   * @param {HTMLElement} elem
   * @param {boolean} show - true 渐显 / false 渐隐并移除
   */
  function animateElement(elem, show) {
    if (elem) {
      setTimeout(() => {
        if (show) {
          elem.style.opacity = "1";
        } else {
          elem.style.opacity = "0";
          setTimeout(function () {
            elem.remove();
          }, 500);
        }
      }, 0);
    }
  }
  /**
   * 结束随机音乐播放：
   * - 渐隐音量、复位播放器、移除播放层、恢复摇一摇监听
   * - 刷新 startTimeStamp（用于会话时长等统计）
   */
  function stopPlayRandomMusic() {
    startTimeStamp = Math.floor(Date.now() / 1000);
    localStorage.setItem("startTimeStamp", startTimeStamp);
    const audioPlayer = document.querySelector(".random-music");
    if (document.querySelector("div.play-audio-list")) {
      fadeOutAudio(audioPlayer, 0.5);
      resetAudioPlayer(audioPlayer);
      animateElement(document.querySelector("div.play-audio-list"), false);
      playListIsPlaying = false;
    }
    addCategoryShakeEventListener();
  }
  /**
   * 重置音频播放器到初始状态
   * @param {HTMLAudioElement} player
   */
  function resetAudioPlayer(player) {
    if (!player.paused) {
      player.pause();
    }
    player.currentTime = 0;
    player.src = "";
  }
  /**
   * 将形如 HH:MM:SS:ms 的时间串转为毫秒
   * @param {string} timeStr - 例如 "00:00:05:000"
   * @returns {number} 毫秒数
   */
  function timeToMilliseconds(timeStr) {
    const [hours, minutes, seconds, milliseconds] = timeStr.split(":").map(Number);
    const totalMilliseconds = hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000 + milliseconds;
    return totalMilliseconds;
  }
  /**
   * 播放随机音乐条目
   * @param {{title:string,src:string,start:string,speed:number}} musicItem
   * - 自动创建/复用播放层，淡入音量，并展示标题与进度
   * - 支持从指定起点开始播放
   */
  function playRandomMusic(musicItem) {
    if (!musicItem) {
      return;
    }
    const audioPlayer = document.querySelector(".random-music");
    const audioSpeed = Number(musicItem.speed) || 1;
    let audioListObj = document.querySelector(".play-audio-list");
    if (!audioListObj) {
      audioListObj = createAudioListElement();
    } else {
      resetAudioListElement(audioListObj);
    }
    animateElement(audioListObj, true);
    let audioTextDisplay = document.querySelector("#audioTextDisplay");
    updateTextWithFade(audioTextDisplay, musicItem.title);
    playListIsPlaying = true;
    audioPlayer.src = getPathByUrl(musicItem.src) || musicItem.src;
    audioPlayer.playbackRate = audioSpeed;
    let musicItemStart = timeToMilliseconds(musicItem.start);
    audioPlayer.currentTime = musicItemStart / 1000;
    fadeInAudio(audioPlayer, 0.5);
    audioPlayer.play().catch(() => {});
    const audioStartTime = musicItemStart / 1000;
    audioPlayer.ontimeupdate = function () {
      updateProgressBar(audioPlayer.currentTime - audioStartTime, audioPlayer.duration - audioStartTime);
      if (audioPlayer.currentTime >= audioPlayer.duration - 0.5) {
        fadeOutAudio(audioPlayer, 0.5);
      }
    };
    audioPlayer.onended = function () {
      stopPlayRandomMusic();
    };
    audioListObj.onclick = () => {
      if (audioPlayer.paused) {
        audioPlayer.play().catch(() => {});
      } else {
        audioPlayer.pause();
      }
    };
  }
  /**
   * 带淡入的文案更新（用于播放层标题）
   * @param {HTMLElement} element - 容器
   * @param {string} newText - 新文本（内部以 <h1> 包裹）
   */
  function updateTextWithFade(element, newText) {
    if (element) {
      element.style.transition = "opacity 0.25s";
      element.style.opacity = "0";
      setTimeout(() => {
        element.innerHTML = `<h1>${newText}</h1>`;
        element.style.opacity = "1";
      }, 250);
    }
  }
  /**
   * 重置播放层进度并为当前音频执行淡出
   * @param {HTMLElement} audioListObj - 播放层根节点
   */
  function resetAudioListElement(audioListObj) {
    const audioPlayer = document.querySelector(".random-music");
    fadeOutAudio(audioPlayer, 0.5);
    const progressBar = audioListObj.querySelector(".progress-bar");
    const progressText = audioListObj.querySelector(".progress-text");
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
  }
  /**
   * 音频淡入
   * @param {HTMLAudioElement} audioPlayer
   * @param {number} duration - 秒
   */
  function fadeInAudio(audioPlayer, duration) {
    audioPlayer.volume = 0;
    const fadeInterval = 50;
    const volumeStep = 1 / ((duration * 1000) / fadeInterval);
    let currentVolume = 0;
    const fadeIn = setInterval(() => {
      currentVolume += volumeStep;
      if (currentVolume >= 1) {
        currentVolume = 1;
        clearInterval(fadeIn);
      }
      audioPlayer.volume = currentVolume;
    }, fadeInterval);
  }
  /**
   * 音频淡出
   * @param {HTMLAudioElement} audioPlayer
   * @param {number} duration - 秒
   */
  function fadeOutAudio(audioPlayer, duration) {
    const fadeInterval = 50;
    const volumeStep = 1 / ((duration * 1000) / fadeInterval);
    let currentVolume = 1;
    const fadeOut = setInterval(() => {
      currentVolume -= volumeStep;
      if (currentVolume <= 0) {
        currentVolume = 0;
        clearInterval(fadeOut);
      }
      audioPlayer.volume = currentVolume;
    }, fadeInterval);
  }
  /**
   * 分类页初始化：
   * - 清理通知与角标、关闭消息提示、清理临时选择
   * - 执行对齐逻辑，并根据传入的查询条件计算待复习分类
   * - 根据结果选择渲染或提示下一次复习时间
   */
  function categoryInit() {
    api.cancelNotification({ id: -1 });
    api.setAppIconBadge({ badge: 0 });
    closeAllActionMessage();
    closeAllEnvMessage();
    localStorage.removeItem("selectedCategoryList");
    localStorage.removeItem("currentSearchContent");
    const sync = createSyncLogic();
    const result = sync.alignNotesByCode(false);
    if (result.errno === 0) {
      showMessage(result.message + " " + result.data.alignedNotes + " 个笔记", 1500, "donesuccess", "success");
    }
    if (api.pageParam.searchCategoryContent) {
      const searchCategoryContent = api.pageParam.searchCategoryContent;
      const inputCategoryList = searchCategoryContent.split(/[,，]/).map((item) => item.trim());
      const searchCategoryArray = getSearchedCategory(inputCategoryList, "AND");
      localStorage.setItem("currentSearchContent", searchCategoryContent);
      localStorage.removeItem("needSubSearch");
      checkCategoryRemind(searchCategoryArray, false);
      return;
    }
    const localNoteNumber = queryNoteCount();
    if (localNoteNumber > 0) {
      localStorage.setItem("needSubSearch", "true");
      checkCategoryRemind([], true);
    } else {
      Swal.fire({
        title: "数据库中没有笔记数据!",
        icon: "error",
        confirmButtonText: "确定",
        customClass: {
          popup: "swal-custom-popup",
          confirmButton: "swal-button--confirm-full-red",
        },
      }).then((result) => {
        if (result.isConfirmed || result.isDismissed) {
          closeLoadingMessage();
          api.toLauncher();
        }
      });
    }
  }
  /**
   * 汇总并检查待复习分类
   * @param {string[]} [inputCategoryList=[]] - 指定查询分类；空数组表示不限定
   * @param {boolean} [needSubSearch=false] - 是否启用子查询（模糊/子集）
   */
  function checkCategoryRemind(inputCategoryList = [], needSubSearch = false) {
    let allRemindNotes = [];
    allRemindNotes = queryAllRemindNotes(inputCategoryList, needSubSearch);
    if (allRemindNotes.length === 0) {
      handleEmptyRemindNotes(needSubSearch);
    } else {
      showCategory(allRemindNotes);
    }
  }
  /**
   * 当无待复习数据时的处理
   * - needSubSearch=true：仅提示无数据
   * - needSubSearch=false：计算距离下次复习的时间并提示，然后返回桌面
   */
  function handleEmptyRemindNotes(needSubSearch) {
    if (needSubSearch) {
      Swal.fire({
        title: "当前分类没有需要复习的笔记",
        icon: "warning",
        confirmButtonText: "确定",
        customClass: {
          popup: "swal-custom-popup",
          confirmButton: "swal-button--confirm-full-green",
        },
      }).then((result) => {
        if (result.isConfirmed || result.isDismissed) {
          closeLoadingMessage();
        }
      });
    } else {
      clearPage();
      const timeDiff = getRemindTime();
      localStorage.setItem("nextRemindTimeStamp", Math.floor(Date.now() / 1000) + timeDiff);
      const lastTimeString = timeStampToTimeString(timeDiff);
      Swal.fire({
        title: "距离最近一次复习, " + lastTimeString,
        icon: "warning",
        confirmButtonText: "确定",
        customClass: {
          popup: "swal-custom-popup",
          confirmButton: "swal-button--confirm-full-green",
        },
      }).then((result) => {
        if (result.isConfirmed || result.isDismissed) {
          closeLoadingMessage();
          api.toLauncher();
        }
      });
    }
  }
  /**
   * 清空页面容器并暗化背景
   */
  function clearPage() {
    const container = document.querySelector("div.container");
    container.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
    container.innerHTML = "";
  }
  /**
   * 根据笔记列表聚合分类并渲染到页面
   * @param {Array<{category:string, level:number}>} noteList
   * - 依据分类数量决定颜色尺寸（small/medium/large）
   */
  function showCategory(noteList) {
    let categoryList = [];
    let maxLevel = noteList[0].level;
    noteList.forEach(function (note) {
      let isExist = false;
      categoryList.forEach(function (category) {
        if (note.category === category.category) {
          isExist = true;
          category.number++;
        }
      });
      if (!isExist) {
        categoryList.push({
          category: note.category,
          number: 1,
          isRecommend: false,
        });
      }
    });
    categoryList.forEach(function (category) {
      category.color = category.number >= 30 ? "large" : category.number >= 10 ? "medium" : "small";
    });
    let container = document.querySelector("div.container");
    container.innerHTML = "";
    categoryList.forEach((item, index) => {
      let span = document.createElement("span");
      span.className = `${item.color} no-selected ${item.isRecommend ? "recommend" : ""}`;
      span.textContent = `${item.category}: ${item.number} 个`;
      span.setAttribute("data-category", item.category);
      span.setAttribute("data-index", index);
      span.addEventListener("click", function () {
        handleCategoryClick(this);
      });
      container.appendChild(span);
    });
    FontAdjuster.init([".container span"]);
  }
  let handleCategoryDoubleClickTimeStamp = 0;
  let lastClickedSpanObj = null;
  /**
   * 分类项点击：
   * - 切换选中态，播放“保持”提示音
   * - 500ms 内对同一元素二次点击视为“双击”，弹出四合一操作对话框：降级/删除/重命名/升级
   * @param {HTMLSpanElement} spanObj
   */
  function handleCategoryClick(spanObj) {
    spanObj.classList.toggle("selected");
    spanObj.classList.toggle("no-selected");
    if (spanObj.classList.contains("selected")) {
      playHold();
    }
    const currentTime = Date.now();
    if (currentTime - handleCategoryDoubleClickTimeStamp < 500 && lastClickedSpanObj === spanObj) {
      const oldCategoryName = spanObj.dataset.category;
      Swal.fire({
        title: "修改分类操作",
        icon: "warning",
        showConfirmButton: false,
        showCancelButton: false,
        html: `
    <style>
      .custom-container {
        width: 100%;
        text-align: center;
      }
      /* 自定义输入框样式，仿照 swal2-input 的默认样式 */
      .custom-input {
        width: 100%;
        padding: 10px;
        font-size: 16px;
        margin-bottom: 15px;
        box-sizing: border-box;
        border: 1px solid #ccc;
        border-radius: 5px;
      }
		.custom-input:focus {
			outline: none;
			border-radius: 5px; /* 与默认状态一致 */
			box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.6); /* 可选的聚焦效果 */
			}
      /* 按钮组容器，整体圆角、overflow隐藏保证内部按钮没有各自的圆角 */
      .button-group-container {
        display: flex;
        width: 100%;
        border-radius: 5px;
        overflow: hidden;
      }
      /* 每个按钮均等分宽度，并添加动画过渡效果 */
      .button-group-container button {
        flex: 1;
        padding: 12px 0;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #fff;
        line-height: 2;
        transition: transform 0.15s ease;
      }
      /* 点击时缩小效果 */
      .button-group-container button.clicked {
        transform: scale(0.9);
      }
      /* 按钮之间分割线 */
      .button-group-container button:not(:last-child) {
        border-right: 1px solid rgba(255, 255, 255, 0.3);
      }
      /* 按钮悬停效果 */
      .button-group-container button:hover {
        opacity: 0.9;
      }
      /* 自定义各个按钮背景色 */
      .btn-downgrade { background-color: #f39c12; }  /* 降级 */
      .btn-delete  { background-color: #e74c3c; }  /* 删除 */
      .btn-rename  { background-color: #3498db; }  /* 修改 */
      .btn-upgrade { background-color: #2ecc71; }  /* 升级 */
    </style>
    <div class="custom-container">
      <!-- 自定义输入框 -->
      <input type="text" id="custom-input" class="custom-input" value="${oldCategoryName}" placeholder="请输入分类名称"/>
      <!-- 按钮组 -->
      <div class="button-group-container">
        <button id="downgrade-btn" class="btn-downgrade iconfont">&#xe628;</button>
        <button id="delete-btn" class="btn-delete iconfont">&#xe62e;</button>
        <button id="rename-btn" class="btn-rename iconfont">&#xe62b;</button>
        <button id="upgrade-btn" class="btn-upgrade iconfont">&#xe627;</button>
      </div>
    </div>
  `,
        didOpen: () => {
          const popup = Swal.getPopup();
          const inputField = popup.querySelector("#custom-input");
          inputField.focus();
          setTimeout(() => {
            inputField.setSelectionRange(inputField.value.length, inputField.value.length);
          }, 0);
          function animateButton(btn, callback) {
            btn.classList.add("clicked");
            setTimeout(() => {
              btn.classList.remove("clicked");
              callback();
            }, 150);
          }
          popup.querySelector("#downgrade-btn").addEventListener("click", () => {
            animateButton(popup.querySelector("#downgrade-btn"), () => {
              const categoryName = inputField.value.trim();
              if (!categoryName) return;
              const isSubSearch = localStorage.getItem("isSubSearch") === "true";
              const result = downgradeCategory(categoryName, isSubSearch);
              Swal.close();
              if (result && result.status) {
                showMessage(`成功降级了${result.modifiedCount}条笔记!`, 2000, "donesuccess2", "success");
                categoryInit();
              } else {
                showMessage("分类降级失败", 2000, "doneerror2", "error");
              }
            });
          });
          popup.querySelector("#delete-btn").addEventListener("click", () => {
            animateButton(popup.querySelector("#delete-btn"), () => {
              const categoryName = inputField.value.trim();
              if (!categoryName) return;
              const result = deleteCategory(categoryName);
              Swal.close();
              if (result && result.status) {
                showMessage("分类已删除", 2000, "donesuccess2", "success");
                categoryInit();
              } else {
                showMessage("删除失败", 2000, "doneerror2", "error");
              }
            });
          });
          popup.querySelector("#rename-btn").addEventListener("click", () => {
            animateButton(popup.querySelector("#rename-btn"), () => {
              const newCategory = inputField.value.trim();
              if (newCategory === "") {
                showMessage("分类名称不能为空!", 2000, "doneerror2", "error");
                return;
              }
              if (oldCategoryName === newCategory) {
                showMessage("分类名称未发生变化!", 2000, "doneerror2", "error");
                return;
              }
              const result = updateCategoryName(oldCategoryName, newCategory);
              Swal.close();
              if (result && result.status) {
                showMessage("分类名称修改成功!", 2000, "donesuccess2", "success");
                categoryInit();
              } else {
                showMessage("分类名称修改失败!", 2000, "doneerror2", "error");
              }
            });
          });
          popup.querySelector("#upgrade-btn").addEventListener("click", () => {
            animateButton(popup.querySelector("#upgrade-btn"), () => {
              const categoryName = inputField.value.trim();
              if (!categoryName) return;
              const isSubSearch = localStorage.getItem("isSubSearch") === "true";
              const result = upgradeCategory(categoryName, isSubSearch);
              Swal.close();
              if (result && result.status) {
                showMessage(`成功升级了${result.modifiedCount}条笔记!`, 2000, "donesuccess2", "success");
                categoryInit();
              } else {
                showMessage("分类升级失败", 2000, "doneerror2", "error");
              }
            });
          });
        },
      });
    }
    handleCategoryDoubleClickTimeStamp = currentTime;
    lastClickedSpanObj = spanObj;
  }
  /**
   * 在桌面创建快捷方式
   * @param {string} shortCutName - 名称
   * @param {string} shortCutUrl - 目标 URL（widget://）
   */
  function createShortcut(shortCutName, shortCutUrl) {
    var shortcutCreator = api.require("shortcutCreator");
    shortcutCreator.createShortcut(
      {
        name: shortCutName,
        icon: "widget://image/shortcut.png",
        url: shortCutUrl,
      },
      function (ret, err) {
      }
    );
  }
  /**
   * 长按分类：
   * - 若正在播放随机音乐，则切换音乐
   * - 否则打开分类搜索窗口（category-search.html）
   */
  function longPressCategory() {
    if (playListIsPlaying) {
      changeMusic();
      return;
    }
    api.removeEventListener({
      name: "shake",
    });
    api.removeEventListener({
      name: "longpress",
    });
    api.openWin({
      name: "category-search",
      url: "./category-search.html",
      animation: {
        type: "push",
        subType: "from_top",
      },
    });
  }
  /**
   * 备用的长按回退逻辑：弹出输入框并支持
   * - 复制搜索词到剪贴板
   * - 立即搜索并展示命中分类
   * - 或执行子查询模式
   */
  function longPressCategoryback() {
    const currentSearchContent = localStorage.getItem("currentSearchContent") || "多个内容逗号分隔, and 查询";
    Swal.fire({
      title: "🧐想查询什么内容?",
      input: "text",
      inputPlaceholder: currentSearchContent,
      icon: "question",
      showCancelButton: false,
      showDenyButton: true,
      confirmButtonText: "搜索分类",
      denyButtonText: "取消",
      reverseButtons: true,
      customClass: {
        popup: "swal-custom-popup",
        confirmButton: "swal-button--confirm",
        denyButton: "swal-button--deny",
      },
      preConfirm: () => {
        const inputValue = Swal.getInput().value.trim();
        if (!inputValue) {
          Swal.showValidationMessage("查询内容不能为空!");
          return false;
        }
        return inputValue;
      },
    }).then((result) => {
      if (result.isConfirmed || result.isDenied) {
        const searchContent = result.value;
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = searchContent;
        tempTextArea.style.position = "fixed";
        tempTextArea.style.top = "-9999px";
        tempTextArea.style.opacity = "0";
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand("copy");
        document.body.removeChild(tempTextArea);
        if (result.isConfirmed) {
          const inputCategoryList = searchContent.split(/[,，]/).map((item) => item.trim());
          const searchCategoryArray = getSearchedCategory(inputCategoryList, "AND");
          if (searchCategoryArray.length === 0) {
            showMessage("没有查询到内容!", 2000, "doneerror2", "error");
          } else {
            Swal.fire({
              title: `🤩已经查询出 ${searchCategoryArray.length} 个分类!`,
              icon: "success",
              showCancelButton: true,
              confirmButtonText: "查看",
              cancelButtonText: "取消",
              reverseButtons: true,
              customClass: {
                popup: "swal-custom-popup",
                confirmButton: "swal-button--confirm",
                cancelButton: "swal-button--cancel",
              },
            }).then((result) => {
              if (result.isConfirmed) {
                localStorage.setItem("currentSearchContent", searchContent);
                localStorage.removeItem("needSubSearch");
                checkCategoryRemind(searchCategoryArray, false);
              } else if (result.isDenied) {
                createShortcut(searchContent, "widget://study-info.html");
              }
            });
          }
        } else if (result.isDenied) {
          localStorage.setItem("needSubSearch", "true");
          checkCategoryRemind([], true);
        }
      }
    });
  }
};
