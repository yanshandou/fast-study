/**************** 消息提示相关 开始 ****************/
// 弹框信息相关, 可以使用对象进行关闭
let doneMsgObj = null;
let upMsgObj = null;
let downMsgObj = null;
let editMsgObj = null;
let noEditMsgObj = null;
let deleteMsgObj = null;
let noDeleteMsgObj = null;
let editEnvMsgObj = null;
let deleteEnvMsgObj = null;
let loadingMsgObj = null;
// 全局同步对象
let sync = null;
let promptVoiceList = [
  { audioName: "1.mp3", volume: 0.9 },
  { audioName: "2.mp3", volume: 0.9 },
  { audioName: "3.mp3", volume: 0.9 },
  { audioName: "4.mp3", volume: 0.9 },
  { audioName: "5.mp3", volume: 0.9 },
  { audioName: "6.mp3", volume: 0.9 },
  { audioName: "7.mp3", volume: 0.9 },
  { audioName: "awesome.mp3", volume: 0.75 },
  { audioName: "done2.mp3", volume: 0.75 },
  { audioName: "end.mp3", volume: 0.9 },
  { audioName: "forget.mp3", volume: 0.9 },
  { audioName: "gap_590.mp3", volume: 0.9 },
  { audioName: "hold.mp3", volume: 0.75 },
  { audioName: "hold2.mp3", volume: 0.9 },
  { audioName: "lock.mp3", volume: 0.9 },
  { audioName: "mark.mp3", volume: 0.75 },
  { audioName: "readyonly.mp3", volume: 0.9 },
];
/**
 * 根据文件路径返回对应的音量，查不到则返回默认音量 1.0
 * @param {string} filePath 完整文件路径或 URL
 * @returns {number} 音量（0.0 ～ 1.0）
 */
function getVolumeByPath(filePath) {
  // 1. 提取文件名
  const parts = filePath.split("/");
  const fileName = parts[parts.length - 1];
  // 2. 在列表中查找
  const entry = promptVoiceList.find((item) => item.audioName === fileName);
  // 3. 返回对应音量或默认 1.0
  return entry ? entry.volume : 1.0;
}
localStorage.setItem("appState", "front");
function shakeThePhone() {
  api.notification({
    // 震动
    vibrate: [0, 50],
  });
}
/**
 * 使用Toastify展示信息😎
 * @param {string} text 提示的信息
 * @param {string|number} time long代表长期, 数字代表过期时间毫秒级
 * @param {string} img 图标名称
 * @param {string} type 背景色, info warning success error
 * @param {string} position 位置 默认center, left right 可选
 * @returns Toastify, 后期可以删除
 */
