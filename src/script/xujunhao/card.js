/**
 * 应用主入口函数 - APICloud 应用就绪时触发
 * @description 初始化卡片学习模块的所有功能和状态
 */
apiready = function () {
  // ==================== 日语分词相关 ====================
  /** @type {Object|null} 缓存的 Kuromoji 分词器实例 */
  let cachedTokenizer = null;

  // ==================== 录音相关 ====================
  /** @type {string} 长按元素的日语文本内容（用于语音识别对比） */
  let currentLongPressElementContext = "";

  /** @type {HTMLElement|null} 当前正在录音的日语示例元素 */
  let currentRecordingJPElement = null;

  // ==================== UI 事件监听 ====================
  window.addEventListener("font-adjusted", () => {
    requestAnimationFrame(checkCardLock);
  });

  // ==================== 学习模式相关 ====================
  /** @type {boolean} 是否为听力模式 */
  let listenMode = false;

  // ==================== 滚动控制常量 ====================
  /** @type {number} 顶部停止缓冲区（像素） */
  const TOP_STOP_BUFFER = 15;

  /** @type {number} 底部阈值（像素） */
  const BOTTOM_THRESHOLD = 40;

  /** @type {boolean} AI 聊天框是否自动滚动到底部 */
  let autoScroll = true;

  // ==================== 音频相关 ====================
  /** @type {Array<string>} 语音备注音频文件路径列表 */
  let voiceCommentList = [];

  /** @type {string} 复制到剪贴板供 AI 分析的文本 */
  let aiClipboardText = "";

  /** @type {Object|null} 保存的音频播放状态（用于恢复播放） */
  let savedPlaybackState = null;

  // ==================== 云存储相关 ====================
  /** @type {Object} 腾讯云 COS 客户端实例 */
  let cosClient;

  /** @type {string} Google API 密钥 */
  const googleApiKey = "googleApiKey";

  /** @type {string} 腾讯云 Secret ID */
  const tencentSecretID = "tencentSecretID";

  /** @type {string} 腾讯云 Secret Key */
  const tencentSecretKey = "tencentSecretKey";

  // ==================== 同步逻辑 ====================
  /** @type {Object} 云端同步逻辑实例 */
  const sync = createSyncLogic();

  // ==================== 音频播放状态 ====================
  /** @type {string} 上次播放的音频 URL */
  let lastAudioUrl = "";

  /** @type {HTMLElement|null} 上次播放的音频容器元素 */
  let lastSidePlayedElement = null;

  // ==================== 设备功能 ====================
  /** @type {boolean} 是否可以震动（摇一摇功能） */
  let canVibrate = true;

  // ==================== AI 对话消息 ====================
  /**
   * AI 对话消息历史
   * @type {Array<{role: string, content: string}>}
   */
  let messages = [
    {
      role: "system",
      content: `
You are a Japanese teacher for Chinese native speakers.
Explain Japanese grammar and vocabulary in a concise and clear way.
Provide kana readings and Chinese translations when necessary.
Do not include example sentences by default, but if the user explicitly requests examples, you may provide them.
When generating Japanese example sentences, always wrap them in <ruby> tags with <rt> for furigana readings, so that kanji are annotated with kana.
Avoid polite or unnecessary phrases.
Make the explanation easy to read and well-structured.
  `.trim(),
    },
  ];

  // ==================== Markdown 解析配置 ====================
  /**
   * 配置 Marked.js 代码高亮和渲染选项
   */
  marked.setOptions({
    highlight: function (code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
    langPrefix: "language-",
    breaks: true,
  });

  // ==================== 页面初始化 ====================
  /**
   * 延迟关闭其他窗口，避免冲突
   */
  setTimeout(() => {
    api.closeWin({
      name: "category",
    });
    api.closeWin({
      name: "list",
    });
    api.closeWin({
      name: "studyInfo",
    });
    api.closeWin({
      name: "category-search",
    });
  }, 500);

  // ==================== 学习模式初始化 ====================
  /**
   * 从本地存储读取并设置学习模式
   */
  if (localStorage.getItem("listenMode") === "true") {
    listenMode = true;
    localStorage.removeItem("listenMode");
  }

  /** @type {boolean} 是否为双击模式 */
  let doubleClickMode = false;
  if (localStorage.getItem("doubleClickMode") === "true") {
    doubleClickMode = true;
    localStorage.removeItem("doubleClickMode");
  }

  // ==================== UI 样式设置 ====================
  /**
   * 在听力模式下为界面添加特殊样式
   */
  if (listenMode) {
    document.querySelector("section").classList.add("listen");
  }

  // ==================== 事件监听器 ====================
  addCardShakeListener();
  addCardLongPressListener();

  // ==================== 音频播放器元素 ====================
  /** @type {HTMLAudioElement} 主音频播放器（用于卡片音频） */
  let audioPlayer = document.querySelector(".audioPlayer");

  /** @type {HTMLAudioElement} 用户录音播放器 */
  let myAudioPlayer = document.querySelector(".my-audio-player");

  // ==================== Web Audio API 相关 ====================
  /** @type {AudioContext|null} 语音备注的音频上下文 */
  let audioCtxForVoiceComment = null;

  /** @type {MediaElementSourceNode|null} 音频源节点 */
  let sourceNode = null;

  /** @type {GainNode|null} 增益节点（用于音量控制） */
  let gainNodeForVoiceComment = null;

  /**
   * 初始化音频增益通道
   * @description 创建 Web Audio API 的音频处理链：音频源 -> 增益节点 -> 输出
   */
  function initGainChannel() {
    if (!audioCtxForVoiceComment) {
      audioCtxForVoiceComment = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!sourceNode) {
      sourceNode = audioCtxForVoiceComment.createMediaElementSource(audioPlayer);
      gainNodeForVoiceComment = audioCtxForVoiceComment.createGain();
      gainNodeForVoiceComment.gain.value = 1.0;
      sourceNode.connect(gainNodeForVoiceComment).connect(audioCtxForVoiceComment.destination);
    }
  }
  initGainChannel();

  // ==================== 音频播放器增强 ====================
  /**
   * 重写音频播放器的 play 方法，添加音量控制逻辑
   * @description 根据音频类型（语音备注或普通音频）设置不同的增益值
   */
  const _origPlay = audioPlayer.play.bind(audioPlayer);
  audioPlayer.play = function () {
    if (audioCtxForVoiceComment.state === "suspended") {
      audioCtxForVoiceComment.resume();
    }
    if (voiceCommentList.includes(audioPlayer.src)) {
      gainNodeForVoiceComment.gain.value = 6.0; // 语音备注音量放大 6 倍
    } else {
      gainNodeForVoiceComment.gain.value = getVolumeByPath(audioPlayer.src);
    }
    return _origPlay();
  };

  // ==================== 音频文件配置 ====================
  /** @type {AudioContext|null} 音频上下文（用于用户录音） */
  let audioCtx = null;

  /** @type {MediaElementSourceNode|null} 音频轨道节点 */
  let track = null;

  // 反馈音效文件路径
  /** @type {string} 长按保持音效 */
  let holdAudioUrl = "./audio/hold2.mp3";

  /** @type {string} 向上滑动音效 */
  let upAudioUrl = "./audio/done2.mp3";

  // 成功音效池（随机播放）
  /** @type {Array<string>} 原始成功音效列表 */
  const originalUpAudioUrlList = [
    "./audio/success/2.mp3",
    "./audio/success/3.mp3",
    "./audio/success/4.mp3",
    "./audio/success/5.mp3",
    "./audio/success/6.mp3",
    "./audio/success/7.mp3",
  ];

  /** @type {Array<string>} 当前可用的成功音效列表 */
  let upAudioUrlList = [...originalUpAudioUrlList];

  /** @type {string} 等待/遗忘音效 */
  let waitAudioUrl = "./audio/forget.mp3";

  /** @type {string} 完成所有卡片音效 */
  let doneAudioUrl = "./audio/6.mp3";

  /** @type {string} 锁定音效 */
  let lockAudioUrl = "./audio/lock.mp3";

  /** @type {boolean} 卡片音频是否自动播放 */
  let cardAudioAutoplay = false;

  /**
   * 播放长按保持音效
   */
  function playHoldAudio() {
    audioPlayer.src = holdAudioUrl;
    audioPlayer.playbackRate = 1.0;
    audioPlayer.play().catch(() => {});
  }

  /**
   * 从音效池中随机获取一个成功音效 URL
   * @returns {string} 随机选中的音效文件路径
   * @description 当音效池为空时，重新填充完整列表
   */
  function getRandomAudioUrl() {
    if (upAudioUrlList.length === 0) {
      upAudioUrlList = [...originalUpAudioUrlList];
    }
    const randomIndex = Math.floor(Math.random() * upAudioUrlList.length);
    return upAudioUrlList.splice(randomIndex, 1)[0];
  }

  /**
   * 播放向上滑动成功音效
   */
  function playUpAudio() {
    audioPlayer.src = upAudioUrl;
    audioPlayer.playbackRate = 1.0;
    audioPlayer.play().catch(() => {});
  }

  /**
   * 播放等待/遗忘音效
   */
  function playWaitAudio() {
    audioPlayer.src = waitAudioUrl;
    audioPlayer.playbackRate = 1.0;
    audioPlayer.play().catch(() => {});
  }

  /**
   * 播放完成所有卡片音效
   */
  function playDoneAudio() {
    audioPlayer.src = doneAudioUrl;
    audioPlayer.playbackRate = 1.0;
    audioPlayer.play().catch(() => {});
  }

  /**
   * 暂停所有音频播放
   * @param {boolean} [locking=false] - 是否锁定音频容器样式
   */
  function pauseAllAudios(locking = false) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    document.querySelectorAll("audio").forEach((audio) => audio.pause());
    document.querySelectorAll(".audio-container").forEach((container) => {
      container.classList.remove("playing");
      container.classList.toggle("locking", locking);
    });
  }

  // ==================== 卡片状态变量 ====================
  /** @type {string} 卡片学习模式（study/autoplay/listen） */
  let cardMode = "";

  /** @type {boolean} 是否为无限循环播放模式 */
  let unlimited = false;

  /** @type {boolean} 录音器是否已打开 */
  let isRecorderOpen = false;

  /** @type {boolean} 是否正在录音 */
  let isRecording = false;

  /** @type {string} 用户录音文件路径 */
  let myAudioSrc = "";

  /** @type {string} 任务进度信息 */
  let taskInfoProgress = "0";

  /** @type {number} 当前卡片索引 */
  let currentCardIndex = 0;

  /** @type {number} 已飞走的卡片数量 */
  let playAwayNumber = 0;

  /** @type {boolean} 是否显示卡片第一面 */
  let isSide1 = true;

  /** @type {boolean} 卡片是否被锁定（因内容过长可滚动） */
  let isCardLocked = false;

  /** @type {boolean} 是否正在摇动设备 */
  let isShaking = false;

  /** @type {boolean} 是否正在长按 */
  let isLongPressing = false;

  /** @type {Object|null} 触摸起始点坐标 */
  let startPoint = null;

  /** @type {string} 当前操作方向（left/right/up/down/none） */
  let currentActionDirection = "none";

  /** @type {boolean} 显示卡片操作锁 */
  let showCardActionLock = false;

  /** @type {boolean} 取消卡片操作锁 */
  let abolishCardActionLock = true;

  /** @type {Array} 所有需要提醒的笔记列表 */
  let allRemindNotes = [];

  /** @type {HTMLElement|null} 当前显示的卡片元素 */
  let currentCard = null;

  /** @type {Object|null} 当前笔记对象 */
  let currentNote = null;

  /** @type {string|null} 首次移动方向（horizontal/vertical） */
  let firstMoveDirection = null;

  /** @type {Object} 音频录制模块 */
  let FNRecordMp3 = api.require("FNRecordMp3");

  /** @type {Object|null} 当前显示的 Toast 消息 */
  let currentToast = null;

  /**
   * 初始化录音功能
   * @param {string} type - 录音类型（"save" 表示保存录音，其他表示语音识别）
   * @description 配置录音器并设置录音文件保存路径监听
   */
  function initializeRecording(type) {
    if (currentToast) {
      currentToast.hideToast();
    }
    FNRecordMp3.open(
      {
        fileDir: api.fsDir + "/recorder/",
      },
      function (ret) {
        if (ret && ret.status) {
          FNRecordMp3.setMp3PathListener({}, function (ret) {
            if (ret && ret.audioPath) {
              myAudioSrc = ret.audioPath;
              let finalSrc = myAudioSrc.startsWith("file://") ? myAudioSrc : "file://" + myAudioSrc;
              if (!voiceCommentList.includes(finalSrc)) {
                voiceCommentList.push(finalSrc);
              }
              if (currentToast) {
                currentToast.hideToast();
              }
              if (type !== "save") {
                if (currentRecordingJPElement) {
                  let recorderElement = currentRecordingJPElement.nextElementSibling;
                  recorderElement.classList.remove("has-ruby");
                  recorderElement.innerHTML = `💡 正在识别语音...`;
                  checkCardLock();
                } else {
                  currentToast = showMessage("正在识别语音...", "long", "nodone", "info");
                }
                const audioId = extractIdFromFileName(myAudioSrc);
                callSttApi(myAudioSrc, audioId);
              }
            } else {
              console.error("Failed to get recording file path via listener");
            }
          });
        } else {
          console.error("Failed to initialize recording");
        }
      }
    );
  }

  /**
   * 开始录音
   * @param {number} [delaySeconds=0] - 延迟开始录音的秒数
   * @description 启动录音并更新波形显示
   */
  function startRecording(delaySeconds = 0) {
    isRecording = true;
    FNRecordMp3.start(
      {
        afterSecond: delaySeconds,
      },
      function (ret) {
        if (ret && ret.status) {
          updateWaveform();
        } else {
          console.error("Failed to start recording");
        }
      }
    );
  }

  /**
   * 停止录音
   * @description 停止录音并暂停所有音频播放
   */
  function stopRecording() {
    isRecording = false;
    pauseAllAudios(false);
    FNRecordMp3.stop(
      {
        second: 0.5,
      },
      function (ret) {
        if (ret && ret.status) {
        } else {
          console.error("Failed to stop recording");
        }
      }
    );
  }

  /**
   * 从文件路径中提取 ID
   * @param {string} filePath - 文件完整路径
   * @returns {string} 文件名（不含扩展名）
   */
  function extractIdFromFileName(filePath) {
    let fileName = filePath.split("/").pop();
    let id = fileName.split(".")[0];
    return id;
  }

  /**
   * 上传 MP3 文件到腾讯云 COS
   * @param {string} path - 本地文件路径
   * @returns {Promise<string>} 返回云端文件 URL
   */
  function uploadMp3ToTencentCloud(path) {
    return new Promise((resolve, reject) => {
      const region = "region";
      const bucket = "bucket";
      const filePath = path;
      const objectName = path.split("/").pop();
      cosClient.uploadObject(
        {
          serviceKey: "fengniao",
          region: region,
          bucket: bucket,
          filePath: filePath,
          object: objectName,
        },
        function (ret, err) {
          if (err) {
            console.error("上传失败：", JSON.stringify(err));
            reject(err);
            return;
          }
          if (!ret) {
            reject(new Error("返回结果为空"));
            return;
          }
          if (ret.result === "success") {
            const fileUrl = `存储桶地址`;
            resolve(fileUrl);
          } else if (ret.result === "processing") {
            let data = ret.data;
            if (typeof data === "string") {
              try {
                data = JSON.parse(data);
              } catch (e) {
                console.error("data 解析失败：", e, data);
                return;
              }
            }
            if (data && data.totalBytesExpectedToSend) {
              const progress = (data.totalBytesSent / data.totalBytesExpectedToSend) * 100;
            } else {
              console.warn("进度信息缺失：", data);
            }
          } else {
            console.warn("未知状态：", ret);
          }
        }
      );
    });
  }

  /**
   * 构建日语分词器（Kuromoji）
   * @returns {Promise<Object>} 返回 Kuromoji 分词器实例
   * @description 使用缓存机制避免重复构建，提高性能
   */
  function buildTokenizer() {
    return new Promise((resolve, reject) => {
      if (cachedTokenizer) {
        resolve(cachedTokenizer);
        return;
      }
      kuromoji
        .builder({
          dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/",
        })
        .build((err, tokenizer) => {
          if (err) reject(err);
          else {
            cachedTokenizer = tokenizer;
            resolve(tokenizer);
          }
        });
    });
  }

  /**
   * 生成差异化 HTML（对比原文和语音识别结果）
   * @param {string} original - 原始日语文本
   * @param {string} stt - 语音识别结果
   * @returns {Promise<string>} 返回标记了差异的 HTML
   * @description 使用最长公共子序列(LCS)算法对比两段文本，用 <u> 标签标记差异部分
   */
  async function generateDiffHTML(original, stt) {
    const tokenizer = await buildTokenizer();
    const tokens1 = tokenizer
      .tokenize(original)
      .filter((t) => t.pos !== "記号")
      .map((t) => t.surface_form);
    const tokens2 = tokenizer
      .tokenize(stt)
      .filter((t) => t.pos !== "記号")
      .map((t) => t.surface_form);
    const dp = Array(tokens1.length + 1)
      .fill(null)
      .map(() => Array(tokens2.length + 1).fill(0));
    for (let i = tokens1.length - 1; i >= 0; i--) {
      for (let j = tokens2.length - 1; j >= 0; j--) {
        if (tokens1[i] === tokens2[j]) {
          dp[i][j] = 1 + dp[i + 1][j + 1];
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }
    let i = 0,
      j = 0;
    let result = "";
    let diffBuffer = "";
    while (i < tokens1.length && j < tokens2.length) {
      if (tokens1[i] === tokens2[j]) {
        if (diffBuffer) {
          result += `<u>${diffBuffer}</u>`;
          diffBuffer = "";
        }
        result += tokens2[j];
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i++;
      } else {
        diffBuffer += tokens2[j];
        j++;
      }
    }
    while (j < tokens2.length) {
      diffBuffer += tokens2[j];
      j++;
    }
    if (diffBuffer) {
      result += `<u>${diffBuffer}</u>`;
    }
    return result;
  }

  /**
   * 调用语音转文字(STT) API
   * @param {string} audioPath - 音频文件路径
   * @param {string} audioId - 音频文件 ID
   * @async
   */
  function callSttApi(audioPath, audioId) {
    uploadMp3ToTencentCloud(audioPath)
      .then((fileUrl) => {
        return fetch("后端接口域名/sttByGoogle.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audioUrl: fileUrl,
            model: "gpt-4o-transcribe",
            language: "ja",
            prompt: "",
          }),
        });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(async (result) => {
        if (result.success && result.transcript) {
          const transcript = result.transcript.replace(/\s+/g, "");
          if (currentToast) {
            currentToast.hideToast();
          }
          if (currentRecordingJPElement) {
            let recorderElement = currentRecordingJPElement.nextElementSibling;
            let diffResultHTML = await generateDiffHTML(currentLongPressElementContext, transcript);
            recorderElement.classList.remove("has-ruby");
            recorderElement.innerHTML = diffResultHTML;
            checkCardLock();
            fetchKanaHTML(diffResultHTML);
          } else {
            currentToast = showMessage(transcript, "long", "donesuccess2", "success");
          }
        } else {
          if (currentToast) {
            currentToast.hideToast();
          }
          if (currentRecordingJPElement) {
            let recorderElement = currentRecordingJPElement.nextElementSibling;
            recorderElement.classList.remove("has-ruby");
            recorderElement.innerHTML = `😭 无法识别语音!`;
            checkCardLock();
          } else {
            currentToast = showMessage("无法识别语音!", 1000, "doneerror2", "error");
          }
          console.error("STT识别失败:", result.error || "未知错误");
        }
      })
      .catch((error) => {
        console.error("调用 STT API 失败:", JSON.stringify(error));
        if (currentToast) {
          currentToast.hideToast();
        }
        if (currentRecordingJPElement) {
          let recorderElement = currentRecordingJPElement.nextElementSibling;
          recorderElement.classList.remove("has-ruby");
          recorderElement.innerHTML = `😭 识别服务异常!`;
          checkCardLock();
        } else {
          currentToast = showMessage("识别服务异常!", 1000, "doneerror2", "error");
        }
      });
  }

  /**
   * 获取日语假名标注的 HTML
   * @param {string} text - 原始日语文本
   * @async
   */
  async function fetchKanaHTML(text) {
    const url = "后端接口域名/kana.php";
    try {
      const pageResp = await fetch(url);
      const pageHtml = await pageResp.text();
      const tokenMatch = pageHtml.match(/name="_token" value="([^"]+)"/);
      if (!tokenMatch) throw new Error("无法获取 _token");
      const token = tokenMatch[1];
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `_token=${encodeURIComponent(token)}&text=${encodeURIComponent(text)}`,
      });
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const lines = doc.querySelectorAll("div.line");
      if (!lines.length) throw new Error("没有找到分词结果");
      let content = lines[0].innerHTML.trim();
      content = content
        .replace(
          /<span class="morpheme">&lt;<\/span><span class="morpheme">u<\/span><span class="morpheme">&gt;<\/span>/g,
          "<u>"
        )
        .replace(
          /<span class="morpheme">&lt;<\/span><span class="morpheme">\/<\/span><span class="morpheme">u<\/span><span class="morpheme">&gt;<\/span>/g,
          "</u>"
        );
      if (currentRecordingJPElement) {
        let recorderElement = currentRecordingJPElement.nextElementSibling;
        if (content.includes("<ruby>")) {
          recorderElement.classList.add("has-ruby");
        }
        recorderElement.innerHTML = content;
        checkCardLock();
      }
    } catch (err) {
      console.error("fetchKanaHTML 错误:", err);
    }
  }

  /**
   * 更新波形显示（录音音量可视化）
   * @description 定期读取录音音量并更新按钮透明度，形成波形效果
   */
  function updateWaveform() {
    const recordButton = document.querySelector(".record");
    if (!recordButton.classList.contains("show")) return;
    FNRecordMp3.getVolume({}, function (ret) {
      if (ret && ret.volume !== undefined) {
        updateButtonOpacity(ret.volume);
      }
    });
    if (recordButton.classList.contains("show")) {
      setTimeout(updateWaveform, 100);
    }
  }

  /**
   * 根据音量更新按钮透明度
   * @param {number} volume - 当前录音音量（0-100）
   * @description 音量越大，按钮透明度越高，形成呼吸灯效果
   */
  function updateButtonOpacity(volume) {
    const recordButton = document.querySelector(".record");
    const maxVolume = 100;
    const minOpacity = 0.1;
    const maxOpacity = 1.0;
    const opacity = Math.min(maxOpacity, minOpacity + (volume / maxVolume) * (maxOpacity - minOpacity));
    recordButton.style.backgroundColor = `rgba(63, 236, 172, ${opacity})`;
  }

  // ==================== 全局变量定义结束 ====================

  // ==================== 应用初始化 ====================
  /**
   * 初始化卡片学习界面
   */
  cardInit();

  // ==================== APICloud 事件监听 ====================
  /**
   * 监听返回键事件
   */
  api.addEventListener(
    {
      name: "keyback",
    },
    function (ret, err) {
      audioPlayer.src = "";
      keyback();
    }
  );

  /**
   * 监听应用恢复事件（从后台回到前台）
   */
  api.addEventListener(
    {
      name: "resume",
    },
    function (ret, err) {
      getStartTimeStamp();
      appToFront("card.html, resume");
      checkNeedSyncByUpdateTimeStamp();
    }
  );

  /**
   * 监听应用暂停事件（进入后台）
   */
  api.addEventListener(
    {
      name: "pause",
    },
    function (ret, err) {
      appToBack();
    }
  );

  /**
   * 添加卡片摇动监听器
   * @description 监听设备摇动事件，用于快速切换播放模式
   */
  function addCardShakeListener() {
    removeCardShakeListener();
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
          handleShake();
        }
        setTimeout(() => {
          isShaking = false;
        }, 1000);
      }
    );
  }

  /**
   * 移除卡片摇动监听器
   */
  function removeCardShakeListener() {
    api.removeEventListener({
      name: "shake",
    });
  }

  /**
   * 添加卡片长按监听器
   * @description 监听设备长按事件，用于显示功能菜单
   */
  function addCardLongPressListener() {
    removeCardLongPressListener();
    api.addEventListener(
      {
        name: "longpress",
      },
      function (ret, err) {
        if (isLongPressing || isShaking) {
          return false;
        }
        isLongPressing = true;
        handleLongPress();
        setTimeout(() => {
          isLongPressing = false;
        }, 1000);
      }
    );
  }

  /**
   * 移除卡片长按监听器
   */
  function removeCardLongPressListener() {
    api.removeEventListener({
      name: "longpress",
    });
  }

  // ==================== 核心业务逻辑函数 ====================

  /**
   * 处理长按事件
   * @description 长按时显示功能按钮组
   */
  function handleLongPress() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer) {
      return;
    }
    const editContainer = document.querySelector(".edit-container");
    if (editContainer) {
      return;
    }
    pauseAllAudios();
    showButtonGroup9();
  }

  /**
   * 显示 9 个功能按钮组
   * @description 长按卡片后显示的功能菜单，包含录音、AI、备注等功能
   */
  function showButtonGroup9() {
    if (isRecorderOpen) {
      closeRecordGroup();
    }
    const buttonsGroupContainer = document.querySelector(".buttons-container");
    const buttonsPanel = document.querySelector(".buttons-panel");
    buttonsGroupContainer.classList.add("show");
    const button1 = document.querySelector(".neumorphic-button:nth-child(1)");
    const button2 = document.querySelector(".neumorphic-button:nth-child(2)");
    const button3 = document.querySelector(".neumorphic-button:nth-child(3)");
    const button4 = document.querySelector(".neumorphic-button:nth-child(4)");
    const button5 = document.querySelector(".neumorphic-button:nth-child(5)");
    const button6 = document.querySelector(".neumorphic-button:nth-child(6)");
    const button7 = document.querySelector(".neumorphic-button:nth-child(7)");
    const button8 = document.querySelector(".neumorphic-button:nth-child(8)");
    const button9 = document.querySelector(".neumorphic-button:nth-child(9)");
    button1.onclick = function () {
      pauseAllAudios(true);
      shakeThePhone();
      closeButtonsGroup9();
      recordToCheck("save");
    };
    button2.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      aiBtnClickForButtonsGroup9();
    };
    button3.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      helpNoteComment();
    };
    button4.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      setTimeout(() => {
        forgetBtnClickForButtonsGroup9();
      }, 350);
    };
    button5.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      canVibrate = !canVibrate;
      if (canVibrate) {
        addCardShakeListener();
        this.style.backgroundImage = "url('./image/noshake.png')";
        showMessage("已激活震动", 1000, "donesuccess2", "success");
      } else {
        removeCardShakeListener();
        this.style.backgroundImage = "url('./image/shake.png.png')";
        showMessage("已关闭震动!", 2000, "doneerror2", "error");
      }
    };
    button6.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      setTimeout(() => {
        rememberBtnClickForButtonsGroup();
      }, 350);
    };
    button7.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      setTimeout(() => {
        deleteBtnClickForButtonsGroup9();
      }, 350);
    };
    button8.onclick = function () {
      currentRecordingJPElement = null;
      jpLongpress();
    };
    button9.onclick = function () {
      shakeThePhone();
      closeButtonsGroup9();
      editBtnClickForButtonsGroup9();
    };
  }

  /**
   * 初始化腾讯云 COS 客户端
   * @param {string} secretID - 腾讯云 Secret ID
   * @param {string} secretKey - 腾讯云 Secret Key
   * @description 配置永久密钥和传输管理器
   */
  function initializeTencentCloudCosClient(secretID, secretKey) {
    cosClient = api.require("cosClient");
    cosClient.setupPermanentCredentail({
      secretID: secretID,
      secretKey: secretKey,
    });
    cosClient.registerTransferManger({
      serviceKey: "fengniao",
      useHttps: true,
      timeOut: 30000000,
    });
  }

  /**
   * 帮助添加或编辑笔记备注
   * @description 弹出对话框允许用户添加或修改当前卡片的备注信息
   */
  function helpNoteComment() {
    const currentSide2 = currentNote.side2;
    let commentText = extractComment(currentSide2);
    Swal.fire({
      title: "😎添加备注?",
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
      if (result.isConfirmed) {
        shakeThePhone();
        let newComment = result.value.trim();
        const updatedSide2 = updateSide2WithComment(currentSide2, newComment);
        currentNote.side2 = updatedSide2;
        updateCardSide2(currentNote.id, updatedSide2);
        showMessage("修改备注成功!", 1000, "donesuccess2", "success");
        if (newComment !== "") {
          if (!/[。？！；：、.,?!;:]/.test(newComment.slice(-1))) {
            newComment += "。";
          }
          newComment = "✎ " + newComment;
        }
        const commentP = currentCard.querySelector(".side2 p#comment-tag");
        commentP.innerHTML = marked.parseInline(newComment);
        if (newComment === "") {
          commentP.classList.add("hide");
        } else {
          commentP.classList.remove("hide");
        }
        setTimeout(checkCardLock, 550);
      }
      restorePlaybackState();
    });
  }

  /**
   * 更新 side2 中的备注内容
   * @param {string} side2 - 卡片背面原始内容
   * @param {string} newComment - 新的备注文本
   * @returns {string} 更新后的 side2 内容
   * @description 在 side2 中添加或更新以 ✎ 开头的备注行
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
   * 从文本中提取备注内容
   * @param {string} text - 包含备注的文本
   * @returns {string} 提取的备注内容（不含 ✎ 符号）
   * @description 查找以 ✎ 开头的行并提取备注文本
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
   * 处理摇动事件
   * @description 摇动设备时切换无限循环播放模式或播放音频
   */
  function handleShake() {
    const buttonsGroupContainer = document.querySelector(".buttons-container");
    if (buttonsGroupContainer.classList.contains("show")) {
      return;
    }
    const chatContainer = document.querySelector(".chat-container");
    const editContainer = document.querySelector(".edit-container");
    if (chatContainer || editContainer) return;
    if (listenMode) {
      playCardAudio(isSide1);
      return;
    }
    if (unlimited) {
      exitUnlimitedMode();
    } else {
      enterUnlimitedMode();
    }
  }

  /**
   * 保存当前音频播放状态
   * @description 保存音频源、播放位置、播放速率等状态，用于稍后恢复
   */
  function savePlaybackState() {
    savedPlaybackState = {
      src: audioPlayer.src,
      currentTime: audioPlayer.currentTime,
      playbackRate: audioPlayer.playbackRate,
      loop: audioPlayer.loop,
      isPlaying: !audioPlayer.paused,
      element: lastSidePlayedElement,
      unlimited: !audioPlayer.paused,
    };
  }
  function restorePlaybackState() {
    if (!savedPlaybackState) return;
    audioPlayer.pause();
    audioPlayer.src = "";
    audioPlayer.src = savedPlaybackState.src;
    audioPlayer.currentTime = savedPlaybackState.currentTime;
    audioPlayer.playbackRate = savedPlaybackState.playbackRate;
    audioPlayer.loop = savedPlaybackState.loop;
    unlimited = savedPlaybackState.unlimited;
    if (savedPlaybackState.isPlaying) {
      audioPlayer.currentTime = 0;
      audioPlayer.play().catch(() => {});
      if (savedPlaybackState.element) {
        document.querySelectorAll(".audio-container.playing").forEach((el) => el.classList.remove("playing"));
        savedPlaybackState.element.classList.add("playing");
      }
    }
    savedPlaybackState = null;
  }

  /**
   * 进入无限循环播放模式
   * @param {string} [src=""] - 音频文件 URL
   * @param {HTMLElement|null} [element=null] - 音频容器元素
   * @description 循环播放指定音频，播放速率根据卡片等级调整
   */
  function enterUnlimitedMode(src = "", element = null) {
    const playRate = Math.round((1 + Number(currentNote.level) * 0.2) * 10) / 10;
    const audioContainers = document.querySelectorAll(".audio-container");
    audioContainers.forEach((audioContainer) => {
      audioContainer.classList.remove("playing");
    });
    audioPlayer.src = "";
    audioPlayer.pause();
    src = src || lastAudioUrl || (isSide1 ? currentNote.audio1 : currentNote.audio2);
    element =
      element ||
      lastSidePlayedElement ||
      (isSide1
        ? currentCard.querySelector(".side1 .audio-container")
        : currentCard.querySelector(".side2 .audio-container"));
    unlimited = true;
    audioPlayer.currentTime = 0;
    audioPlayer.src = src;
    lastAudioUrl = src;
    lastSidePlayedElement = element;
    audioPlayer.loop = !listenMode;
    audioPlayer.playbackRate = playRate;
    audioPlayer.play().catch(() => {});
    if (!listenMode) {
      element.classList.add("playing");
    }
  }

  /**
   * 显示录音控制组
   * @param {string} type - 录音类型（"save" 或其他）
   * @description 创建并显示录音界面，包含录音按钮、取消/保存、确认、重置和播放按钮
   */
  function showRecordGroup(type) {
    isRecorderOpen = true;
    removeCardShakeListener();
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "button-group-new";
    buttonGroup.id = "buttonGroup";
    const recordButton = document.createElement("button");
    recordButton.className = "record";
    buttonGroup.appendChild(recordButton);
    const cancelOrSaveButton = document.createElement("button");
    if (type === "save") {
      cancelOrSaveButton.className = "btn-new save";
    } else {
      cancelOrSaveButton.className = "btn-new cancel";
    }
    buttonGroup.appendChild(cancelOrSaveButton);
    const confirmButton = document.createElement("button");
    confirmButton.className = "btn-new confirm";
    buttonGroup.appendChild(confirmButton);
    const resetButton = document.createElement("button");
    resetButton.className = "btn-new reset";
    buttonGroup.appendChild(resetButton);
    const myAudioButton = document.createElement("button");
    myAudioButton.className = "my-audio";
    buttonGroup.appendChild(myAudioButton);
    document.body.appendChild(buttonGroup);
    cancelOrSaveButton.classList.remove("show");
    confirmButton.classList.remove("show");
    resetButton.classList.remove("show");
    myAudioButton.classList.remove("show");
    recordButton.classList.add("show");
    setTimeout(() => {
      buttonGroup.classList.add("show");
    }, 10);
    recordButton.addEventListener("click", function () {
      stopRecording();
      recordButton.classList.remove("show");
      cancelOrSaveButton.classList.add("show");
      confirmButton.classList.add("show");
      resetButton.classList.add("show");
    });
    cancelOrSaveButton.addEventListener("click", function () {
      closeRecordGroup();
      if (type === "save") {
        saveRecording();
      }
    });
    confirmButton.addEventListener("click", function () {
      myAudioPlayer.src = myAudioSrc;
      cancelOrSaveButton.classList.remove("show");
      confirmButton.classList.remove("show");
      resetButton.classList.remove("show");
      myAudioButton.classList.add("show");
      myAudioButton.click();
    });
    resetButton.addEventListener("click", function () {
      if (currentRecordingJPElement) {
        let recorderElement = currentRecordingJPElement.nextElementSibling;
        recorderElement.classList.remove("has-ruby");
        recorderElement.innerHTML = `🎙 正在录音...`;
        checkCardLock();
      }
      pauseAllAudios(true);
      shakeThePhone();
      cancelOrSaveButton.classList.remove("show");
      confirmButton.classList.remove("show");
      resetButton.classList.remove("show");
      myAudioButton.classList.remove("show");
      recordButton.classList.add("show");
      initializeRecording(type);
      startRecording(0);
    });
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!track) {
      track = audioCtx.createMediaElementSource(myAudioPlayer);
      const gainNode = audioCtx.createGain();
      track.connect(gainNode).connect(audioCtx.destination);
      gainNode.gain.value = 6.0;
    }
    myAudioPlayer.addEventListener("ended", function () {
      myAudioButton.classList.remove("show");
      cancelOrSaveButton.classList.add("show");
      confirmButton.classList.add("show");
      resetButton.classList.add("show");
    });
    myAudioButton.addEventListener("click", function () {
      if (myAudioPlayer.paused) {
        pauseAllAudios(false);
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }
        myAudioPlayer.currentTime = 0;
        myAudioPlayer.play().catch(() => {});
      } else {
        myAudioPlayer.pause();
        myAudioButton.classList.remove("show");
        cancelOrSaveButton.classList.add("show");
        confirmButton.classList.add("show");
        resetButton.classList.add("show");
      }
    });
  }

  /**
   * 开始录音检查流程
   * @param {string} type - 录音类型（"save" 表示保存录音）
   * @description 初始化或重新开始录音，显示录音界面
   */
  function recordToCheck(type) {
    const buttonGroup = document.getElementById("buttonGroup");

    if (!buttonGroup) {
      showRecordGroup(type);
      initializeRecording(type);
      startRecording(0);
      return;
    }

    if (isRecording) {
      stopRecording();
    }
    const recordButton = buttonGroup.querySelector(".record");
    const cancelOrSaveButton = buttonGroup.querySelector(type === "save" ? ".save" : ".cancel");
    const confirmButton = buttonGroup.querySelector(".confirm");
    const resetButton = buttonGroup.querySelector(".reset");
    const myAudioButton = buttonGroup.querySelector(".my-audio");
    cancelOrSaveButton.classList.remove("show");
    confirmButton.classList.remove("show");
    resetButton.classList.remove("show");
    myAudioButton.classList.remove("show");
    recordButton.classList.add("show");
    initializeRecording(type);
    startRecording(0);
  }

  /**
   * 保存录音文件
   * @description 将录音文件添加到笔记的 side2 中，并更新语音备注音频容器
   */
  function saveRecording() {
    insertUrl(myAudioSrc, myAudioSrc);
    updateCardSide2ToHandleVoiceComment();
    const updateNoteData = {
      id: currentNote.id,
      side2: currentNote.side2,
    };
    updateNoteByData(updateNoteData);
    const voiceCommentAudio = document.querySelector("audio.voice-comment");
    voiceCommentAudio.src = myAudioSrc;
    let finalSrc = myAudioSrc.startsWith("file://") ? myAudioSrc : "file://" + myAudioSrc;
    if (!voiceCommentList.includes(finalSrc)) {
      voiceCommentList.push(finalSrc);
    }
    const audioContainer = voiceCommentAudio.previousElementSibling;
    audioContainer.classList.remove("hide");
    const hr = document.querySelector("hr.voice-comment-separator");
    if (hr) {
      hr.classList.remove("hide");
    }
    showMessage("录音已保存!", 1000, "save4", "success");
  }

  /**
   * 更新卡片 side2 以处理语音备注
   * @description 在 side2 中添加或更新语音备注的 audio 标签
   */
  function updateCardSide2ToHandleVoiceComment() {
    if (!currentNote.side2) return;
    if (currentNote.side2.includes('class="voice-comment"')) {
      currentNote.side2 = currentNote.side2.replace(
        /(<audio[^>]*class="voice-comment"[^>]*src=")[^"]*("[^>]*><\/audio>)/,
        `$1${myAudioSrc}$2`
      );
    } else {
      currentNote.side2 += `\n\n<hr/>\n\n<audio class="voice-comment" controls src="${myAudioSrc}"></audio>`;
    }
  }

  /**
   * 关闭录音控制组
   * @description 移除录音界面，停止录音，恢复震动监听
   */
  function closeRecordGroup() {
    if (currentToast) {
      currentToast.hideToast();
    }
    if (currentRecordingJPElement) {
      let recorderElement = currentRecordingJPElement.nextElementSibling;
      if (recorderElement && recorderElement.classList.contains("jp-recorder")) {
        recorderElement.remove();
        checkCardLock();
      }
      currentRecordingJPElement = null;
    }
    isRecorderOpen = false;
    if (canVibrate) {
      addCardShakeListener();
    }
    const buttonGroup = document.getElementById("buttonGroup");
    if (!buttonGroup) return;
    const recordButton = buttonGroup.querySelector(".record");
    const cancelOrSaveButton = buttonGroup.querySelector(".cancel") || buttonGroup.querySelector(".save");
    const confirmButton = buttonGroup.querySelector(".confirm");
    const resetButton = buttonGroup.querySelector(".reset");
    const myAudioButton = buttonGroup.querySelector(".my-audio");
    recordButton.classList.remove("show");
    cancelOrSaveButton.classList.remove("show");
    confirmButton.classList.remove("show");
    resetButton.classList.remove("show");
    myAudioButton.classList.remove("show");
    buttonGroup.classList.remove("show");
    recordButton.removeEventListener("click", function () {});
    cancelOrSaveButton.removeEventListener("click", function () {});
    confirmButton.removeEventListener("click", function () {});
    resetButton.removeEventListener("click", function () {});
    myAudioButton.removeEventListener("click", function () {});
    setTimeout(() => {
      buttonGroup.remove();
    }, 500);
    stopRecording();
  }

  /**
   * 显示编辑容器
   * @description 创建并显示笔记编辑界面，允许用户编辑卡片的 side1 和 side2
   */
  function showEditContainer() {
    const editContainer = document.createElement("div");
    editContainer.className = "edit-container";
    const textarea = document.createElement("textarea");
    textarea.className = "note-editor";
    textarea.id = "note-editor";
    editContainer.appendChild(textarea);
    document.body.appendChild(editContainer);
    setTimeout(() => {
      editContainer.classList.add("show");
    }, 10);
    textarea.value = `${currentNote.side1}\n\n---\n\n${currentNote.side2}`;
    textarea.addEventListener("focus", () => {
      setTimeout(() => {
        const rect = textarea.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!isVisible) {
          textarea.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 300);
    });
  }
  function hideEditContainer() {
    const editContainer = document.querySelector(".edit-container");
    editContainer.classList.remove("show");
    setTimeout(() => {
      editContainer.remove();
    }, 500);
  }

  /**
   * 关闭九宫格按钮组
   * @description 移除按钮组并清除所有按钮的点击事件监听
   */
  function closeButtonsGroup9() {
    const buttonsGroupContainer = document.querySelector(".buttons-container");
    const button1 = document.querySelector(".neumorphic-button:nth-child(1)");
    const button2 = document.querySelector(".neumorphic-button:nth-child(2)");
    const button3 = document.querySelector(".neumorphic-button:nth-child(3)");
    const button4 = document.querySelector(".neumorphic-button:nth-child(4)");
    const button5 = document.querySelector(".neumorphic-button:nth-child(5)");
    const button6 = document.querySelector(".neumorphic-button:nth-child(6)");
    const button7 = document.querySelector(".neumorphic-button:nth-child(7)");
    const button8 = document.querySelector(".neumorphic-button:nth-child(8)");
    const button9 = document.querySelector(".neumorphic-button:nth-child(9)");
    button1.onclick = null;
    button2.onclick = null;
    button3.onclick = null;
    button4.onclick = null;
    button5.onclick = null;
    button6.onclick = null;
    button7.onclick = null;
    button8.onclick = null;
    button9.onclick = null;
    buttonsGroupContainer.classList.remove("show");
  }

  /**
   * 返回键处理函数
   * @param {string} [preAction=""] - 前置操作类型
   * @description 处理返回键逻辑，根据当前状态执行不同的返回操作
   */
  function keyback(preAction = "") {
    if (Swal.isVisible()) {
      Swal.close();
      if (preAction !== "delete") {
        return;
      }
    }
    const buttonsGroupContainer = document.querySelector(".buttons-container");
    if (buttonsGroupContainer.classList.contains("show")) {
      closeButtonsGroup9();
      return;
    }
    if (unlimited) {
      exitUnlimitedMode();
      return;
    }
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer) {
      hideChatContainer();
      return;
    }
    const editContainer = document.querySelector(".edit-container");
    if (editContainer) {
      const noteEditor = editContainer.querySelector(".note-editor");
      noteEditor.blur();
      Swal.fire({
        title: "😎需要保存编辑吗?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "保存",
        cancelButtonText: "取消",
        reverseButtons: true,
        customClass: {
          popup: "swal-custom-popup",
          confirmButton: "swal-button--confirm",
          cancelButton: "swal-button--cancel",
        },
        didOpen: (popup) => {
          popup.focus();
        },
      }).then((result) => {
        if (result.isConfirmed) {
          const noteContent = noteEditor.value;
          const parts = noteContent.split("\n\n---\n\n");
          const EditorSide1 = parts[0].trim();
          const EditorSide2 = parts[1].trim();
          currentNote.side1 = EditorSide1;
          currentNote.side2 = EditorSide2;
          currentCard.remove();
          showCards("left");
          const updateNoteData = {
            id: currentNote.id,
            side1: EditorSide1,
            side2: EditorSide2,
          };
          updateNoteByData(updateNoteData);
          hideEditContainer();
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          hideEditContainer();
        }
      });
      return;
    }
    if (isRecorderOpen) {
      closeRecordGroup();
      return;
    }
    api.removeEventListener({
      name: "shake",
    });
    api.removeEventListener({
      name: "longpress",
    });
    const listToCardDirection = localStorage.getItem("listToCardDirection");
    let subType = "";
    if (listToCardDirection === "left") {
      subType = "from_left";
    } else {
      subType = "from_right";
    }
    let openTime = 0;
    setTimeout(() => {
      if (parseInt(taskInfoProgress) > 0) {
        api.openWin({
          name: "list",
          url: "./list.html",
          animation: {
            type: "push", //动画类型（详见动画类型常量）
            subType: subType, //动画子类型（详见动画子类型常量）
          },
        });
      } else {
        api.openWin({
          name: "category",
          url: "./category.html",
          animation: {
            type: "push", //动画类型（详见动画类型常量）
            subType: "from_left", //动画子类型（详见动画子类型常量）
          },
        });
      }
    }, openTime);
  }

  /**
   * 显示卡片操作反馈
   * @description 根据滑动方向显示不同的操作提示和音效
   */
  function showCardAction() {
    if (showCardActionLock) {
      return false;
    }
    showCardActionLock = true;
    abolishCardActionLock = false;
    shakeThePhone();
    if (currentActionDirection == "left") {
      currentCard.classList.add("hold");
    }
    if (currentActionDirection == "right") {
      currentCard.classList.add("hold");
    }
    if (currentActionDirection == "up") {
      currentCard.classList.add("done");
      let content = "";
      let timeDiff = getRemindTimeDiffByLevelNumber(Number(currentNote.level) + 1);
      if (timeDiff === 3153600000) {
        content = "已经完全记住了😎";
      } else {
        let lastTimeString = timeStampToTimeString(timeDiff);
        content = "距离下次提醒, " + lastTimeString;
      }
      showUpMessage(content);
    }
    if (currentActionDirection == "down") {
      currentCard.classList.add("fuck");
      let content = "";
      let timeDiff = getRemindTimeDiffByLevelNumber(0);
      let lastTimeString = timeStampToTimeString(timeDiff);
      content = "距离下次提醒, " + lastTimeString;
      showDownMessage(content);
    }
  }

  /**
   * 取消卡片操作
   * @description 将卡片恢复到原始位置，清除操作状态
   */
  function abolishCardAction() {
    if (abolishCardActionLock) {
      return false;
    }
    abolishCardActionLock = true;
    showCardActionLock = false;
    shakeThePhone();
    currentCard.classList.remove(
      "delete",
      "nodelete",
      "edit",
      "noedit",
      "up",
      "down",
      "done",
      "wait",
      "forget",
      "fuck",
      "hold"
    );
    closeAllActionMessage();
    currentActionDirection = "none";
  }

  /**
   * 显示学习进度
   * @description 在界面上显示当前卡片索引和总卡片数
   */
  function showProgress() {
    const progress = document.createElement("div");
    progress.className = "progress";
    progress.textContent = `${currentCardIndex + 1}/${allRemindNotes.length}`;
    document.body.appendChild(progress);
  }

  /**
   * 卡片初始化函数
   * @description 初始化卡片学习流程，播放开始音效，加载笔记数据，选择学习模式
   * @async
   */
  async function cardInit() {
    if (listenMode) {
      audioPlayer.src = "./audio/1.mp3";
      audioPlayer.playbackRate = 1.0;
      audioPlayer.play().catch(() => {});
    } else {
      audioPlayer.src = "./audio/5.mp3";
      audioPlayer.playbackRate = 1.0;
      audioPlayer.play().catch(() => {});
    }
    api.cancelNotification({ id: -1 });
    api.setAppIconBadge({ badge: 0 });
    closeAllActionMessage();
    closeAllEnvMessage();
    const clickedNoteIdArr = JSON.parse(api.pageParam.clickedNoteIdArr);
    allRemindNotes = queryNotesByIds(clickedNoteIdArr);
    localStorage.removeItem("previousPage");
    if (doubleClickMode || listenMode) {
      showCards("left");
      return;
    }
    Swal.fire({
      title: "😎请选择模式",
      icon: "question",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "💯学习",
      denyButtonText: "📣自动",
      cancelButtonText: "📋观看",
      reverseButtons: true,
      customClass: {
        popup: "swal-custom-popup",
        confirmButton: "swal-button--study",
        denyButton: "swal-button--autoplay",
        cancelButton: "swal-button--look",
      },
      didOpen: (popup) => {
        popup.focus();
      },
    }).then((result) => {
      if (result.isConfirmed) {
        cardMode = "study";
      } else if (result.isDenied) {
        cardMode = "autoplay";
        cardAudioAutoplay = true;
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        cardMode = "listen";
      }
      showCards("left");
    });
  }

  /**
   * 返回到分类页面
   * @description 关闭卡片页面，打开分类选择页面
   */
  function cardBack() {
    api.removeEventListener({
      name: "shake",
    });
    api.removeEventListener({
      name: "longpress",
    });
    setTimeout(() => {
      api.openWin({
        name: "category",
        url: "./category.html",
        animation: {
          type: "push", //动画类型（详见动画类型常量）
          subType: "from_left", //动画子类型（详见动画子类型常量）
        },
      });
    }, 500);
  }

  /**
   * 播放卡片音频
   * @param {boolean} isSide1 - 是否播放第一面的音频
   * @description 根据卡片等级调整播放速率，处理音频切换延迟
   */
  function playCardAudio(isSide1) {
    const playRate = Math.round((1 + Number(currentNote.level) * 0.2) * 10) / 10;
    const playAudioUrl = isSide1 ? currentNote.audio1 : currentNote.audio2;
    const holdConditions = ["hold2.mp3", "forget.mp3", "done2.mp3", "1.mp3"];
    const delayMap = {
      "done2.mp3": 250,
      "hold2.mp3": 150,
      "forget.mp3": 250,
      "1.mp3": 300,
    };
    const currentAudioFile = audioPlayer.src.split("/").pop();
    if (!audioPlayer.paused && holdConditions.includes(currentAudioFile)) {
      const delay = delayMap[currentAudioFile];
      setTimeout(() => {
        switchAudio(playAudioUrl, playRate);
      }, delay);
      return;
    }
    switchAudio(playAudioUrl, playRate);
  }

  /**
   * 切换音频并播放
   * @param {string} playAudioUrl - 音频文件 URL
   * @param {number} [playRate=1.0] - 播放速率
   * @description 加载音频后设置播放速率并开始播放
   */
  function switchAudio(playAudioUrl, playRate = 1.0) {
    audioPlayer.src = playAudioUrl;
    audioPlayer.addEventListener("loadeddata", function () {
      audioPlayer.playbackRate = playRate;
      audioPlayer.play().catch(() => {});
    });
  }
  function playAudio1() {
    if (!currentCard) {
      return;
    }
    audioPlayer.src = currentNote.audio1;
    audioPlayer.addEventListener("loadeddata", function () {
      audioPlayer.play().catch(() => {});
    });
  }
  function playAudio2() {
    if (!currentCard) {
      return;
    }
    audioPlayer.src = currentNote.audio2;
    audioPlayer.addEventListener("loadeddata", function () {
      audioPlayer.play().catch(() => {});
    });
  }

  /**
   * 处理键盘按键事件
   * @param {KeyboardEvent} event - 键盘事件对象
   * @description 监听回车键发送消息（Shift+回车换行）
   */
  function handleKeyPress(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  /**
   * 自动调整 textarea 高度
   * @param {HTMLTextAreaElement} textarea - 文本输入框元素
   * @description 根据内容自动调整输入框高度
   */
  function adjustTextareaHeight(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  /** @type {string} SSE 数据缓冲区 */
  let sseBuffer = "";

  /**
   * 解析 OpenAI Chat Completion 的 SSE 片段
   * @param {string} chunk - 新收到的文本片段
   * @returns {string} 本次新增的正文
   * @description 解析服务器发送事件(SSE)流，提取 AI 回复的增量内容
   */
  function parseStreamedData(chunk) {
    sseBuffer += chunk;
    let parsedText = "";
    while (true) {
      const newLinePos = sseBuffer.indexOf("\n");
      if (newLinePos === -1) break;
      const rawLine = sseBuffer.slice(0, newLinePos).trimEnd();
      sseBuffer = sseBuffer.slice(newLinePos + 1);
      if (!rawLine.startsWith("data:")) continue;
      const data = rawLine.replace(/^data:\s*/, "");
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        parsedText += json.choices?.[0]?.delta?.content ?? "";
      } catch {
        sseBuffer = rawLine + "\n" + sseBuffer;
        break;
      }
    }
    return parsedText;
  }

  /**
   * 发送消息到 AI
   * @async
   */
  function sendMessage() {
    const userInput = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");
    const userMessage = userInput.value.trim();
    if (userMessage !== "") {
      autoScroll = true;
      const parsed = getImageUrlsAndCleanText(userMessage);
      const cleanedText = parsed.text;
      const imageUrls = parsed.imageUrls;
      const content = [
        { type: "text", text: cleanedText },
        ...imageUrls.map((url) => ({
          type: "image_url",
          image_url: { url },
        })),
      ];
      messages.push({ role: "user", content });
      const userMessageElement = createMessageElement(userMessage, "user");
      chatBox.appendChild(userMessageElement);
      userInput.value = "";
      userInput.style.height = "auto";
      scrollToBottom(true);

      const apiKey = "自己的APIKey";
      fetch("后端AI接口地址", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: messages,
          stream: true,
        }),
      })
        .then(async (response) => {
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let done = false;
          let aiMessageContent = "";
          const aiMessageElement = createMessageElement("", "ai");
          const aiMessageContentElement = aiMessageElement.querySelector(".message-content");
          aiMessageContentElement.addEventListener("touchstart", () => {
            if (autoScroll) {
              autoScroll = false;
            }
          });
          chatBox.appendChild(aiMessageElement);
          scrollToBottom();
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            const chunk = decoder.decode(value, { stream: true });
            const parsedChunk = parseStreamedData(chunk);
            if (parsedChunk) {
              aiMessageContent += parsedChunk;
              const htmlContent = marked.parse(aiMessageContent);
              aiMessageContentElement.innerHTML = htmlContent;
              hljs.highlightAll();
              scrollToBottom();
            }
          }
          messages.push({ role: "assistant", content: aiMessageContent });
          if (aiMessageContent) {
            const htmlContent = marked.parse(aiMessageContent);
            aiMessageContentElement.innerHTML = htmlContent;
            hljs.highlightAll();
            scrollToBottom();
          }
          attachClickToBTags(aiMessageContentElement);
        })
        .catch((error) => {
          console.error("Error:", error);
          const errorMessageElement = createMessageElement("无法获取 AI 响应，请稍后再试。", "error");
          chatBox.appendChild(errorMessageElement);
          scrollToBottom(true);
        });
    }
  }

  /**
   * 为 AI 回复中的粗体标签添加点击事件
   * @param {HTMLElement} container - AI 消息容器元素
   * @description 点击粗体词汇可快速提问
   */
  function attachClickToBTags(container) {
    if (!container) return;
    const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6, th");
    headings.forEach((heading) => {
      if (!heading.querySelector("strong")) {
        const strongTag = document.createElement("strong");
        strongTag.innerHTML = heading.innerHTML;
        heading.innerHTML = "";
        heading.appendChild(strongTag);
      }
    });
    const tags = container.querySelectorAll("b, strong");
    tags.forEach((tag) => {
      tag.style.cursor = "pointer";
      tag.style.display = "inline-block";
      tag.addEventListener("click", (e) => {
        e.stopPropagation();
        const userInput = document.getElementById("user-input");
        userInput.value += `「${tag.textContent.trim()}」?`;
        tag.classList.add("scale-animation");
        tag.addEventListener(
          "animationend",
          () => {
            tag.classList.remove("scale-animation");
          },
          { once: true }
        );
      });
    });
  }

  /**
   * 获取图片 URL 并清理文本
   * @param {string} originalText - 原始文本（可能包含 Markdown 图片）
   * @param {boolean} [includeImages=false] - 是否包含图片 URL
   * @returns {{text: string, imageUrls: Array<string>}} 清理后的文本和图片 URL 列表
   * @description 从 Markdown 文本中提取图片 URL，并清理注释行
   */
  function getImageUrlsAndCleanText(originalText, includeImages = false) {
    const imageLineRegex = /^!\[.*?\]\((https?:\/\/[^\s)]+)\)$/gm;
    const imageUrls = [...originalText.matchAll(imageLineRegex)].map((m) => m[1]);
    let cleanedText = originalText
      .replace(imageLineRegex, "")
      .replace(/^📣.*$/gm, "")
      .replace(/^✎.*$/gm, "")
      .replace(/\n{2,}/g, "\n\n")
      .trim();
    return {
      text: cleanedText,
      imageUrls: includeImages ? imageUrls : [],
    };
  }

  /**
   * 创建消息元素
   * @param {string} content - 消息内容（Markdown 格式）
   * @param {string} type - 消息类型（"user"/"ai"/"error"）
   * @returns {HTMLElement} 消息元素
   * @description 创建带有头像和内容的聊天消息元素，支持 Markdown 渲染
   */
  function createMessageElement(content, type) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", type);
    const avatarElement = document.createElement("div");
    avatarElement.classList.add("avatar");
    const messageContentElement = document.createElement("div");
    messageContentElement.classList.add("message-content");
    const htmlContent = marked.parse(content);
    messageContentElement.innerHTML = htmlContent;
    messageContentElement.addEventListener("click", () => {
      copyTextToClipboardFromHTML(messageContentElement);
      messageContentElement.classList.add("copied");
      setTimeout(() => {
        messageContentElement.classList.remove("copied");
      }, 300);
    });
    messageElement.appendChild(avatarElement);
    messageElement.appendChild(messageContentElement);
    return messageElement;
  }

  /**
   * 从 HTML 元素复制文本到剪贴板
   * @param {HTMLElement} element - 包含内容的 HTML 元素
   * @description 将 HTML 转换为 Markdown 格式后复制到剪贴板
   */
  function copyTextToClipboardFromHTML(element) {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      fence: "```",
    });
    turndownService.addRule("strikethrough", {
      filter: ["del", "s", "strike"],
      replacement: function (content) {
        return "~~" + content + "~~";
      },
    });
    const htmlContent = element.innerHTML;
    let markdownContent = turndownService.turndown(htmlContent);
    const codeBlocks = [];
    markdownContent = markdownContent.replace(/```([\s\S]*?)```/g, (match, content) => {
      codeBlocks.push(match);
      return `[[CODE_BLOCK_${codeBlocks.length - 1}]]`;
    });
    markdownContent = markdownContent
      .replace(/^(\d+)\.\s+/gm, "$1.  ")
      .replace(/^-(?!-)([^\n]+)/gm, "- $1")
      .replace(/([A-Za-z])：/g, "$1:")
      .replace(/([，。])(?!(\s|$|`|\)|\]))/g, "$1 ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/(?<=^|\n)(\d{2,}|\d{1})(?<!1)\.\s+\*\*/g, "\n$1.  **");
    markdownContent = markdownContent.replace(/\[\[CODE_BLOCK_(\d+)\]\]/g, (_, index) => {
      return codeBlocks[parseInt(index, 10)];
    });
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = markdownContent;
    tempTextArea.style.position = "fixed";
    tempTextArea.style.top = "-9999px";
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
    showMessage("文本已复制到剪切板!", 1000, "copydone2", "success");
  }

  /**
   * 自动滚动到底部
   * @param {boolean} [force=false] - 是否强制滚动到底部
   * @description 根据 autoScroll 状态决定是否滚动，实现智能滚动控制
   */
  /**
   * 根据 autoScroll 状态决定是否滚到底。
   * @param {boolean} force  外部想立刻贴底时传 true
   */
  function scrollToBottom(force = false) {
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;
    const lastMsg = chatBox.lastElementChild;
    if (!lastMsg) return;
    const boxTop = chatBox.getBoundingClientRect().top;
    const lastTop = lastMsg.getBoundingClientRect().top;
    const touchedTop = lastTop - boxTop <= TOP_STOP_BUFFER;
    if (force) {
      chatBox.scrollTop = chatBox.scrollHeight;
      autoScroll = true;
      return;
    }
    if (autoScroll) {
      if (!touchedTop) {
        chatBox.scrollTop = chatBox.scrollHeight;
      } else {
        autoScroll = false;
      }
    }
  }

  /**
   * 显示聊天容器
   * @param {string} [actionType="logo"] - 操作类型（"logo"/"double"）
   * @description 创建并显示 AI 聊天界面
   */
  function showChatContainer(actionType = "logo") {
    const chatContainer = document.createElement("div");
    chatContainer.classList.add("chat-container");
    const chatBox = document.createElement("div");
    chatBox.classList.add("chat-box");
    chatBox.id = "chat-box";
    const inputBox = document.createElement("div");
    inputBox.classList.add("input-box");
    const userInput = document.createElement("textarea");
    userInput.id = "user-input";
    userInput.placeholder = "输入消息...";
    userInput.addEventListener("keydown", handleKeyPress);
    userInput.addEventListener("input", function () {
      adjustTextareaHeight(this);
    });
    const sendButton = document.createElement("button");
    sendButton.textContent = "发送";
    sendButton.addEventListener("click", sendMessage);
    inputBox.appendChild(userInput);
    inputBox.appendChild(sendButton);
    chatContainer.appendChild(chatBox);
    chatContainer.appendChild(inputBox);
    document.body.appendChild(chatContainer);
    setTimeout(() => {
      chatContainer.classList.add("show");
      firstChat(actionType);
    }, 10);
  }

  /**
   * 去除注释性括号及内容和省略符号
   * @param {string} text - 原始字符串
   * @returns {string} 清洗后的字符串
   * @description 移除各种括号及其内容、省略号等干扰符号
   */
  function stripExtraneous(text) {
    return text
      .replace(/(?:\(|（)[^()（）]*?(?:\)|）)/g, "")
      .replace(/(?:\[|［)[^\[\]［］]*?(?:\]|］)/g, "")
      .replace(/(?:<|〈)[^<>〈〉]*?(?:>|〉)/g, "")
      .replace(/\.{2,}|…+/g, "")
      .replace(/[{}｛｝]/g, "")
      .trim();
  }

  /**
   * 判断字符串类型：word / sentence / none
   * @param {string} text - 要检测的字符串
   * @param {{threshold?: number}} [options] - 配置选项，threshold 为日语字符占比阈值
   * @returns {"word"|"sentence"|"none"} 文本类型
   * @description 识别日语单词、句子或非日语文本
   */
  function classifyJapanese(text, { threshold = 0.8 } = {}) {
    const cleaned = stripExtraneous(text).trim();
    const totalChars = cleaned.replace(/\s+/g, "").length;
    const japaneseMatches =
      cleaned.match(/[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}ー「」『』【】（）［］〈〉《》・、。？！〜…]/gu) || [];
    const ratio = totalChars > 0 ? japaneseMatches.length / totalChars : 0;
    const wordRegex = /^[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}ー]+$/u;
    if (wordRegex.test(cleaned)) return "word";
    const sentenceRegex = /^[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}ー「」『』【】（）［］〈〉《》・、。？！〜…\s]+$/u;
    if (sentenceRegex.test(cleaned)) return "sentence";
    if (ratio >= threshold) return "sentence";
    return "none";
  }

  /**
   * 判断字符串是否含有 HTML 标签
   * @param {string} str - 待检测字符串
   * @returns {boolean} 是否包含 HTML 标签
   */
  function isHTML(str) {
    return /<[^>]+>/.test(str);
  }

  /**
   * 提取纯日语文本：去掉 <ruby> 注音结构和其它所有标签
   * @param {string} html - 包含 HTML 标签的文本
   * @returns {string} 纯日语文本
   * @description 移除 ruby 标签中的假名注音，保留汉字
   */
  function stripHTMLAndRuby(html) {
    const noRuby = html.replace(/<ruby>([^<]+)(?:<rp>.*?<\/rp><rt>.*?<\/rt><rp>.*?<\/rp>)<\/ruby>/gu, "$1");
    return noRuby.replace(/<[^>]+>/g, "").trim();
  }

  /**
   * 首次 AI 对话
   * @param {string} actionType - 操作类型（"logo"/"double"）
   * @description 根据卡片内容和操作类型生成首次对话内容
   */
  function firstChat(actionType) {
    let copiedText = aiClipboardText;
    aiClipboardText = "";
    let inputValueText = "";
    let firstChatLastSentence = "";
    let clippedTextType = classifyJapanese(copiedText);
    switch (clippedTextType) {
      case "word":
        inputValueText = `「${copiedText}」, 这个单词的意思是什么? `;
        break;
      case "sentence":
        inputValueText = `帮我拆解一下这句话: 「${copiedText}」。`;
        break;
      default:
        inputValueText = `分析「${copiedText}」。`;
    }
    if (actionType === "logo") {
      firstChatLastSentence = `我有一些问题, 请帮我解答一下。 准备好了的话, 回复"好的, 请讲"。`;
    } else if (actionType === "double") {
      firstChatLastSentence = inputValueText;
    }
    const userInput = document.getElementById("user-input");
    let userInputValue = `${currentNote.side1}\n\n---\n\n${currentNote.side2}`;
    userInputValue = userInputValue.replace(/<\/?[^>]+>/g, "").replace(/^\s*[\r\n]/gm, "");
    const imageRegex = /^!\[.*?]\((.*?)\)$/gm;
    const images = userInputValue.match(imageRegex) || [];
    const imgTagRegex = /(!\[.*?]\()(.+?)(\))/;
    const imagesLocal = images.map((line) => {
      const parts = line.match(imgTagRegex);
      if (!parts) return line;
      const remoteUrl = parts[2];
      const localPath = getPathByUrl(remoteUrl);
      return localPath ? line.replace(remoteUrl, localPath) : line;
    });
    const contentOnly = userInputValue.replace(imageRegex, "").trim();
    let assembled = "";
    assembled += "这是我在学习的资料:\n\n";
    assembled += "```md\n" + contentOnly + "\n```\n\n";
    imagesLocal.forEach((img) => {
      assembled += "---\n\n" + img + "\n\n";
    });
    assembled += `\n---\n\n`;
    assembled += firstChatLastSentence;
    userInput.value += assembled;
    sendMessage();
    if (actionType === "logo") {
      userInput.focus();
    } else if (actionType === "double") {
      userInput.blur();
    }
    userInput.value = "";
  }

  /**
   * 隐藏聊天容器
   * @description 移除 AI 聊天界面
   */
  function hideChatContainer() {
    const chatContainer = document.querySelector(".chat-container");
    chatContainer.classList.remove("show");
    setTimeout(() => {
      chatContainer.remove();
    }, 500);
  }

  /**
   * 退出无限循环播放模式
   * @param {boolean} [needStoreState=true] - 是否需要保存当前播放状态
   * @description 停止音频循环播放，清除播放样式
   */
  function exitUnlimitedMode(needStoreState = true) {
    if (needStoreState) {
      savePlaybackState();
    }
    unlimited = false;
    audioPlayer.loop = false;
    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      audio.pause();
    });
    const audioContainers = document.querySelectorAll(".audio-container");
    audioContainers.forEach((audioContainer) => {
      audioContainer.classList.remove("locking", "playing");
    });
  }

  /**
   * 比较两个路径是否相等
   * @param {string} path1 - 路径 1
   * @param {string} path2 - 路径 2
   * @returns {boolean} 路径是否相等
   * @description 移除协议前缀后比较路径
   */
  function arePathsEqual(path1, path2) {
    const removePrefix = (path) => path.replace(/^[a-zA-Z]+:\/\//, "");
    return removePrefix(path1) === removePrefix(path2);
  }

  /**
   * 计算学习时间
   * @returns {string} 格式化的学习时间字符串
   * @description 计算从开始学习到现在的时长
   */
  function calculateStudyTime() {
    let startTimeStamp = localStorage.getItem("startTimeStamp");
    let currentTimeStamp = Math.floor(Date.now() / 1000);
    let timeDiff = currentTimeStamp - startTimeStamp;
    let studyTime = formatTimeStamp(timeDiff);
    return "⏳" + studyTime;
  }

  /**
   * 检查卡片锁定状态
   * @description 检查卡片内容是否超出容器高度，决定是否启用滚动和显示额外按钮
   */
  function checkCardLock() {
    const side1element = document.querySelector(".side1 .side1-container");
    const side2element = document.querySelector(".side2 .side2-container");
    if (isSide1) {
      if (side1element.scrollHeight > side1element.clientHeight && !listenMode) {
        isCardLocked = true;
        side1element.style.overflowY = "auto";
      } else {
        isCardLocked = false;
        side1element.style.overflowY = "hidden";
      }
      side2element.style.overflowY = "hidden";
    } else {
      if (side2element.scrollHeight > side2element.clientHeight && !listenMode) {
        const btnGroup = document.querySelector(".button-group");
        btnGroup.classList.remove("three-split");
        btnGroup.classList.add("five-split");
        const rememberBtn = document.querySelector(".remember");
        const forgetBtn = document.querySelector(".forget");
        rememberBtn.classList.add("show");
        forgetBtn.classList.add("show");
        isCardLocked = true;
        side2element.style.overflowY = "auto";
      } else {
        const btnGroup = document.querySelector(".button-group");
        btnGroup.classList.remove("five-split");
        btnGroup.classList.add("three-split");
        const rememberBtn = document.querySelector(".remember");
        const forgetBtn = document.querySelector(".forget");
        rememberBtn.classList.remove("show");
        forgetBtn.classList.remove("show");
        isCardLocked = false;
        side2element.style.overflowY = "hidden";
      }
      side1element.style.overflowY = "hidden";
    }
  }

  /**
   * 显示卡片
   * @param {string} direction - 卡片出现方向（left/right/up/down）
   * @description 核心函数：创建并显示学习卡片，处理音频、图片、交互等
   */
  function showCards(direction) {
    voiceCommentList = [];
    savedPlaybackState = null;
    lastAudioUrl = "";
    lastSidePlayedElement = null;
    closeRecordGroup();
    if (allRemindNotes.length === 0) {
      const selectedCategoryList = JSON.parse(localStorage.getItem("selectedCategoryList")) || [];
      const searchKeywords = JSON.parse(localStorage.getItem("searchKeywords")) || [];
      let lastNoteNumber = 0;
      if (selectedCategoryList.length !== 0) {
        const needSubSearch = localStorage.getItem("needSubSearch") === "true";
        lastNoteNumber = queryAllRemindNotesNumber(selectedCategoryList, needSubSearch);
      } else {
        lastNoteNumber = searchNoteByKeywords(searchKeywords).length;
      }
      if (selectedCategoryList && lastNoteNumber !== 0) {
        keyback("delete");
      } else {
        cardBack();
      }
      return;
    }
    currentNote = allRemindNotes[currentCardIndex];
    let backgroundLevel = "level" + currentNote.level;
    let sectionObj = document.querySelector("section");
    sectionObj.classList.remove(
      "level1",
      "level2",
      "level3",
      "level4",
      "level5",
      "level6",
      "level7",
      "level8",
      "level9",
      "level10",
      "level11",
      "level12"
    );
    sectionObj.classList.add(backgroundLevel);
    const side1 = currentNote.side1;
    const side2 = currentNote.side2;
    const audio1 = side1.match(/<audio.*?src="(.*?)".*?>/);
    const audio2 = side2.match(/<audio.*?src="(.*?)".*?>/);
    currentNote.audio1 = audio1 ? audio1[1] : "";
    currentNote.audio2 = audio2 ? audio2[1] : "";
    currentNote.audio1 = getPathByUrl(currentNote.audio1);
    currentNote.audio2 = getPathByUrl(currentNote.audio2);
    const card = document.createElement("div");
    switch (direction) {
      case "left":
        card.className = "swiper-slide small";
        break;
      case "right":
        card.className = "swiper-slide big";
        break;
      case "up":
        card.className = "swiper-slide small";
        break;
      case "down":
        card.className = "swiper-slide small";
        break;
    }
    card.dataset.id = currentNote.id;
    const noteBox = document.createElement("div");
    noteBox.className = "note-box";
    let taskSum = localStorage.getItem("taskSum");
    let studyInfoCount = localStorage.getItem("studyInfoCount");
    const currentCategoryList = JSON.parse(localStorage.getItem("selectedCategoryList")) || [];
    const searchKeywords = JSON.parse(localStorage.getItem("searchKeywords")) || [];
    if (currentCategoryList.length !== 0) {
      const needSubSearch = localStorage.getItem("needSubSearch") === "true";
      taskInfoProgress = queryAllRemindNotesNumber(currentCategoryList, needSubSearch);
    } else {
      taskInfoProgress = searchNoteByKeywords(searchKeywords).length;
    }
    const lastNoteNumber = document.querySelector("span.last-note-number");
    lastNoteNumber.innerHTML = `🏷${currentCardIndex + 1}/${allRemindNotes.length} 🚀${taskInfoProgress}`;
    const studyTimeNumber = document.querySelector("span.study-time-number");
    let startTimeStamp = localStorage.getItem("startTimeStamp");
    let currentTimeStamp = Math.floor(Date.now() / 1000);
    let timeDiff = currentTimeStamp - startTimeStamp;
    if (timeDiff > 300) {
      studyTimeNumber.classList.remove("nodone");
      studyTimeNumber.classList.add("done");
    } else {
      studyTimeNumber.classList.remove("done");
      studyTimeNumber.classList.add("nodone");
    }
    studyTimeNumber.innerHTML =
      `<span class="current-note-level">📌${currentNote.level}/5</span> ` + calculateStudyTime();
    const currentCategoryElement = document.querySelector("span.current-category");
    currentCategoryElement.innerHTML = `《${currentNote.category || "未分类"}》`;
    ["side1", "side2"].forEach((type) => {
      const noteContent = document.createElement("div");
      noteContent.className = `note-content ${type}`;
      const content = document.createElement("div");
      content.className = type === "side2" ? "side2-container" : "side1-container";
      content.innerHTML = marked.parse(currentNote[type]);
      const pTags = content.querySelectorAll("p");
      let hasCommentTag = false;
      pTags.forEach((p) => {
        if (p.textContent.trim().startsWith("✎")) {
          p.id = "comment-tag";
          hasCommentTag = true;
        }
      });
      if (!hasCommentTag) {
        const emptyCommentP = document.createElement("p");
        emptyCommentP.id = "comment-tag";
        content.appendChild(emptyCommentP);
        emptyCommentP.classList.add("hide");
      }
      if (type === "side2") {
        let audioEl = content.querySelector("audio.voice-comment");
        if (!audioEl) {
          if (!content.querySelector("hr.voice-comment-separator")) {
            const hr = document.createElement("hr");
            hr.className = "voice-comment-separator hide";
            content.appendChild(hr);
          }
          audioEl = document.createElement("audio");
          audioEl.className = "voice-comment hide";
          audioEl.controls = true;
          content.appendChild(audioEl);
        } else {
          let audioVoiceCommentAudioSrc = audioEl.src;
          if (audioVoiceCommentAudioSrc.startsWith("https://")) {
            audioVoiceCommentAudioSrc = getPathByUrl(audioVoiceCommentAudioSrc);
          }
          if (!audioVoiceCommentAudioSrc.startsWith("file://")) {
            audioVoiceCommentAudioSrc = "file://" + audioVoiceCommentAudioSrc;
          }
          if (!voiceCommentList.includes(audioVoiceCommentAudioSrc)) {
            voiceCommentList.push(audioVoiceCommentAudioSrc);
          }
        }
      }
      if (type === "side2" && !listenMode) {
        const btnGroup = document.createElement("div");
        btnGroup.className = "button-group three-split";
        const createButton = (className, onClickFunction) => {
          const button = document.createElement("button");
          button.className = className;
          button.addEventListener("click", (event) => onClickFunction(currentNote, event));
          return button;
        };
        btnGroup.appendChild(createButton("btn delete", deleteBtnClick));
        btnGroup.appendChild(createButton("btn forget", forgetBtnClick));
        btnGroup.appendChild(createButton("btn request-ai", aiBtnClick));
        btnGroup.appendChild(createButton("btn remember", rememberBtnClick));
        btnGroup.appendChild(createButton("btn voice", voiceBtnClick));
        content.appendChild(btnGroup);
      }
      const img = content.querySelectorAll("img");
      img.forEach((element) => {
        element.src = getPathByUrl(element.src);
      });
      content.classList.add(backgroundLevel);
      noteContent.appendChild(content);
      noteBox.appendChild(noteContent);
    });
    const imgBlur = document.createElement("div");
    imgBlur.className = "img-blur";
    const img = document.createElement("div");
    img.className = "img";
    card.appendChild(noteBox);
    card.appendChild(imgBlur);
    card.appendChild(img);
    const swiperWrapper = document.querySelector(".swiper-wrapper");
    swiperWrapper.appendChild(card);
    if (!listenMode) {
      let audioElements = document.querySelectorAll("audio:not(.audioPlayer):not(.my-audio-player)");
      audioElements.forEach(function (audioElement, index) {
        let lastClickTimeStamp = 0;
        let audioContainer = document.createElement("div");
        audioContainer.className = `audio-container`;
        if (audioElement.classList.contains("voice-comment")) {
          audioContainer.classList.add("voice-comment");
        }
        if (audioElement.classList.contains("hide")) {
          audioContainer.classList.add("hide");
        }
        audioContainer.dataset.audioId = index;
        audioElement.parentNode.insertBefore(audioContainer, audioElement);
        audioContainer.addEventListener("click", function (event) {
          event.stopPropagation();
          if (isRecording) {
            return;
          }
          if (!myAudioPlayer.paused) {
            const myAudioButton = document.querySelector("button.my-audio.show");
            if (myAudioButton) {
              myAudioButton.click();
            }
          }
          const isPlaying = this.classList.contains("playing");
          if (audioElement.src.startsWith("https://")) {
            audioElement.src = getPathByUrl(audioElement.src);
          }
          if (!unlimited) {
            enterUnlimitedMode(audioElement.src, audioContainer);
          } else {
            if (isPlaying) {
              exitUnlimitedMode(false);
            } else {
              enterUnlimitedMode(audioElement.src, audioContainer);
            }
          }
        });
        audioElement.addEventListener("play", function () {
          audioElements.forEach(function (otherAudio) {
            if (otherAudio !== audioElement) {
              otherAudio.pause();
              resetButton(otherAudio.previousElementSibling);
            }
          });
        });
        audioElement.addEventListener("ended", function () {
          resetButton(audioContainer);
        });
      });
      function resetButton(container) {
        container.classList.remove("playing");
      }
    }
    function resetButton(container) {
      container.classList.remove("playing");
    }
    setTimeout(() => {
      card.classList.add("swiper-slide-active");
      currentCard = card;
      bindCardEvent();
    }, 50);
    setTimeout(checkCardLock, 500);
    DynamicFontAdjuster.init({
      flagName: "isSide1",
      variants: {
        true: [".side1 h1", ".side1 .side1-container"],
        false: [".side2 h1", ".side2 .side2-container"],
      },
      common: ["table td"],
    });
  }

  /**
   * 绑定卡片事件
   * @description 为卡片添加点击、翻转、音频播放等交互事件
   */
  function bindCardEvent() {
    isSide1 = true;
    const outerDelay = playAwayNumber === 0 ? 400 : 0;
    const autoplayDelay = playAwayNumber === 0 ? 0 : 350;
    function triggerNoteAndAudio() {
      currentCard.querySelector(".note-box").click();
      setTimeout(() => {
        currentCard.querySelector(".side1 .audio-container")?.click();
      }, 350);
    }
    function triggerAudioClick(delay) {
      setTimeout(() => {
        currentCard.querySelector(".side1 .audio-container")?.click();
      }, delay);
    }
    setTimeout(() => {
      if (listenMode) {
        playCardAudio(isSide1);
      } else if (playAwayNumber === 0 && doubleClickMode) {
        triggerNoteAndAudio();
      } else if (cardMode === "study") {
        triggerNoteAndAudio();
      } else if (cardMode === "autoplay") {
        triggerAudioClick(autoplayDelay);
      }
    }, outerDelay);
    currentCard.onclick = function () {
      if (isShaking || isLongPressing) {
        return false;
      }
      currentCard.querySelectorAll(".study-time-number").forEach((element) => {
        let startTimeStamp = localStorage.getItem("startTimeStamp");
        let currentTimeStamp = Math.floor(Date.now() / 1000);
        let timeDiff = currentTimeStamp - startTimeStamp;
        if (timeDiff > 300) {
          element.classList.remove("nodone");
          element.classList.add("done");
        } else {
          element.classList.remove("done");
          element.classList.add("nodone");
        }
        element.textContent = calculateStudyTime();
      });
      currentCard.querySelector(".note-box").classList.toggle("is-flipped");
      isSide1 = !currentCard.querySelector(".note-box").classList.contains("is-flipped");
      if (!listenMode) {
        checkCardLock();
      }
      if (listenMode) {
        playCardAudio(isSide1);
      }
    };
    const codeArr = currentCard.querySelectorAll("code");
    const jp_exmaples = currentCard.querySelectorAll(".jp_example, jp-example, .jp-title, jp-title");
    if (!listenMode) {
      codeArr.forEach((element) => {
        element.addEventListener("click", function (event) {
          event.stopPropagation();
          this.classList.toggle("clear");
        });
      });
      jp_exmaples.forEach((element) => {
        let lastExampleClickTime = 0;
        let JPLongPressTimer = null;
        let isJPLongPressing = false;
        element.addEventListener("touchstart", function (event) {
          removeCardLongPressListener();
          isJPLongPressing = false;
          JPLongPressTimer = setTimeout(() => {
            isJPLongPressing = true;
            currentRecordingJPElement = element;
            jpLongpress();
            addCardLongPressListener();
          }, 500);
        });
        element.addEventListener("touchend", function (event) {
          addCardLongPressListener();
          if (JPLongPressTimer) {
            clearTimeout(JPLongPressTimer);
            JPLongPressTimer = null;
          }
          if (isJPLongPressing) {
            isJPLongPressing = false;
            return;
          }
        });
        element.addEventListener("touchmove", function (event) {
          if (JPLongPressTimer) {
            clearTimeout(JPLongPressTimer);
            JPLongPressTimer = null;
          }
          if (isJPLongPressing) {
            event.stopPropagation();
            event.preventDefault();
          }
        });
        element.addEventListener("click", function (event) {
          if (isJPLongPressing) {
            isJPLongPressing = false;
            event.stopPropagation();
            return;
          }
          event.stopPropagation();
          this.classList.toggle("clear");
          let currentTime = Date.now();
          let timeDiff = currentTime - lastExampleClickTime;
          lastExampleClickTime = currentTime;
          if (timeDiff < 500) {
            this.classList.add("clear");
            if (unlimited) {
              exitUnlimitedMode();
            }
            copyContentToClipboard(this.innerHTML);
            closeRecordGroup();
            showChatContainer("double");
          }
        });
      });
    }
    const fullImg = document.querySelector(".full-img");
    fullImg.addEventListener("click", function (e) {
      e.stopPropagation();
      this.style.display = "none";
    });
    cardAddMove();
  }

  /**
   * 卡片飞走动画
   * @param {string} direction - 飞走方向（left/right/up/down）
   * @description 执行卡片飞出屏幕的动画，然后显示下一张卡片
   */
  function flyAway(direction) {
    let flyAwayCard = currentCard;
    shakeThePhone();
    startPoint = null;
    closeAllEnvMessage();
    currentActionDirection = "none";
    document.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("touchmove", handleTouchMove);
    flyAwayCard.style.transition = "transform 0.5s";
    switch (direction) {
      case "left":
        flyAwayCard.style.transform = `translate(${-window.innerWidth * 1.5}px)`;
        break;
      case "right":
        flyAwayCard.style.transform = `translate(${window.innerWidth * 1.5}px)`;
        break;
      case "up":
        flyAwayCard.style.transform = `translate(0px,${-window.innerHeight * 2}px)`;
        break;
      case "down":
        flyAwayCard.style.transform = `translate(0px,${window.innerHeight * 2}px)`;
        break;
    }
    setTimeout(() => {
      flyAwayCard.remove();
    }, 500);
    playAwayNumber++;
    showCards(direction);
  }

  /**
   * 卡片回到原位
   * @description 取消操作，将卡片动画恢复到原始位置
   */
  function backToPosition() {
    startPoint = null;
    currentCard.style.transition = "transform 0.5s";
    currentCard.style.transform = "";
    closeAllEnvMessage();
    currentActionDirection = "none";
    currentCard.classList.remove("delete", "nodelete", "edit", "noedit");
  }

  /**
   * 删除按钮点击处理（底部按钮）
   * @param {Object} currentNoteObj - 当前笔记对象
   * @param {Event} event - 点击事件对象
   */
  function deleteBtnClick(currentNoteObj, event) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    event.stopPropagation();
    deleteAction("up");
  }

  /**
   * 删除按钮点击处理（九宫格按钮组）
   */
  function deleteBtnClickForButtonsGroup9() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    deleteAction("up");
  }
  function rememberBtnClick(currentNoteObj, event) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    event.stopPropagation();
    doneAction("up");
  }

  /**
   * 记住按钮点击处理（九宫格按钮组）
   */
  function rememberBtnClickForButtonsGroup() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    doneAction("up");
  }

  /**
   * 遗忘按钮点击处理（底部按钮）
   * @param {Object} currentNoteObj - 当前笔记对象
   * @param {Event} event - 点击事件对象
   */
  function forgetBtnClick(currentNoteObj, event) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    event.stopPropagation();
    forgetAction("down");
  }

  /**
   * 遗忘按钮点击处理（九宫格按钮组）
   */
  function forgetBtnClickForButtonsGroup9() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    forgetAction("down");
  }
  function aiBtnClick(currentNoteObj, event) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    event.stopPropagation();
    copyToClipboard(currentCard.querySelector(".side1"));
    closeRecordGroup();
    showChatContainer();
  }

  /**
   * AI 按钮点击处理（九宫格按钮组）
   */
  function aiBtnClickForButtonsGroup9() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    copyToClipboard(currentCard.querySelector(".side1"));
    closeRecordGroup();
    showChatContainer();
  }

  /**
   * 复制文本到剪贴板
   * @param {HTMLElement} element - 包含要复制内容的元素
   * @description 提取 side1 内容并复制到剪贴板，供 AI 分析使用
   */
  function copyToClipboard(element) {
    const messageContent = element.querySelector(".side1-container").innerHTML;
    let copiedText = isHTML(messageContent) ? stripHTMLAndRuby(messageContent) : messageContent.trim();
    const clipboardText = `「${copiedText}」`;
    aiClipboardText = copiedText;
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = clipboardText;
    tempTextArea.style.position = "fixed";
    tempTextArea.style.top = "-9999px";
    tempTextArea.style.opacity = "0";
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
  }

  /**
   * 复制内容到剪贴板
   * @param {string} content - 要复制的内容（可能包含 HTML）
   * @description 清理 HTML 标签后复制纯文本到剪贴板
   */
  function copyContentToClipboard(content) {
    let copiedText = isHTML(content) ? stripHTMLAndRuby(content) : content.trim();
    const clipboardText = `「${copiedText}」`;
    aiClipboardText = copiedText;
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = clipboardText;
    tempTextArea.style.position = "fixed";
    tempTextArea.style.top = "-9999px";
    tempTextArea.style.opacity = "0";
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
  }

  /**
   * 编辑按钮点击处理（底部按钮）
   * @param {Object} currentNoteObj - 当前笔记对象
   * @param {Event} event - 点击事件对象
   */
  function editBtnClick(currentNoteObj, event) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    event.stopPropagation();
    closeRecordGroup();
    showEditContainer();
  }

  /**
   * 语音按钮点击处理
   * @param {Object} currentNoteObj - 当前笔记对象
   * @param {Event} event - 点击事件对象
   * @description 开始录音或关闭录音界面
   */
  function voiceBtnClick(currentNoteObj, event) {
    event.stopPropagation();
    if (isRecorderOpen) {
      closeRecordGroup();
      return;
    }
    pauseAllAudios(true);
    recordToCheck("save");
  }

  /**
   * 编辑按钮点击处理（九宫格按钮组）
   */
  function editBtnClickForButtonsGroup9() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    closeRecordGroup();
    showEditContainer();
  }

  /**
   * 添加卡片滑动事件监听
   * @description 监听触摸事件，实现卡片滑动手势
   */
  function cardAddMove() {
    currentCard.addEventListener("touchstart", (e) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const { clientX, clientY } = touch;
      startPoint = { x: clientX, y: clientY };
      document.addEventListener("touchmove", handleTouchMove);
      currentCard.style.transition = "transform 0s";
    });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("cancel", handleTouchEnd);
  }

  /**
   * 移除卡片滑动事件监听
   */
  function cardRemoveMove() {
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("cancel", handleTouchEnd);
  }

  /**
   * 处理触摸移动事件
   * @param {TouchEvent} e - 触摸事件对象
   * @description 计算滑动距离和方向，执行卡片跟随手指移动
   */
  function handleTouchMove(e) {
    if (!startPoint) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const { clientX, clientY } = touch;
    offsetX = clientX - startPoint.x;
    offsetY = clientY - startPoint.y;
    if (firstMoveDirection === null) {
      if (Math.abs(offsetX) > Math.abs(offsetY)) {
        firstMoveDirection = "horizontal";
      } else {
        firstMoveDirection = "vertical";
      }
    }
    if (firstMoveDirection === "horizontal") {
      currentCard.style.transform = `translate(${offsetX}px)`;
      if (Math.abs(offsetX) >= currentCard.clientWidth * 0.05) {
        currentActionDirection = offsetX > 0 ? "right" : "left";
        showCardAction();
      } else {
        currentActionDirection = "none";
        abolishCardAction();
      }
    } else if (firstMoveDirection === "vertical") {
      if (isCardLocked) return;
      currentCard.style.transform = `translate(0px, ${offsetY}px)`;
      if (Math.abs(offsetY) > currentCard.clientHeight * 0.1) {
        currentActionDirection = offsetY > 0 ? "down" : "up";
        showCardAction();
      } else {
        currentActionDirection = "none";
        abolishCardAction();
      }
    }
  }

  /**
   * 处理触摸结束事件
   * @description 根据滑动距离和方向执行相应的卡片操作
   */
  function handleTouchEnd() {
    startPoint = null;
    firstMoveDirection = null;
    document.removeEventListener("touchmove", handleTouchMove);
    currentCard.style.transform = "";
    currentCard.style.transition = "transform 0.5s";
    closeAllActionMessage();
    showCardActionLock = false;
    abolishCardActionLock = true;
    if (currentActionDirection == "up") {
      doneAction("up");
    }
    if (currentActionDirection == "down") {
      forgetAction("down");
    }
    if (currentActionDirection == "left") {
      holdAction("left");
    }
    if (currentActionDirection == "right") {
      holdAction("right");
    }
  }

  /**
   * 删除操作（旧版，已弃用）
   * @deprecated
   */
  function deleteAction_bak() {
    currentNote.isDelete = 1;
    const updateNoteData = {
      id: currentNote.id,
      isDelete: 1,
    };
    updateNoteByData(updateNoteData);
    flyAway("right");
  }

  /**
   * 取消删除操作
   * @description 退出无限循环模式，将卡片恢复到原位
   */
  function noDeleteAction() {
    if (unlimited) {
      exitUnlimitedMode();
    }
    backToPosition();
  }

  /**
   * 完成操作（记住卡片）
   * @param {string} direction - 飞走方向
   * @description 提升卡片等级，更新复习时间，播放成功音效
   */
  function doneAction(direction) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    allRemindNotes.splice(currentCardIndex, 1);
    if (currentCardIndex >= allRemindNotes.length) {
      currentCardIndex = 0;
    }
    if (allRemindNotes.length === 0) {
      playDoneAudio();
    } else {
      playUpAudio();
    }
    currentNote.level = Number(currentNote.level);
    currentNote.level += 1;
    currentNote.remindTimeStamp = Math.floor(Date.now() / 1000) + getRemindTimeDiffByLevelNumber(currentNote.level);
    const updateNoteData = {
      id: currentNote.id,
      level: currentNote.level,
      remindTimeStamp: currentNote.remindTimeStamp,
      isDelete: currentNote.isDelete,
    };
    updateNoteByData(updateNoteData);
    addCodeToAlignment(currentNote.alignCode);
    flyAway(direction);
  }

  /**
   * 删除操作
   * @param {string} direction - 飞走方向
   * @description 从列表中删除当前卡片，播放音效
   */
  function deleteAction(direction) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    allRemindNotes.splice(currentCardIndex, 1);
    if (currentCardIndex >= allRemindNotes.length) {
      currentCardIndex = 0;
    }
    playUpAudio();
    const updateNoteData = {
      id: currentNote.id,
      isDelete: 1,
    };
    deleteNoteByData(updateNoteData);
    checkLastDeleteNote();
    flyAway(direction);
  }

  /**
   * 保持操作（左右滑动切换卡片）
   * @param {string} direction - 滑动方向（left/right）
   * @description 不改变卡片等级，仅切换到上一张或下一张
   */
  function holdAction(direction) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    switch (direction) {
      case "left":
        currentCardIndex++;
        if (currentCardIndex >= allRemindNotes.length) {
          currentCardIndex = 0;
        }
        break;
      case "right":
        currentCardIndex--;
        if (currentCardIndex < 0) {
          currentCardIndex = allRemindNotes.length - 1;
        }
        break;
    }
    playHoldAudio();
    flyAway(direction);
  }

  /**
   * 遗忘操作（忘记卡片）
   * @param {string} direction - 飞走方向
   * @description 降低卡片等级，重置复习时间，播放等待音效
   */
  function forgetAction(direction) {
    if (unlimited) {
      exitUnlimitedMode();
    }
    allRemindNotes.splice(currentCardIndex, 1);
    if (currentCardIndex >= allRemindNotes.length) {
      currentCardIndex = 0;
    }
    if (allRemindNotes.length === 0) {
      playDoneAudio();
    } else {
      playWaitAudio();
    }
    currentNote.level = Number(currentNote.level);
    if (currentNote.level > 0) {
      currentNote.level -= 1;
    } else {
      currentNote.level = 0;
    }
    currentNote.remindTimeStamp = Math.floor(Date.now() / 1000) + getRemindTimeDiffByLevelNumber(0);
    const updateNoteData = {
      id: currentNote.id,
      level: currentNote.level,
      remindTimeStamp: currentNote.remindTimeStamp,
      isDelete: currentNote.isDelete,
    };
    updateNoteByData(updateNoteData);
    addCodeToAlignment(currentNote.alignCode);
    flyAway(direction);
  }

  /**
   * 从 HTML 中提取日语文本
   * @param {string} html - 包含 HTML 标签的文本
   * @returns {string} 提取的纯日语文本
   * @description 从分词标注的 HTML 中提取日语原文（去除假名注音）
   */
  function extractJapaneseTextFromHtml(html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    const nodes = container.querySelectorAll(".morpheme");
    let result = "";
    nodes.forEach((node) => {
      const ruby = node.querySelector("ruby");
      if (ruby) {
        const clonedRuby = ruby.cloneNode(true);
        clonedRuby.querySelectorAll("rt, rp").forEach((el) => el.remove());
        result += clonedRuby.textContent;
      } else {
        result += node.textContent;
      }
    });
    return result.replace(/\s+/g, "");
  }

  /**
   * 日语示例长按处理
   * @description 长按日语示例时开始录音，用于口语练习和语音识别对比
   */
  function jpLongpress() {
    pauseAllAudios(true);
    shakeThePhone();
    closeButtonsGroup9();
    initializeTencentCloudCosClient(tencentSecretID, tencentSecretKey);
    recordToCheck();
    if (currentRecordingJPElement) {
      currentLongPressElementContext = extractJapaneseTextFromHtml(currentRecordingJPElement.innerHTML);
      let recorderElement = currentRecordingJPElement.nextElementSibling;
      if (!recorderElement || !recorderElement.classList.contains("jp-recorder")) {
        recorderElement = document.createElement("div");
        recorderElement.className = "jp-recorder";
        currentRecordingJPElement.parentNode.insertBefore(recorderElement, currentRecordingJPElement.nextSibling);
      }
      recorderElement.classList.remove("has-ruby");
      recorderElement.innerHTML = `🎙 正在录音...`;
      checkCardLock();
    }
  }

  /** @type {number} 空白区域上次点击时间戳 */
  let blankLastClickTimeStamp = 0;

  /**
   * 空白区域点击处理
   * @description 点击卡片空白区域时播放对面的音频
   */
  document.querySelector("section").onclick = function (event) {
    if (event.target.className !== "swiper-wrapper" && event.target.className !== "swiper-container") {
      return;
    }
    const audioSrc = isSide1 ? currentNote.audio2 : currentNote.audio1;
    const audioContainerElement = isSide1
      ? currentCard.querySelector(".side2 .audio-container")
      : currentCard.querySelector(".side1 .audio-container");
    enterUnlimitedMode(audioSrc, audioContainerElement);
  };
};