function showMessage(text, time, img, type, position = "center", cb = function () {}, ...args) {
  document.querySelectorAll(".toastify").forEach((el) => el.remove());
  let bgc = "";
  let optionTime = time === "long" ? -1 : time;
  switch (type) {
    case "success":
      bgc = "linear-gradient(to right, #00b09b, #96c93d)";
      break;
    case "error":
      bgc = "linear-gradient(to right, rgb(255, 95, 109), rgb(255, 195, 113))";
      break;
    case "info":
      bgc = "linear-gradient(to right, #858585, #a8a8a8)";
      break;
    case "warning":
      bgc = "linear-gradient(to right, #d58200, #f8c700)";
      break;
    case "level0":
      bgc = "linear-gradient(to bottom, #2c3e50, #bdc3c7)";
      break;
    case "level1":
      bgc = "linear-gradient(to bottom, #ff0844, #ffb199)";
      break;
    case "level2":
      bgc = "linear-gradient(to bottom, #f09819, #f6d365)";
      break;
    case "level3":
      bgc = "linear-gradient(to bottom, #2f80ed, #56ccf2)";
      break;
    case "level4":
      bgc = "linear-gradient(to bottom, #0ba360, #3cba92)";
      break;
    case "level5":
    case "level6":
    case "level7":
    case "level8":
    case "level9":
    case "level10":
    case "level11":
    case "level12":
      bgc = "linear-gradient(to bottom, #5961f9, #ee9ae5)";
      break;
    default:
      bgc = "linear-gradient(to right, #666, #999)"; // fallback 背景色
  }
  let toast = Toastify({
    oldestFirst: false,
    text,
    duration: optionTime,
    newWindow: true,
    gravity: "top",
    position,
    avatar: `./image/${img}.png`,
    onClick: function () {
      toast.hideToast();
      if (typeof cb === "function") cb(...args);
    },
    style: {
      transitionDuration: "0.1s",
      background: bgc,
      borderRadius: "10px",
      padding: "2vw 3vw",
      fontSize: "6vw",
      display: "flex",
      fontFamily: `en, number, "zhuzi-jp", "zhuzi-zh"`,
      alignItems: "center",
      marginTop: "3vw",
      boxShadow: `
    inset 0 1px 3px rgba(255, 255, 255, 0.6),  /* 顶部亮光 */
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),       /* 底部内阴影 */
    0 4px 6px rgba(0, 0, 0, 0.3),             /* 主阴影 */
    0 10px 15px rgba(0, 0, 0, 0.2),           /* 远阴影，增强浮起感 */
    0 20px 25px rgba(0, 0, 0, 0.1)            /* 更远阴影，立体感 */
  `,
    },
  });
  toast.showToast();
  return toast;
}
// 展示完成的信息😎
function showDoneMessage(content) {
  closeAllActionMessage();
  doneMsgObj = showMessage(content, "long", "done", "success");
}
function showMusicDoneMessage(content) {
  doneMsgObj = showMessage(content, 1000, "done", "success");
}
function showMusicResultMessage(content) {
  doneMsgObj = showMessage(content, 3000, "done", "success");
}
function showMusicDownLoadingMessage(content) {
  doneMsgObj = showMessage(content, 1000, "loading", "error");
}
// 展示level++的信息😎
function showUpMessage(content) {
  closeAllActionMessage();
  // upMsgObj = showMessage(content, "long", "up", "success", "right");
  upMsgObj = showMessage(content, "long", "up", "success");
}
// 展示level--的信息😎
function showDownMessage(content) {
  closeAllActionMessage();
  downMsgObj = showMessage(content, "long", "down", "error");
  // downMsgObj = showMessage(content, "long", "down", "error", "left");
}
// 展示确认编辑的信息😎
function showEditMessage() {
  closeAllActionMessage();
  editMsgObj = showMessage("确认编辑!", "long", "edit", "success", "right");
}
// 展示取消编辑的信息😎
function showNoEditMessage() {
  closeAllActionMessage();
  noEditMsgObj = showMessage("取消编辑!", "long", "no-edit", "error", "left");
}
// 展示确认删除的信息😎
function showDeleteMessage() {
  closeAllActionMessage();
  deleteMsgObj = showMessage("确定删除!", "long", "delete", "success", "right");
}
// 展示取消删除的信息😎
function showNoDeleteMessage() {
  closeAllActionMessage();
  noDeleteMsgObj = showMessage("取消删除!", "long", "no-delete", "error", "left");
}
// 展示编辑环境的信息, 提醒用户😎
function showEditEnvMessage() {
  closeAllEnvMessage();
  editEnvMsgObj = showMessage("当前是编辑状态", "long", "edit-env", "info");
}
// 展示删除环境的信息, 提醒用户😎
function showDeleteEnvMessage() {
  closeAllEnvMessage();
  deleteEnvMsgObj = showMessage("当前是删除状态", "long", "delete-env", "info");
}
// 展示加载中的信息😎
function showLoadingMessage(text) {
  closeAllActionMessage();
  loadingMsgObj = showMessage(text, "long", "loading", "error");
}
// 展示同步结果的信息😎
function showSyncResultMessage(text) {
  closeAllActionMessage();
  loadingMsgObj = showMessage(text, "long", "syncDone", "success");
}
// 关闭完成信息😎
function closeDoneMessage() {
  if (doneMsgObj) {
    doneMsgObj.toastElement.remove();
    doneMsgObj = null;
  }
}
// 关闭level++信息😎
function closeUpMessage() {
  if (upMsgObj) {
    upMsgObj.toastElement.remove();
    upMsgObj = null;
  }
}
// 关闭level--信息😎
function closeDownMessage() {
  if (downMsgObj) {
    downMsgObj.toastElement.remove();
    downMsgObj = null;
  }
}
// 关闭确认编辑信息😎
function closeEditMessage() {
  if (editMsgObj) {
    editMsgObj.toastElement.remove();
    editMsgObj = null;
  }
}
// 关闭取消编辑信息😎
function closeNoEditMessage() {
  if (noEditMsgObj) {
    noEditMsgObj.toastElement.remove();
    noEditMsgObj = null;
  }
}
// 关闭确认删除信息😎
function closeDeleteMessage() {
  if (deleteMsgObj) {
    deleteMsgObj.toastElement.remove();
    deleteMsgObj = null;
  }
}
// 关闭取消删除信息😎
function closeNoDeleteMessage() {
  if (noDeleteMsgObj) {
    noDeleteMsgObj.toastElement.remove();
    noDeleteMsgObj = null;
  }
}
// 关闭提醒用户的编辑环境信息😎
function closeEditEnvMessage() {
  if (editEnvMsgObj) {
    editEnvMsgObj.toastElement.remove();
    editEnvMsgObj = null;
  }
}
// 关闭提醒用户的删除环境信息😎
function closeDeleteEnvMessage() {
  if (deleteEnvMsgObj) {
    deleteEnvMsgObj.toastElement.remove();
    deleteEnvMsgObj = null;
  }
}
// 关闭提示用户的加载中的信息😎
function closeLoadingMessage() {
  if (loadingMsgObj) {
    loadingMsgObj.toastElement.remove();
    loadingMsgObj = null;
  }
}
// 关闭所有的信息😎
function closeAllActionMessage() {
  closeDoneMessage();
  closeUpMessage();
  closeDownMessage();
  closeEditMessage();
  closeNoEditMessage();
  closeDeleteMessage();
  closeNoDeleteMessage();
  closeLoadingMessage();
}
// 关闭所有的环境信息😎
function closeAllEnvMessage() {
  closeEditEnvMessage();
  closeDeleteEnvMessage();
}
/**************** 消息提示相关 结束 ****************/
/**************** 通用功能函数 开始 ****************/
// 最新的app转后台 😎
function appToBack() {
  // 清空计数
  if (window.DynamicFontAdjuster && typeof window.DynamicFontAdjuster.resetTaps === "function") {
    window.DynamicFontAdjuster.resetTaps();
  }
  if (window.FontAdjuster && typeof window.FontAdjuster.resetTaps === "function") {
    window.FontAdjuster.resetTaps();
  }
  // 清除消息和角标
  localStorage.setItem("appState", "back");
  // 修改远程数据库, 使得jpush生效
  let noteNumber = 0; // 默认值为0
  let nextRemindTimeStamp = 0; // 默认值为0
  let jpushID = localStorage.getItem("xgToken");
  // 判断是不是还有笔记需要复习
  let allRemindNotesNumber = queryAllRemindNotesNumber();
  if (allRemindNotesNumber > 0) {
    // 有笔记需要复习
    noteNumber = allRemindNotesNumber;
  } else {
    // 添加remindTimeStamp
    nextRemindTimeStamp = localStorage.getItem("nextRemindTimeStamp") || 0;
    // 转数字
    nextRemindTimeStamp = Number(nextRemindTimeStamp);
  }
  insertDataToAppInfo(
    {
      noteNumber: noteNumber,
      jpushID: jpushID,
      remindTimeStamp: nextRemindTimeStamp,
    },
    "back"
  );
  // 同步功能
  appToBackSync();
}
function appToBackSync() {
  // 如果sync对象还未初始化，则创建它
  if (!sync) {
    sync = createSyncLogic();
  }
  sync.backSync();
}
// 获取当前时间戳, 保存到localStorage中😎
function getStartTimeStamp() {
  let startTimeStamp = Math.floor(Date.now() / 1000);
  localStorage.setItem("startTimeStamp", startTimeStamp);
}
// app 切前台, 清除提醒 😎
function appToFront(position = "") {
  // 清空计数
  // 清空计数
  if (window.DynamicFontAdjuster && typeof window.DynamicFontAdjuster.resetTaps === "function") {
    window.DynamicFontAdjuster.resetTaps();
  }
  if (window.FontAdjuster && typeof window.FontAdjuster.resetTaps === "function") {
    window.FontAdjuster.resetTaps();
  }
  // 清除消息和角标
  api.cancelNotification({ id: -1 });
  api.setAppIconBadge({ badge: 0 });
  // 关闭所有消息提示
  closeAllActionMessage();
  closeAllEnvMessage();
  const currentWin = api.winName;
  localStorage.setItem("appState", "front");
  let jpushID = localStorage.getItem("xgToken");
  // 修改数据库, 关闭jpush
  insertDataToAppInfo(
    {
      noteNumber: 0,
      jpushID: jpushID,
      remindTimeStamp: 0,
    },
    "front"
  );
}
/**
 * 获取本地数据库中最大更新时间戳对应的ID数组
 * @returns {Array} ID数组
 */
function getLocalBiggestUpdateTimeStampIdArray() {
  let db = api.require("db");
  // 先获取最大的更新时间戳
  const maxUpdateTimeStampQuery = "SELECT MAX(updateTimeStamp) as maxTimeStamp FROM note";
  let maxResult = db.selectSqlSync({
    name: "studyApp",
    sql: maxUpdateTimeStampQuery,
  });
  if (!maxResult.status || !maxResult.data || maxResult.data.length === 0 || maxResult.data[0].maxTimeStamp === null) {
    return [];
  }
  const maxUpdateTimeStamp = maxResult.data[0].maxTimeStamp;
  // 查询所有具有最大更新时间戳的note记录的id
  const idQuery = `SELECT id FROM note WHERE updateTimeStamp = ${maxUpdateTimeStamp}`;
  let idResult = db.selectSqlSync({
    name: "studyApp",
    sql: idQuery,
  });
  if (!idResult.status || !idResult.data) {
    return [];
  }
  // 提取ID数组并转换为数字类型
  const idArray = idResult.data.map((item) => Number(item.id));
  return idArray;
}
/**
 * 获取远程服务器最大更新时间戳对应的ID数组
 * @returns {Promise<Array>} ID数组
 */
async function getRemoteBiggestUpdateTimeStampIdArray() {
  try {
    const response = await apiAjaxGetRequest("getNoteBiggestUpdateTimeStampIdArray.php");
    if (response.errno === 0 && Array.isArray(response.data)) {
      // 将所有ID转换为数字类型
      const idArray = response.data.map((id) => Number(id));
      return idArray;
    } else {
      return [];
    }
  } catch (error) {
    return [];
  }
}
/**
 * 比较两个ID数组是否相等（忽略顺序，处理字符串和数字类型）
 * @param {Array} array1
 * @param {Array} array2
 * @returns {boolean} 是否相等
 */
function compareIdArrays(array1, array2) {
  if (!Array.isArray(array1) || !Array.isArray(array2)) {
    return false;
  }
  if (array1.length !== array2.length) {
    return false;
  }
  // 将所有元素转换为数字并排序
  const sortedArray1 = array1.map((id) => Number(id)).sort((a, b) => a - b);
  const sortedArray2 = array2.map((id) => Number(id)).sort((a, b) => a - b);
  // 逐个比较
  for (let i = 0; i < sortedArray1.length; i++) {
    if (sortedArray1[i] !== sortedArray2[i]) {
      return false;
    }
  }
  return true;
}
/**
 * 检查是否需要同步（基于最大更新时间戳对应的ID数组）
 */
async function checkNeedSyncByUpdateTimeStamp(cb) {
  showMessage("检查同步中...", "long", "loading", "info");
  try {
    // 确保sync对象已初始化
    if (!sync) {
      sync = createSyncLogic();
    }
    // 获取本地和远程的ID数组
    const localIdArray = getLocalBiggestUpdateTimeStampIdArray();
    const remoteIdArray = await getRemoteBiggestUpdateTimeStampIdArray();
    // 比较两个数组
    const isEqual = compareIdArrays(localIdArray, remoteIdArray);
    if (!isEqual) {
      showMessage("检测到数据不同步, 正在跳转...", 2000, "loading", "info");
      // 跳转之前, 检测是否上锁
      if (sync.isSyncLocked()) {
        return;
      }
      // 强制跳转到study-info.html
      const currentWin = api.winName;
      if (currentWin === "studyInfo") {
        api.openWin({
          name: "studyInfo",
          url: "./study-info.html",
          reload: true,
          pageParam: { action: "auto" },
          animation: {
            type: "push",
            subType: "from_left",
          },
        });
      } else {
        api.openWin({
          name: "studyInfo",
          url: "./study-info.html",
          pageParam: { action: "auto" },
          animation: {
            type: "push",
            subType: "from_left",
          },
        });
      }
    } else {
      showMessage("数据已同步", 1000, "done", "success");
      if (cb && typeof cb === "function") {
        cb();
      }
    }
  } catch (error) {
    // 无法联网时不做任何操作
  }
}
// 通过level获取提醒时间, 返回提醒时间, 单位秒😎
function getRemindTimeDiffByLevelNumber(level) {
  level = Number(level);
  if (level < 0) level = 0;
  let remindTime;
  switch (parseInt(level, 10)) {
    case 0:
      // 15 分钟
      remindTime = 15 * 60;
      break;
    case 1:
      // 1 小时
      remindTime = 60 * 60;
      break;
    case 2:
      // 6 小时
      remindTime = 6 * 60 * 60;
      break;
    case 3:
      // 1 天
      remindTime = 24 * 60 * 60;
      break;
    case 4:
      // 3 天
      remindTime = 3 * 24 * 60 * 60;
      break;
    case 5:
      // 7 天
      remindTime = 7 * 24 * 60 * 60;
      break;
    default:
      // 视为已完全掌握，不再提醒（100 年）
      remindTime = 3153600000; // 100 年 = 100 * 365 * 24 * 60 * 60 = 3153600000 秒
      break;
  }
  return remindTime;
}
// 时间戳转时间字符串, eg 01:05:30😎
function formatTimeStamp(timestamp) {
  // 计算小时数
  const hours = Math.floor(timestamp / 3600);
  // 计算分钟数，先获取剩余秒数，再转换为分钟
  const minutes = Math.floor((timestamp % 3600) / 60);
  // 计算剩余秒数
  const seconds = timestamp % 60;
  // 将分钟和秒数转换为两位数字符串
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");
  // 如果小时数大于0，则包括小时数在内的完整时间格式
  if (hours > 0) {
    const formattedHours = String(hours).padStart(2, "0");
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  } else {
    // 否则，只返回分钟和秒数
    return `${formattedMinutes}:${formattedSeconds}`;
  }
}
// 剩余时间数字转剩余时间字符串, 返回 ***分钟😎
function timeStampToTimeString(timeNumber) {
  // 如果是负数, 提醒数据错误
  if (timeNumber < 0) {
    return "数据错误";
  }
  let seconds = parseInt(timeNumber, 10); // 确保输入是整数
  // 直接计算天、小时、分钟和秒
  const days = Math.floor(seconds / (60 * 60 * 24));
  seconds -= days * (60 * 60 * 24);
  const hours = Math.floor(seconds / (60 * 60));
  seconds -= hours * (60 * 60);
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  // 如果总时间为0，则特殊处理返回"0秒"
  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
    return "0秒";
  }
  // 使用数组和过滤来构建字符串，并避免显示值为0的单位
  const parts = [
    days > 0 ? `${days}天` : "",
    hours > 0 ? `${hours}小时` : "",
    minutes > 0 ? `${minutes}分` : "",
    seconds > 0 ? `${seconds}秒` : "",
  ].filter((part) => part !== ""); // 移除空字符串
  return parts.join(""); // 连接字符串
}
/**************** 通用功能函数 结束 ****************/
/**************** 数据库开始 ****************/
// 根据ID数组, 查询数据库中的笔记
function queryNotesByIds(ids) {
  let db = api.require("db");
  // 构建SQL查询语句
  const caseStatement = ids.map((id, index) => `WHEN id = ${id} THEN ${index}`).join(" ");
  const sqlQuery = `
	  SELECT * 
	  FROM note 
	  WHERE id IN (${ids.join(",")}) 
	  ORDER BY CASE ${caseStatement} END ASC;
	`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data;
}
function queryAllRemindNotesNumber(categories = [], needSubSearch = false) {
  let db = api.require("db");
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  // 基础查询条件统一使用 <=
  let sqlQuery = `
	  SELECT COUNT(*) AS count
	  FROM note
	  WHERE isDelete = 0
		AND remindTimeStamp <= ${currentTimeStamp}
	`;
  // 始终加入类别过滤条件（多个类别用 OR 拼接）
  if (Array.isArray(categories) && categories.length > 0) {
    sqlQuery += " AND (" + categories.map((category) => `category = '${category}'`).join(" OR ") + ")";
  }
  // 根据 needSubSearch 决定是否加入子查询条件
  if (needSubSearch) {
    sqlQuery += `
		AND remindTimeStamp >= (
		  SELECT MAX(remindTimeStamp) - 600
		  FROM note
		  WHERE remindTimeStamp <= ${currentTimeStamp} AND isDelete = 0
		);
	  `;
  } else {
    sqlQuery += ";";
  }
  try {
    let ret = db.selectSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status && ret.data.length > 0) {
      return Number(ret.data[0].count); // 确保返回的是数字类型
    } else {
      alert("Database query failed:", ret.msg);
      return 0;
    }
  } catch (error) {
    alert("Database operation encountered an error:", error);
    return 0;
  }
}
function queryAllRemindNotes(categories = [], needSubSearch = false) {
  let db = api.require("db");
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  // 基础查询条件统一使用 <=
  let sqlQuery = `
	  SELECT *
	  FROM note
	  WHERE isDelete = 0
		AND remindTimeStamp <= ${currentTimeStamp}
	`;
  // 始终加入类别过滤条件（多个类别用 OR 拼接）
  if (Array.isArray(categories) && categories.length > 0) {
    sqlQuery += " AND (" + categories.map((category) => `category = '${category}'`).join(" OR ") + ")";
  }
  // 根据 needSubSearch 决定是否加入子查询条件
  if (needSubSearch) {
    sqlQuery += `
		AND remindTimeStamp >= (
		  SELECT MAX(remindTimeStamp) - 600
		  FROM note
		  WHERE remindTimeStamp <= ${currentTimeStamp} AND isDelete = 0
		)
		ORDER BY id ASC;
	  `;
  } else {
    sqlQuery += `
		ORDER BY id DESC;
	  `;
  }
  try {
    let ret = db.selectSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status) {
      return ret.data;
    } else {
      alert("Database query failed:", ret.msg);
      return [];
    }
  } catch (error) {
    alert("Database operation encountered an error:", error);
    return [];
  }
}
// 支持分页查询的查询函数
function queryRemindNotesPaginated(offset = 0, limit = 10, categories = [], needSubSearch = false) {
  let db = api.require("db");
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  // 基础查询条件：提醒时间小于当前时间且未删除
  let sqlQuery = `
	  SELECT * FROM note 
	  WHERE remindTimeStamp < ${currentTimeStamp} 
		AND isDelete = 0
	`;
  // 当 needSubSearch 为 true 时，添加 updateTimeStamp 限制（最大时间戳的10分钟以内）
  if (needSubSearch) {
    sqlQuery += `
		AND remindTimeStamp >= (
		  SELECT MAX(remindTimeStamp) - 600
		  FROM note
		  WHERE remindTimeStamp < ${currentTimeStamp} AND isDelete = 0
		)
	  `;
  }
  // 处理类别过滤，多个类别之间使用 OR 连接
  if (Array.isArray(categories) && categories.length > 0) {
    const operator = "OR";
    const likeClauses = categories.map((category) => `category = '${category}'`).join(` ${operator} `);
    sqlQuery += ` AND (${likeClauses})`;
  }
  // 分页和排序
  sqlQuery += ` ORDER BY id ASC LIMIT ${limit} OFFSET ${offset};`;
  try {
    let ret = db.selectSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status) {
      return ret.data;
    } else {
      alert("数据库查询失败:", ret.msg);
      return []; // 查询失败时返回空数组
    }
  } catch (error) {
    alert("数据库操作时发生错误:", error);
    return []; // 捕获异常时返回空数组
  }
}
// 判断是否还有更多数据, 判断下一页是否有数据, 如果page=1, 则判断第二页是否有数据
function hasMoreData(offset = 0, limit = 10, categories = [], needSubSearch = false) {
  // 1. 获取 db 模块
  let db = api.require("db");
  // 2. 计算当前时间戳(秒)
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  // 3. 构建查询的通用过滤条件
  //    初步条件：提醒时间小于当前、未被删除
  let baseWhere = `
	  WHERE remindTimeStamp < ${currentTimeStamp}
		AND isDelete = 0
	`;
  // 如果传入了 categories 数组，则按照不同逻辑拼接
  if (Array.isArray(categories) && categories.length > 0) {
    // checkbox: 多选=>用 OR 连接; radio: 单选(或类似)=>用 AND 连接
    const operator = "OR";
    const categoryClauses = categories.map((cat) => `category = '${cat}'`).join(` ${operator} `);
    baseWhere += ` AND (${categoryClauses})`;
  }
  // 当 needSubSearch 为 true 时，增加 updateTimeStamp 限制：只返回 updateTimeStamp 在需要复习笔记中最大值前 10 分钟内的记录
  if (needSubSearch) {
    baseWhere += `
		AND remindTimeStamp >= (
			SELECT MAX(remindTimeStamp) - 600
			FROM note
			WHERE remindTimeStamp < ${currentTimeStamp} AND isDelete = 0
		)
	  `;
  }
  try {
    // 4. 查询总条数 (符合条件的记录总数)
    const countSql = `
		SELECT COUNT(*) AS totalCount
		FROM note
		${baseWhere};
	  `;
    const countRet = db.selectSqlSync({
      name: "studyApp",
      sql: countSql,
    });
    if (!countRet.status) {
      return {
        isHasMore: false,
        lastPage: 0,
      };
    }
    const totalRows = countRet.data?.[0]?.totalCount || 0; // 总记录数
    const lastRows = totalRows - offset; // 剩余记录数，offset 是已展示的记录数
    const lastPage = Math.ceil(lastRows / limit); // 剩余页数
    // 5. 分页查询数据
    const dataSql = `
		SELECT *
		FROM note
		${baseWhere}
		ORDER BY id ASC
		LIMIT ${limit} OFFSET ${offset};
	  `;
    const dataRet = db.selectSqlSync({
      name: "studyApp",
      sql: dataSql,
    });
    // 6. 判断是否还有下一页数据
    const isHasMore = lastRows > 0;
    return {
      isHasMore, // 是否还有下一页
      lastPage, // 剩余页数
    };
  } catch (err) {
    alert("数据库操作发生错误: " + JSON.stringify(err));
    return {
      isHasMore: false,
      lastPage: 0,
    };
  }
}
// 按类别查询数据库中的笔记，直接拼接SQL语句
function queryNoteByCategory(category) {
  let db = api.require("db");
  // 直接拼接SQL查询语句，注意确保category值的安全性以避免SQL注入
  const sqlQuery = `SELECT * FROM note WHERE category = '${category}' ORDER BY id ASC;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 检查查询是否成功
  if (ret.status) {
    return ret.data;
  } else {
    alert("查询失败:", ret.msg);
    return []; // 查询失败时返回空数组
  }
}
function queryCategorySearch() {
  let db = api.require("db");
  // 查询isDelete为0的数据
  const sqlQuery = `SELECT id, name, count FROM categorySearch WHERE isDelete=0 ORDER BY id ASC;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 返回格式化后的数组
  if (ret.status && ret.data && ret.data.length > 0) {
    return ret.data.map((item) => ({
      name: item.name,
      id: parseInt(item.id),
      count: parseInt(item.count, 10), // 确保 count 是数字类型
    }));
  } else {
    return [];
  }
}
function deleteCategorySearch(id) {
  // id 转数字
  id = Number(id);
  let db = api.require("db");
  let now = Math.floor(Date.now() / 1000);
  // 注意：id为字符串或数字都可以（插件会自动适配）
  try {
    let sql = `UPDATE categorySearch SET isDelete=1, updateTimeStamp=${now} WHERE id=${id};`;
    db.executeSql({
      name: "studyApp",
      sql: sql,
    });
  } catch (error) {
    console.error("Error in deleteCategorySearch:", JSON.stringify(error));
  }
}
// 还原删除的搜索记录
function restoreCategorySearch(id) {
  // id 转数字
  id = Number(id);
  let db = api.require("db");
  let now = Math.floor(Date.now() / 1000);
  // 注意：id为字符串或数字都可以（插件会自动适配）
  try {
    let sql = `UPDATE categorySearch SET isDelete=0, updateTimeStamp=${now} WHERE id=${id};`;
    db.executeSql({
      name: "studyApp",
      sql: sql,
    });
  } catch (error) {
    console.error("Error in restoreCategorySearch:", JSON.stringify(error));
  }
}
function addCategorySearch(name) {
  let db = api.require("db");
  let now = Math.floor(Date.now() / 1000);
  let safeName = name.replace(/'/g, "''"); // 处理单引号
  let result = null;
  try {
    // 查询是否已存在（未删除）
    let sqlCheck = `SELECT id, name, count FROM categorySearch WHERE name='${safeName}' AND isDelete=0;`;
    let checkRet = db.selectSqlSync({
      name: "studyApp",
      sql: sqlCheck,
    });
    if (checkRet.status && checkRet.data && checkRet.data.length > 0) {
      // 已存在：count+1，更新updateTimeStamp
      let row = checkRet.data[0];
      let newCount = parseInt(row.count) + 1;
      let sqlUpdate = `UPDATE categorySearch SET count=${newCount}, updateTimeStamp=${now} WHERE id=${row.id};`;
      db.executeSql({
        name: "studyApp",
        sql: sqlUpdate,
      });
      // 再查一次，返回最新数据
      let sqlGet = `SELECT * FROM categorySearch WHERE id=${row.id};`;
      let getRet = db.selectSqlSync({
        name: "studyApp",
        sql: sqlGet,
      });
      if (getRet.status && getRet.data && getRet.data.length > 0) {
        result = getRet.data[0];
      }
    } else {
      // 不存在：插入新数据
      let sqlInsert = `INSERT INTO categorySearch (name, count, addTimeStamp, updateTimeStamp, isDelete) VALUES ('${safeName}', 1, ${now}, ${now}, 0);`;
      db.executeSql({
        name: "studyApp",
        sql: sqlInsert,
      });
      // 查找刚插入的记录（可用 rowid 或用 name 查询）
      let sqlGet = `SELECT * FROM categorySearch WHERE name='${safeName}' AND addTimeStamp=${now};`;
      let getRet = db.selectSqlSync({
        name: "studyApp",
        sql: sqlGet,
      });
      if (getRet.status && getRet.data && getRet.data.length > 0) {
        result = getRet.data[0];
      }
    }
  } catch (error) {
    console.error("Error in addCategorySearch:", JSON.stringify(error));
  }
  // 将结果中的特定字段转换为数字类型
  if (result) {
    ["id", "count", "addTimeStamp", "updateTimeStamp", "isDelete"].forEach((key) => {
      if (result[key] !== undefined) {
        result[key] = parseInt(result[key], 10);
      }
    });
  }
  // 返回结果
  return result;
}
// 查询数据库中所有的笔记😎
function queryAllNotes() {
  let db = api.require("db");
  // 拼接SQL查询语句
  const sqlQuery = `SELECT * FROM note ORDER BY id ASC;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data;
}
function queryAllMusics() {
  let db = api.require("db");
  // 拼接SQL查询语句
  const sqlQuery = `SELECT * FROM music ORDER BY id ASC;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data;
}
// 查询笔记数量😎
function queryNoteCount() {
  let db = api.require("db");
  // 修改SQL查询语句以计算笔记数量
  const sqlQuery = `SELECT COUNT(*) AS noteCount FROM note;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 假设返回的数据结构中，查询结果存储在data数组的第一个元素
  if (ret && ret.data && ret.data.length > 0) {
    return Number(ret.data[0].noteCount);
  } else {
    // 如果查询失败或没有找到数据，返回0或适当的错误处理
    return 0;
  }
}
// 查询距离最近一次提醒, 还有多久, 返回差值, 单位秒😎
function getRemindTime() {
  let db = api.require("db");
  // 拼接SQL查询语句
  const sqlQuery = "SELECT * FROM note WHERE isDelete = 0 ORDER BY remindTimeStamp ASC LIMIT 1;";
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 计算获取的时间戳和当前时间的差值, 单位秒
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  const remindTimeStamp = Number(ret.data[0].remindTimeStamp);
  const timeDiff = remindTimeStamp - currentTimeStamp;
  // 返回差值
  return timeDiff;
}
// 清除所有笔记, 清空数据表😎
function clearNotes() {
  let db = api.require("db");
  // 拼接SQL语句
  const sqlQuery = "DELETE FROM note";
  let ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret;
}
// 插入数据到数据库, 接收一个数据对象😎
function insertLocalNoteByData(data) {
  let db = api.require("db");
  try {
    // 拼接SQL语句
    let replacedSide1 = data.side1.replace(/'/g, "’");
    let replacedSide2 = data.side2.replace(/'/g, "’");
    let sqlQuery = `INSERT INTO note (id, side1, side2, level, remindTimeStamp, addTimeStamp, updateTimeStamp, category, isDelete, hasAI, alignCode) VALUES (${data.id}, '${replacedSide1}', '${replacedSide2}', ${data.level}, ${data.remindTimeStamp}, ${data.addTimeStamp}, ${data.updateTimeStamp}, '${data.category}', ${data.isDelete}, ${data.hasAI}, '${data.alignCode}');`;
    let ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (!ret.status) {
      console.error("SQL execution failed:", ret.msg);
    }
    return ret;
  } catch (error) {
    console.error("Error executing SQL:", error);
    return { status: false, error };
  }
}
function insertLocalMusicByData(music) {
  let db = api.require("db");
  // 用于转义字符串中的单引号，防止 SQL 注入或语法错误
  const escapeSingleQuotes = (str) => {
    if (typeof str !== "string") return str;
    return str.replace(/'/g, "''");
  };
  try {
    let sqlQuery = ` INSERT INTO music (id, src, title, speed, count, start, addTimeStamp, updateTimeStamp) VALUES (${
      music.id
    }, '${music.src}', '${escapeSingleQuotes(music.title)}', ${music.speed}, ${music.count}, '${music.start}', ${
      music.addTimeStamp
    }, ${music.updateTimeStamp}); `;
    let ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    return ret;
  } catch (error) {
    alert("Error executing SQL:", error);
    return null;
  }
}
// 通过id, 从数据库中, 查询数据😎
function queryNoteById(id) {
  // 确保id是数字类型
  id = Number(id);
  let db = api.require("db");
  // 拼接SQL语句
  let sqlQuery = `SELECT * FROM note WHERE id = ${id};`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data[0];
}
// 通过id, 更新数据, 把所有的数据都更新😎
function updateNoteByData(data) {
  try {
    // 因为是更新, 添加更新时间戳, 当前秒级时间戳
    data.updateTimeStamp = parseInt(Date.now() / 1000);
    let db = api.require("db");
    // 初始化SQL语句的基础部分
    let sqlQuery = "UPDATE note SET ";
    let updates = [];
    // 遍历data对象, 为每个存在的属性添加到SQL语句中
    for (let key in data) {
      // 排除id属性
      if (key === "id") continue;
      // 检查属性是否存在于data中
      if (data.hasOwnProperty(key) && data[key] !== undefined) {
        if (typeof data[key] === "string") {
          // 对字符串进行转义（避免 SQL 注入或语法错误）
          let safeValue = data[key].replace(/'/g, "''");
          updates.push(`${key} = '${safeValue}'`);
        } else {
          updates.push(`${key} = ${data[key]}`);
        }
      }
    }
    // 拼接完整SQL语句
    sqlQuery += updates.join(", ") + ` WHERE id = ${data.id};`;
    // 执行SQL语句
    let ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    // 返回执行结果
    return ret;
  } catch (error) {
    console.error("❌ SQL 执行出错:", JSON.stringify(error, null, 2));
    return { status: false, error };
  }
}
function addCodeToAlignment(alignCode) {
  const db = api.require("db");
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const sqlQuery = `INSERT INTO alignCode (alignCode, addTimeStamp) VALUES ('${alignCode}', ${currentTimestamp});`;
  let ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  if (ret.status) {
  } else {
    alert("SQL insert failed: " + JSON.stringify(ret));
  }
  return ret;
}
// 删除数据专用
function deleteNoteByData(data) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const id = data.id;
  // Save deletion info locally for recovery
  localStorage.setItem("lastDeleteNoteInfo", JSON.stringify({ id, deleteTimeStamp: currentTimestamp }));
  const sqlQuery = `UPDATE note SET isDelete = 1, updateTimeStamp = ${currentTimestamp} WHERE id = ${id};`;
  const db = api.require("db");
  let ret;
  try {
    ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status) {
    } else {
      alert("SQL delete failed: " + JSON.stringify(ret));
    }
  } catch (error) {
    console.error("Error executing SQL delete:", error);
    ret = { status: false, error };
  }
  return ret;
}
// 还原笔记, 通过localstorage数据, 还原笔记😎
function restoreDeleteNote() {
  const lastDeleteNoteInfoString = localStorage.getItem("lastDeleteNoteInfo");
  if (!lastDeleteNoteInfoString) {
    console.warn("没有找到需要还原的笔记信息。");
    return;
  }
  let lastDeleteNoteInfo;
  try {
    lastDeleteNoteInfo = JSON.parse(lastDeleteNoteInfoString);
  } catch (parseError) {
    console.error("解析最后删除的笔记信息失败:", parseError);
    return;
  }
  const lastDeleteNoteId = Number(lastDeleteNoteInfo.id);
  if (isNaN(lastDeleteNoteId)) {
    console.error("无效的笔记ID。");
    return;
  }
  const noteData = { id: lastDeleteNoteId, isDelete: 0 };
  try {
    updateNoteByData(noteData);
    localStorage.removeItem("lastDeleteNoteInfo");
    showMessage("还原成功!", 1000, "restore", "success");
  } catch (error) {
    console.error("还原笔记失败:", error);
    alert("恢复失败，请重试。");
  }
}
// 检查localstorage中是否有最后删除的笔记, 如果有, toast提示用户, 点击可以还原😎
function checkLastDeleteNote() {
  const lastDeleteNoteInfoString = localStorage.getItem("lastDeleteNoteInfo");
  if (!lastDeleteNoteInfoString) {
    console.warn("没有找到需要还原的笔记信息。");
    return;
  }
  let lastDeleteNoteInfo;
  try {
    lastDeleteNoteInfo = JSON.parse(lastDeleteNoteInfoString);
  } catch (parseError) {
    console.error("解析最后删除的笔记信息失败:", parseError);
    return;
  }
  // 当前时间戳
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (currentTimestamp - lastDeleteNoteInfo.deleteTimeStamp > 5) {
    localStorage.removeItem("lastDeleteNoteInfo");
    return;
  }
  const lastDeleteNoteId = Number(lastDeleteNoteInfo.id);
  if (isNaN(lastDeleteNoteId)) {
    console.error("无效的笔记ID。");
    return;
  }
  showMessage("删除成功, 点击可还原!", 3000, "delete2", "warning", "center", restoreDeleteNote);
}
// 通过id, 更新数据, 把所有的数据都更新😎, 只适合从远程数据库同步数据到本地数据库
function updateLocalNoteByData(data) {
  let db = api.require("db");
  let ret = null;
  // 定义一个函数，用于转义单引号
  const escapeSingleQuotes = (str) => str.replace(/'/g, "''");
  try {
    // 拼接SQL语句，并对字符串字段进行引号转义
    let sqlQuery = `UPDATE note SET side1 = '${escapeSingleQuotes(data.side1)}', side2 = '${escapeSingleQuotes(
      data.side2
    )}', level = ${data.level}, remindTimeStamp = ${data.remindTimeStamp}, updateTimeStamp = ${
      data.updateTimeStamp
    }, category = '${escapeSingleQuotes(data.category)}', alignCode = '${data.alignCode}', addTimeStamp = ${
      data.addTimeStamp
    }, isDelete = ${data.isDelete}, hasAI = ${data.hasAI} WHERE id = ${data.id};`;
    // 执行SQL查询
    ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    // 检查返回结果
    if (ret.status) {
    } else {
      alert("SQL update failed:", JSON.stringify(ret));
    }
  } catch (error) {
    // 捕获并打印异常
    alert("Error executing SQL:", error);
  }
  return ret;
}
function updateLocalMusicByData(music) {
  let db = api.require("db");
  let ret = null;
  // 用于转义字符串中的单引号，防止 SQL 注入或语法错误
  const escapeSingleQuotes = (str) => {
    if (typeof str !== "string") return str;
    return str.replace(/'/g, "''");
  };
  try {
    let sqlQuery = `
		UPDATE music 
		SET 
		  src = '${music.src}',
		  title = '${escapeSingleQuotes(music.title)}',
		  speed = ${music.speed},
		  count = ${music.count},
		  start = '${music.start}',
		  addTimeStamp = ${music.addTimeStamp},
		  updateTimeStamp = ${music.updateTimeStamp}
		WHERE id = ${music.id}
	  `;
    ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status) {
    } else {
      alert("SQL update failed:", JSON.stringify(ret));
    }
  } catch (error) {
    alert("Error executing SQL:", error);
  }
  return ret;
}
/**************** 数据库结束 ****************/
/**************** ajax请求 ****************/
// ajax 基础url
const globalConfigBaseURL = "后端接口域名";
// get 请求😎
function apiAjaxGetRequest(url) {
  api.cancelAjax({
    tag: "getRequest",
  });
  return new Promise((resolve, reject) => {
    // alert("发送了get请求");
    api.ajax(
      {
        url: globalConfigBaseURL + url,
        method: "get",
        timeout: 300000, // 5分钟超时
        tag: "getRequest",
      },
      function (ret, err) {
        if (ret) {
          resolve(ret);
        } else {
          alert(JSON.stringify(err), "error");
          reject(err); // 调用 reject 并传递错误信息
        }
      }
    );
  });
}
// post 请求😎
function apiAjaxPostRequest(url, data) {
  api.cancelAjax({
    tag: "postRequest",
  });
  return new Promise((resolve, reject) => {
    // alert("发送了post请求");
    api.ajax(
      {
        url: globalConfigBaseURL + url,
        method: "post",
        // timeout: 300000, // 5分钟超时
        headers: {
          "Content-Type": "application/json;charset=utf-8",
        },
        data: {
          body: data,
        },
        tag: "postRequest",
      },
      function (ret, err) {
        if (ret) {
          resolve(ret);
        } else {
          alert(JSON.stringify(err), "error");
        }
      }
    );
  });
}
// delete 请求😎
function apiAjaxDeleteRequest(url, data) {
  api.cancelAjax({
    tag: "deleteRequest",
  });
  return new Promise((resolve, reject) => {
    // alert("发送了delete请求");
    api.ajax(
      {
        url: globalConfigBaseURL + url,
        method: "post",
        // timeout: 300000, // 5分钟超时
        headers: {
          "Content-Type": "application/json;charset=utf-8",
        },
        data: {
          body: data,
        },
        tag: "deleteRequest",
      },
      function (ret, err) {
        if (ret) {
          resolve(ret);
        } else {
          alert(JSON.stringify(err), "error");
        }
      }
    );
  });
}
function apiAjaxPutRequest(url, data) {
  // 取消之前的 PUT 请求（如果有）
  api.cancelAjax({
    tag: "putRequest",
  });
  return new Promise((resolve, reject) => {
    // alert("PUT 请求已发送");
    api.ajax(
      {
        url: globalConfigBaseURL + url,
        method: "put",
        headers: {
          "Content-Type": "application/json;charset=utf-8",
        },
        data: {
          body: data,
        },
        tag: "putRequest",
      },
      function (ret, err) {
        if (ret) {
          // 请求成功，处理返回数据
          resolve(ret);
        } else {
          // 请求失败，显示错误信息并拒绝 Promise
          alert(JSON.stringify(err), "error");
        }
      }
    );
  });
}
/**************** ajax 请求结束 ****************/
function getPathByUrl(url) {
  // 通过url, 从urlMap中获取path
  let db = api.require("db");
  let sqlQuery = `SELECT path FROM urlMap WHERE url = '${url}';`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  if (ret.data.length == 0) {
    return "";
  } else {
    return ret.data[0].path;
  }
}
function insertUrl(url, path) {
  let db = api.require("db");
  let sqlQuery = `INSERT INTO urlMap (url, path) VALUES ('${url}', '${path}');`;
  let ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret;
}
function queryAllUrlMaps() {
  let db = api.require("db");
  let sqlQuery = `SELECT url FROM urlMap;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data;
}
function checkNoteAudioSourceForDownloadLocal() {
  const startTime = Date.now();
  const noteArray = queryAllNotes();
  const urlRegex = /https:\/\/[^\s"')]+/g;
  const allUrls = new Set();
  noteArray.forEach((note) => {
    const checkContent = (note.side1 || "") + (note.side2 || "");
    const urls = checkContent.match(urlRegex) || [];
    urls.forEach((url) => {
      allUrls.add(url);
    });
  });
  const urlArray = Array.from(allUrls);
  const urlMapsArray = queryAllUrlMaps().map((item) => item.url);
  const urlMapsSet = new Set(urlMapsArray);
  const needDownloadUrls = urlArray.filter((url) => !urlMapsSet.has(url));
  const endTime = Date.now();
  return needDownloadUrls;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// 单批异步查询
function queryNotesByPage(offset, limit) {
  return new Promise((resolve, reject) => {
    const db = api.require("db");
    const sqlQuery = `SELECT * FROM note ORDER BY id ASC LIMIT ${limit} OFFSET ${offset};`;
    db.selectSql(
      {
        name: "studyApp",
        sql: sqlQuery,
      },
      function (ret, err) {
        if (ret && ret.status) {
          resolve(ret.data || []);
        } else {
          reject(err || ret);
        }
      }
    );
  });
}
function queryAllUrlMapsAsync() {
  return new Promise((resolve, reject) => {
    const db = api.require("db");
    db.selectSql(
      {
        name: "studyApp",
        sql: "SELECT url FROM urlMap;",
      },
      function (ret, err) {
        if (ret && ret.status) {
          resolve(ret.data || []);
        } else {
          reject(err || ret);
        }
      }
    );
  });
}
function queryNoteTotalCount() {
  return new Promise((resolve, reject) => {
    const db = api.require("db");
    db.selectSql(
      {
        name: "studyApp",
        sql: "SELECT COUNT(*) AS cnt FROM note;",
      },
      function (ret, err) {
        if (ret && ret.status) {
          resolve(ret.data[0].cnt || 0);
        } else {
          reject(err || ret);
        }
      }
    );
  });
}
async function checkNoteAudioSourceForDownloadLocalPaged(batchSize = 1000, updateProgress = null) {
  const urlRegex = /https:\/\/[^\s"')]+/g;
  const allUrls = new Set();
  let offset = 0;
  let processedNotes = 0;
  // 先查总数
  const totalNotes = await queryNoteTotalCount();
  let hasMore = true;
  while (hasMore) {
    const notes = await queryNotesByPage(offset, batchSize);
    if (!notes.length) {
      hasMore = false;
      break;
    }
    for (const note of notes) {
      const checkContent = (note.side1 || "") + (note.side2 || "");
      const urls = checkContent.match(urlRegex) || [];
      urls.forEach((url) => allUrls.add(url));
    }
    offset += notes.length;
    processedNotes += notes.length;
    // **带百分比的实时进度条**
    if (typeof updateProgress === "function") {
      const percent = totalNotes ? Math.round((processedNotes / totalNotes) * 100) : null;
      updateProgress(percent, `扫描中：${processedNotes}/${totalNotes} 条`);
    }
    // await sleep(10);
  }
  if (typeof updateProgress === "function") {
    updateProgress(100, `🎉 扫描完成：共处理 ${processedNotes} 条`);
  }
  const urlMapsArray = await queryAllUrlMapsAsync();
  const urlMapsSet = new Set(urlMapsArray.map((item) => item.url));
  const urlArray = Array.from(allUrls);
  const needDownloadUrls = urlArray.filter((url) => !urlMapsSet.has(url));
  return needDownloadUrls;
}
function checkMusicAudioSourceForDownloadLocal() {
  const musicArray = queryAllMusics();
  const needDownloadUrls = new Set();
  musicArray.forEach((music) => {
    const url = music.src;
    if (!getPathByUrl(url)) {
      needDownloadUrls.add(url);
    }
  });
  return Array.from(needDownloadUrls);
}
// 通过url, 下载文件, 并返回path
function savePathFromUrl(url) {
  return new Promise((resolve, reject) => {
    const savePath = api.fsDir + "/download/" + url.split("/").pop();
    api.download(
      {
        url: url,
        savePath: savePath,
        report: false,
        cache: false,
        allowResume: false,
      },
      function (ret, err) {
        if (ret && ret.state === 1) {
          insertUrl(url, savePath);
          resolve(savePath);
        } else {
          alert("下载文件失败", JSON.stringify(err));
          reject(err);
        }
      }
    );
  });
}
function insertDataToAppInfo(appInfoData, appState) {
  const { noteNumber, jpushID, remindTimeStamp } = appInfoData;
  let db = api.require("db");
  // 获取当前时间戳
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  if (appState === "front") {
    // 插入新记录 (status 为 'front')
    let sqlQuery = `
		INSERT INTO appInfo (noteNumber, jpushID, remindTimeStamp, addTimeStamp, updateTimeStamp, startTimeStamp, endTimeStamp)
		VALUES (${noteNumber}, '${jpushID}', ${remindTimeStamp}, ${currentTimeStamp}, ${currentTimeStamp}, ${currentTimeStamp}, 0);
	  `;
    let ret = db.executeSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    return ret.data;
  } else if (appState === "back") {
    // 查找最近的记录
    let selectQuery = ` SELECT id, startTimeStamp FROM appInfo ORDER BY id DESC LIMIT 1; `;
    let lastRecord = db.selectSqlSync({
      name: "studyApp",
      sql: selectQuery,
    });
    if (lastRecord.data && lastRecord.data.length > 0) {
      // 获取找到的记录信息
      let lastRecordId = lastRecord.data[0].id;
      let startTimeStamp = lastRecord.data[0].startTimeStamp;
      // 计算时间差
      let timeSpan = currentTimeStamp - startTimeStamp;
      // 更新记录
      let updateQuery = `
		UPDATE appInfo
		SET endTimeStamp = ${currentTimeStamp}, updateTimeStamp = ${currentTimeStamp}, timeSpan = ${timeSpan}, noteNumber = ${noteNumber}, remindTimeStamp = ${remindTimeStamp}
		WHERE id = ${lastRecordId};
		`;
      let ret = db.executeSqlSync({
        name: "studyApp",
        sql: updateQuery,
      });
      return ret.data;
    } else {
      alert("insertDataToAppInfo, 未找到对应记录进行更新");
    }
  } else {
    alert("insertDataToAppInfo, 无效的状态");
  }
}
function downgradeCategory(category, needSubSearch = false) {
  // 查询指定分类的 note（注意：queryAllRemindNotes 要求传入数组）
  const notes = queryAllRemindNotes([category], needSubSearch);
  let modifiedCount = 0;
  // 获取当前时间戳
  const currentTime = Math.floor(Date.now() / 1000);
  // 如果存在符合条件的 note，则遍历更新
  if (notes && notes.length > 0) {
    notes.forEach((note) => {
      // 确保 level 为数字
      note.level = Number(note.level);
      // 执行降级操作：大于 0 则减 1，否则保持 0
      if (note.level > 0) {
        note.level -= 1;
      } else {
        note.level = 0;
      }
      // 重新设置提醒时间，假设 getRemindTimeDiffByLevelNumber(0) 返回 level 为 0 时的时间差
      note.remindTimeStamp = currentTime + getRemindTimeDiffByLevelNumber(0);
      // 构造更新数据对象，同时增加 updateTimeStamp 字段
      const updateNoteData = {
        id: note.id,
        level: note.level,
        remindTimeStamp: note.remindTimeStamp,
        updateTimeStamp: currentTime,
      };
      // 更新数据库中的 note（这里假定 updateNoteByData 同步执行更新操作）
      updateNoteByData(updateNoteData);
      modifiedCount++;
    });
  }
  // 返回更新成功的状态和修改的记录数
  return { status: true, modifiedCount: modifiedCount };
}
function upgradeCategory(category, needSubSearch = false) {
  // 查询指定分类的 note（注意 queryAllRemindNotes 要求传入数组）
  const notes = queryAllRemindNotes([category], needSubSearch);
  let modifiedCount = 0;
  // 获取当前时间戳
  const currentTime = Math.floor(Date.now() / 1000);
  if (notes && notes.length > 0) {
    notes.forEach((note) => {
      // 确保 level 为数字
      note.level = Number(note.level);
      // 执行升级操作：level 增加 1
      note.level += 1;
      // 重新设置提醒时间
      note.remindTimeStamp = currentTime + getRemindTimeDiffByLevelNumber(note.level);
      // 构造更新数据对象，同时更新 isDelete 和 updateTimeStamp 字段
      const updateNoteData = {
        id: note.id,
        level: note.level,
        remindTimeStamp: note.remindTimeStamp,
        isDelete: note.isDelete,
        updateTimeStamp: currentTime,
      };
      // 更新数据库中的 note
      updateNoteByData(updateNoteData);
      modifiedCount++;
    });
  }
  // 返回更新成功的状态和修改的记录数
  return { status: true, modifiedCount: modifiedCount };
}
function deleteCategory(category) {
  let db = api.require("db");
  let currentTime = Math.floor(Date.now() / 1000);
  let sqlQuery = `
		UPDATE note
		SET isDelete = 1, updateTimeStamp = ${currentTime}
		WHERE category = '${category}';
	  `;
  let ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret;
}
function updateCategoryName(oldCategory, newCategory) {
  let db = api.require("db");
  let currentTime = Math.floor(Date.now() / 1000);
  let sqlQuery = `
	  UPDATE note
	  SET category = '${newCategory}', updateTimeStamp = ${currentTime}
	  WHERE category = '${oldCategory}';
	`;
  let ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret;
}
function updateCardSide2(id, side2Content) {
  let db = api.require("db");
  let currentTime = Math.floor(Date.now() / 1000);
  let sqlQuery = `
	  UPDATE note
	  SET side2 = '${side2Content}', updateTimeStamp = ${currentTime}
	  WHERE id = ${id};
	`;
  let ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret;
}
function getRandomSong() {
  let db = api.require("db");
  // 获取 count 最小值的歌曲（只返回一首随机歌曲）
  let sqlQuery = `SELECT * FROM music WHERE count = (SELECT MIN(count) FROM music) ORDER BY RANDOM() LIMIT 1`;
  let songsResult = db.selectSqlSync({
    name: "studyApp", // 数据库名称
    sql: sqlQuery,
  });
  if (!songsResult || !songsResult.data || songsResult.data.length === 0) {
    return {
      errno: 1,
      message: "没有符合条件的歌曲",
      data: null,
    };
  }
  let randomSong = songsResult.data[0];
  // 更新该歌曲的播放计数
  let sqlQueryUpdate = `UPDATE music SET count = count + 1 WHERE id = ${randomSong.id}`;
  db.executeSqlSync({
    name: "studyApp", // 数据库名称
    sql: sqlQueryUpdate,
  });
  // 返回成功的响应格式
  return {
    errno: 0,
    message: "请求成功，count 已自增!",
    data: randomSong,
  };
}
// 根据关键词数组, 搜索笔记的side1字段
function searchNoteByKeywords(keywordArray) {
  let db = api.require("db");
  // 构建SQL查询语句
  let sqlQuery = `SELECT * FROM note WHERE (${keywordArray
    .map((keyword) => `side1 LIKE '%${keyword}%'`)
    .join(" AND ")}) AND isDelete = 0 AND level <= 7 ORDER BY updateTimeStamp ASC;`;
  let ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data;
}
function numberToEmoji(num) {
  // 建立数字到 Keycap 表情的映射关系
  const digitMap = {
    0: "0️⃣",
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
    4: "4️⃣",
    5: "5️⃣",
    6: "6️⃣",
    7: "7️⃣",
    8: "8️⃣",
    9: "9️⃣",
  };
  // 转成字符串后依次映射并拼接
  return String(num)
    .split("")
    .map((digit) => digitMap[digit])
    .join("");
}
function getSearchedCategory(inputCategoryList = [], relationship = "OR") {
  let db = api.require("db");
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  // 检查输入是否为空
  if (!Array.isArray(inputCategoryList) || inputCategoryList.length === 0) {
    return []; // 如果输入为空，直接返回空数组
  }
  // 构建 SQL 查询语句
  let sqlQuery = `
		SELECT DISTINCT category AS category
		FROM note 
		WHERE remindTimeStamp < ${currentTimeStamp} 
		  AND isDelete = 0 
	  `;
  // 根据 relationship 构建条件
  const operator = relationship.toUpperCase() === "AND" ? "AND" : "OR";
  const likeClauses = inputCategoryList.map((keyword) => `category LIKE '%${keyword}%'`).join(` ${operator} `);
  sqlQuery += ` AND (${likeClauses})`;
  // 执行 SQL 查询
  try {
    let ret = db.selectSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status) {
      // 在 JavaScript 中再次去重（如果数据库仍有重复）
      const uniqueCategories = [...new Set(ret.data.map((row) => row.category))];
      return uniqueCategories; // 返回去重后的分类名称数组
    } else {
      alert("Database query failed: " + ret.msg);
      return []; // 查询失败时返回空数组
    }
  } catch (error) {
    alert("Database operation encountered an error: " + error);
    return []; // 捕获异常时返回空数组
  }
}
function getAllCategories() {
  let db = api.require("db");
  const currentTimeStamp = Math.floor(Date.now() / 1000);
  // 构建 SQL 查询语句，获取所有有效的分类
  let sqlQuery = `
    SELECT DISTINCT category AS category
    FROM note 
    WHERE remindTimeStamp < ${currentTimeStamp} 
      AND isDelete = 0 
      AND category IS NOT NULL 
      AND category != ''
    ORDER BY category ASC
  `;
  // 执行 SQL 查询
  try {
    let ret = db.selectSqlSync({
      name: "studyApp",
      sql: sqlQuery,
    });
    if (ret.status) {
      // 在 JavaScript 中再次去重（如果数据库仍有重复）
      const uniqueCategories = [...new Set(ret.data.map((row) => row.category))];
      return uniqueCategories; // 返回去重后的分类名称数组
    } else {
      alert("Database query failed: " + ret.msg);
      return []; // 查询失败时返回空数组
    }
  } catch (error) {
    alert("Database operation encountered an error: " + error);
    return []; // 捕获异常时返回空数组
  }
}
function sendNotification(title, content, vibrate = [100, 500, 100, 500]) {
  api.notification(
    {
      notify: {
        title: title || "",
        content: content || "➖➖➖➖➖➖➖➖➖➖➖➖", // 适合做分隔符的符号➰ ➖ 〰️ 💤 🎵 ♾ 🔼 ⛔️ ⭕️ 💞 💨 💫 ✨ ⚡️ 🪐 👏
      },
      vibrate: vibrate,
    },
    function (ret, err) {
      if (ret) {
      } else {
        console.error("通知发送失败:", err);
      }
    }
  );
}
