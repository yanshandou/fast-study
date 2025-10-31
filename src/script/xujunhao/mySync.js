// ------------------------------------------------------------------
// mySync.js - 本地与远程数据同步函数合集
// 主要封装：基于时间戳对比的增量同步、SQL 本地操作、PHP 分页接口
// ------------------------------------------------------------------

/**
 * 根据时间戳差异查询本地待推送的 Note 数据
 * @param {number} localNoteBiggestUpdateTimeStamp - 本地最新的 updateTimeStamp
 * @param {number} remoteNoteBiggestUpdateTimeStamp - 远程最新的 updateTimeStamp
 * @returns {Array<Object>} 返回所有需要推送的记录数组
 */
function getDataForUpdateNoteFromLocalToRemote(localNoteBiggestUpdateTimeStamp, remoteNoteBiggestUpdateTimeStamp) {
  const sqlQuery = `SELECT * FROM note WHERE updateTimeStamp > ${remoteNoteBiggestUpdateTimeStamp} AND updateTimeStamp <= ${localNoteBiggestUpdateTimeStamp}`;
  const sqlResult = runSelectSql(sqlQuery);
  return sqlResult;
}
/**
 * 获取本地 categorySearch 表中需要更新到远程的数据
 * @param {number} localCategorySearchBiggestUpdateTimeStamp - 本地最大更新时间戳
 * @param {number} remoteCategorySearchBiggestUpdateTimeStamp - 远程最大更新时间戳
 * @param {number} remoteCategorySearchBiggestAddTimeStamp - 远程最大新增时间戳
 * @returns {Array<Object>} 需要更新到远程的数据数组
 * @description 查询本地 categorySearch 表中需要更新到远程的数据，
 * 条件为：更新时间戳大于远程最大更新时间戳且小于等于本地最大更新时间戳，
 * 并且新增时间戳小于等于远程最大新增时间戳。
 * 大于远程最大新增时间戳的记录走新增逻辑，小于等于的走更新逻辑。
 */
function getDataForUpdateCategorySearchFromLocalToRemote(
  localCategorySearchBiggestUpdateTimeStamp,
  remoteCategorySearchBiggestUpdateTimeStamp,
  remoteCategorySearchBiggestAddTimeStamp
) {
  const sqlQuery = `SELECT * FROM categorySearch WHERE updateTimeStamp > ${remoteCategorySearchBiggestUpdateTimeStamp} AND updateTimeStamp <= ${localCategorySearchBiggestUpdateTimeStamp} AND addTimeStamp <= ${remoteCategorySearchBiggestAddTimeStamp}`;
  const sqlResult = runSelectSql(sqlQuery);
  return sqlResult;
}

/**
 * 获取本地 categorySearch 表中需要新增到远程的数据
 * @param {number} localCategorySearchBiggestAddTimeStamp - 本地最大新增时间戳
 * @param {number} remoteCategorySearchBiggestAddTimeStamp - 远程最大新增时间戳
 * @returns {Array<Object>} 需要新增到远程的数据数组
 * @description 查询本地 categorySearch 表中需要新增到远程的数据，
 * 条件为：本地新增时间戳大于远程更新时间戳的数据
 */
function getDataForAddCategorySearchFromLocalToRemote(
  localCategorySearchBiggestAddTimeStamp,
  remoteCategorySearchBiggestAddTimeStamp
) {
  const sqlQuery = `SELECT * FROM categorySearch WHERE addTimeStamp > ${remoteCategorySearchBiggestAddTimeStamp} AND addTimeStamp <= ${localCategorySearchBiggestAddTimeStamp}`;
  const sqlResult = runSelectSql(sqlQuery);
  return sqlResult;
}

/**
 * 将本地 Note 数据批量推送到远程服务器
 * @param {Array<Object>} noteArray - 需同步到远端的笔记对象数组
 * @returns {Promise<Object>} 返回接口调用结果，包括 errno、message
 */
async function updateNoteFromLocalToRemote(noteArray) {
  const syncResponse = await apiAjaxPutRequest("updateMany.php", noteArray);
  return syncResponse;
}

/**
 * 将本地 CategorySearch 数据批量更新到远程服务器
 * @param {Array<Object>} categorySearchArray - 需同步到远端的分类搜索对象数组
 * @returns {Promise<Object>} 返回接口调用结果，包括 errno、message
 */
async function updateCategorySearchFromLocalToRemote(categorySearchArray) {
  const syncResponse = await apiAjaxPutRequest("updateManyCategorySearch.php", categorySearchArray);
  return syncResponse;
}

/**
 * 将本地 CategorySearch 数据批量新增到远程服务器
 * @param {Array<Object>} categorySearchArray - 需新增到远端的分类搜索对象数组
 * @returns {Promise<Object>} 返回接口调用结果，包括 errno、message
 */
async function addCategorySearchFromLocalToRemote(categorySearchArray) {
  const syncResponse = await apiAjaxPostRequest("addManyCategorySearch.php", categorySearchArray);
  return syncResponse;
}

/**
 * 从远程获取需要更新到本地的 CategorySearch 数据
 * @param {number} biggestUpdateTimeStamp - 远程最大更新时间戳
 * @param {number} biggestAddTimeStamp - 远程最大新增时间戳
 * @returns {Promise<Array<Object>|undefined>} 返回需要更新到本地的分类搜索数组，失败时返回 undefined
 */
async function getDataForUpdateCategorySearchFromRemoteToLocal(biggestUpdateTimeStamp, biggestAddTimeStamp) {
  const queryUpdateUrl = `queryNeedUpdateCategorySearch.php?addTime=${biggestAddTimeStamp}&updateTime=${biggestUpdateTimeStamp}`;
  const updateCategorySearchArrResult = await apiAjaxGetRequest(queryUpdateUrl);
  if (updateCategorySearchArrResult.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(updateCategorySearchArrResult.message);
    return;
  }
  return updateCategorySearchArrResult.data;
}

/**
 * 从远程获取需要新增到本地的 CategorySearch 数据
 * @param {number} biggestAddTimeStamp - 远程最大新增时间戳
 * @returns {Promise<Array<Object>|undefined>} 返回需要新增到本地的分类搜索数组，失败时返回 undefined
 */
async function getDataForAddCategorySearchFromRemoteToLocal(biggestAddTimeStamp) {
  const queryAddUrl = `queryNeedAddCategorySearch.php?addTime=${biggestAddTimeStamp}`;
  const addCategorySearchArrResult = await apiAjaxGetRequest(queryAddUrl);
  if (addCategorySearchArrResult.errno !== 0) {
    alert("获取需要新增的数据失败");
    alert(addCategorySearchArrResult.message);
    return;
  }
  return addCategorySearchArrResult.data;
}

/**
 * 批量更新本地 CategorySearch 数据
 * @param {Array<Object>} updateCategorySearchArr - 来自远程的分类搜索更新数组
 * @returns {Array<Object>} 返回每条更新操作的结果数组
 */
function updateCategorySearchFromRemoteToLocal(updateCategorySearchArr) {
  const db = api.require("db");
  const results = [];
  updateCategorySearchArr.forEach((item) => {
    results.push(updateLocalCategorySearchByData(item, db));
  });
  return results;
}

/**
 * 根据数据项更新本地 CategorySearch 记录
 * @param {Object} item - 包含更新数据的对象
 * @param {Object} db - 数据库实例对象
 * @returns {Object} SQL 执行结果对象
 */
function updateLocalCategorySearchByData(item, db) {
  // 拼接 SQL 更新语句，所有字段都更新
  const sqlQuery = `
    UPDATE categorySearch 
    SET 
      name = '${item.name.replace(/'/g, "''")}',
      count = ${parseInt(item.count, 10)},
      addTimeStamp = ${parseInt(item.addTimeStamp, 10)},
      updateTimeStamp = ${parseInt(item.updateTimeStamp, 10)},
      isDelete = ${parseInt(item.isDelete, 10)}
    WHERE id = ${parseInt(item.id, 10)};
  `;
  // 执行 SQL 更新语句
  const sqlResult = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return sqlResult;
}

/**
 * 批量新增远程 CategorySearch 数据到本地
 * @param {Array<Object>} addCategorySearchArr - 来自远程的分类搜索新增数组
 * @returns {Array<Object>} 返回每条新增操作的结果数组
 */
function addCategorySearchFromRemoteToLocal(addCategorySearchArr) {
  const db = api.require("db");
  const results = [];
  addCategorySearchArr.forEach((item) => {
    results.push(insertLocalCategorySearchByData(item, db));
  });
  return results;
}

/**
 * 根据数据项插入本地 CategorySearch 记录
 * @param {Object} item - 包含插入数据的对象
 * @param {Object} db - 数据库实例对象
 * @returns {Object} SQL 执行结果对象
 */
function insertLocalCategorySearchByData(item, db) {
  // 如果需要指定id（远程与本地同步），加上id字段
  const sqlQuery =
    item.id !== undefined
      ? `
      INSERT OR REPLACE INTO categorySearch (id, name, count, addTimeStamp, updateTimeStamp, isDelete)
      VALUES (
        ${parseInt(item.id, 10)},
        '${item.name.replace(/'/g, "''")}',
        ${parseInt(item.count, 10)},
        ${parseInt(item.addTimeStamp, 10)},
        ${parseInt(item.updateTimeStamp, 10)},
        ${parseInt(item.isDelete, 10)}
      );
    `
      : `
      INSERT INTO categorySearch (name, count, addTimeStamp, updateTimeStamp, isDelete)
      VALUES (
        '${item.name.replace(/'/g, "''")}',
        ${parseInt(item.count, 10)},
        ${parseInt(item.addTimeStamp, 10)},
        ${parseInt(item.updateTimeStamp, 10)},
        ${parseInt(item.isDelete, 10)}
      );
    `;
  const sqlResult = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return sqlResult;
}

/**
 * 在本地数据库执行 SELECT 查询并返回结果
 * @param {string} sqlQuery - 要执行的 SQL 查询语句
 * @returns {Array<Object>} 返回查询到的记录列表；失败返回空数组
 */
function runSelectSql(sqlQuery) {
  const db = api.require("db");
  // 执行传入的SQL查询语句
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 返回查询结果，如果查询失败则返回空数组
  return ret.data || [];
}

/**
 * 在本地数据库执行 INSERT/UPDATE/DELETE 等非查询语句
 * @param {string} sqlQuery - 要执行的 SQL 语句
 * @returns {Object} 返回执行结果对象，包含执行状态信息
 */
function runExecSql(sqlQuery) {
  const db = api.require("db");
  // 执行传入的SQL查询语句
  const ret = db.executeSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 返回查询结果
  return ret;
}
/**
 * 获取本地 Note 表中最新的 updateTimeStamp
 * @returns {number} 返回本地最大更新时间戳；无数据时返回 0
 */
function getLocalNoteBiggestUpdateTimeStamp() {
  const db = api.require("db");
  // 修改 SQL 语句以选择最大的更新时间戳
  const sqlQuery = `SELECT MAX(updateTimeStamp) AS maxUpdateTimeStamp FROM note;`;
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  // 返回最大的更新时间戳，如果没有数据则返回 0
  return ret.data && ret.data.length > 0 ? ret.data[0].maxUpdateTimeStamp : 0;
}

/**
 * 获取本地 Note 表中最新的 addTimeStamp
 * @returns {number} 返回本地最大新增时间戳；无数据时返回 0
 */
function getLocalNoteBiggestAddTimeStamp() {
  const db = api.require("db");
  const sqlQuery = `SELECT MAX(addTimeStamp) AS maxAddTimeStamp FROM note;`;
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data && ret.data.length > 0 ? ret.data[0].maxAddTimeStamp : 0;
}

/**
 * 获取本地 categorySearch 表中最新的 updateTimeStamp
 * @returns {number} 返回本地最大更新时间戳；无数据时返回 0
 */
function getLocalCategorySearchBiggestUpdateTimeStamp() {
  const db = api.require("db");
  const sqlQuery = `SELECT MAX(updateTimeStamp) AS maxUpdateTimeStamp FROM categorySearch;`;
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data && ret.data.length > 0 && ret.data[0].maxUpdateTimeStamp
    ? parseInt(ret.data[0].maxUpdateTimeStamp, 10)
    : 0;
}

/**
 * 获取本地 categorySearch 表中最新的 addTimeStamp
 * @returns {number} 返回本地最大新增时间戳；无数据时返回 0
 */
function getLocalCategorySearchBiggestAddTimeStamp() {
  const db = api.require("db");
  const sqlQuery = `SELECT MAX(addTimeStamp) AS maxAddTimeStamp FROM categorySearch;`;
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data && ret.data.length > 0 && ret.data[0].maxAddTimeStamp 
    ? parseInt(ret.data[0].maxAddTimeStamp, 10) 
    : 0;
}

/**
 * 获取本地 Music 表中最新的 updateTimeStamp
 * @returns {number} 返回本地最大音乐更新时间戳；无数据时返回 0
 */
function getLocalMusicBiggestUpdateTimeStamp() {
  const db = api.require("db");
  const sqlQuery = `SELECT MAX(updateTimeStamp) AS maxUpdateTimeStamp FROM music;`;
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data && ret.data.length > 0 ? ret.data[0].maxUpdateTimeStamp : 0;
}

/**
 * 获取本地 Music 表中最新的 addTimeStamp
 * @returns {number} 返回本地最大音乐新增时间戳；无数据时返回 0
 */
function getLocalMusicBiggestAddTimeStamp() {
  const db = api.require("db");
  const sqlQuery = `SELECT MAX(addTimeStamp) AS maxAddTimeStamp FROM music;`;
  const ret = db.selectSqlSync({
    name: "studyApp",
    sql: sqlQuery,
  });
  return ret.data && ret.data.length > 0 ? ret.data[0].maxAddTimeStamp : 0;
}
/**
 * 获取远程 Music 最大更新时间戳
 * @returns {Promise<Object|undefined>} 返回接口结果对象，包含 errno、message 及 data；失败时返回 undefined
 */
async function getRemoteMusicBiggestUpdateTimeStamp() {
  const queryUrl = `getMusicBiggestUpdateTimeStamp.php`;
  const result = await apiAjaxGetRequest(queryUrl);
  if (result.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(result.message);
    return;
  }
  return result;
}

/**
 * 获取远程 Music 最大新增时间戳
 * @returns {Promise<Object|undefined>} 返回接口结果对象，包含 errno、message 及 data；失败时返回 undefined
 */
async function getRemoteMusicBiggestAddTimeStamp() {
  const queryUrl = `getMusicBiggestAddTimeStamp.php`;
  const result = await apiAjaxGetRequest(queryUrl);
  if (result.errno !== 0) {
    alert("获取需要新增的数据失败");
    alert(result.message);
    return;
  }
  return result;
}

/**
 * 获取远程 Music 更新数据，用于拉取到本地
 * @param {number} biggestUpdateTimeStamp - 远程 updateTimeStamp 较大值
 * @param {number} biggestAddTimeStamp - 远程 addTimeStamp 较大值
 * @returns {Promise<Array<Object>|undefined>} 返回需要更新到本地的音乐数组；失败时返回 undefined
 */
async function getDataForUpdateMusicFromRemoteToLocal(biggestUpdateTimeStamp, biggestAddTimeStamp) {
  const queryUpdateUrl = `queryNeedUpdateMusics.php?addTime=${biggestAddTimeStamp}&updateTime=${biggestUpdateTimeStamp}`;
  const updateMusicArrResult = await apiAjaxGetRequest(queryUpdateUrl);
  if (updateMusicArrResult.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(updateMusicArrResult.message);
    return;
  }
  return updateMusicArrResult.data;
}
/**
 * 获取远程 Note 更新数据，用于拉取到本地
 * @param {number} biggestUpdateTimeStamp - 远程 updateTimeStamp 较大值
 * @param {number} biggestAddTimeStamp - 远程 addTimeStamp 较大值
 * @returns {Promise<Array<Object>|undefined>} 返回需要更新到本地的笔记数组；失败时返回 undefined
 */
async function getDataForUpdateNoteFromRemoteToLocal(biggestUpdateTimeStamp, biggestAddTimeStamp) {
  const queryUpdateUrl = `queryNeedUpdateNotes.php?addTime=${biggestAddTimeStamp}&updateTime=${biggestUpdateTimeStamp}`;
  // 调用远程接口获取需要更新到本地的数据
  const updateNoteArrResult = await apiAjaxGetRequest(queryUpdateUrl);
  if (updateNoteArrResult.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(updateNoteArrResult.message);
    return;
  }
  return updateNoteArrResult.data;
}

/**
 * 获取远程 Note 新增数据，用于拉取新增到本地
 * @param {number} biggestAddTimeStamp - 远程 addTimeStamp 较大值
 * @returns {Promise<Array<Object>|undefined>} 返回需要新增到本地的笔记数组；失败时返回 undefined
 */
async function getDataForAddNoteFromRemoteToLocal(biggestAddTimeStamp) {
  const queryAddUrl = `queryNeedAddNotes.php?addTime=${biggestAddTimeStamp}`;
  // 调用远程接口获取需要更新到本地的数据
  const addNoteArrResult = await apiAjaxGetRequest(queryAddUrl);
  if (addNoteArrResult.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(addNoteArrResult.message);
    return;
  }
  return addNoteArrResult.data;
}

/**
 * 获取远程 Music 新增数据，用于拉取新增到本地
 * @param {number} biggestAddTimeStamp - 远程 addTimeStamp 较大值
 * @returns {Promise<Array<Object>|undefined>} 返回需要新增到本地的音乐数组；失败时返回 undefined
 */
async function getDataForAddMusicFromRemoteToLocal(biggestAddTimeStamp) {
  const queryAddUrl = `queryNeedAddMusics.php?addTime=${biggestAddTimeStamp}`;
  const addMusicArrResult = await apiAjaxGetRequest(queryAddUrl);
  if (addMusicArrResult.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(addMusicArrResult.message);
    return;
  }
  return addMusicArrResult.data;
}
/**
 * 批量更新本地 Note 数据
 * @param {Array<Object>} updateNoteArr - 来自远程的笔记更新数组
 * @returns {number} 成功更新的记录数
 */
function updateNoteFromRemoteToLocal(updateNoteArr) {
  let count = 0;
  // 批量更新本地数据
  updateNoteArr.forEach((item) => {
    updateLocalNoteByData(item); // 更新本地笔记
    count++;
  });
  return count;
}

/**
 * 批量更新本地 Music 数据
 * @param {Array<Object>} updateMusicArr - 来自远程的音乐更新数组
 * @returns {number} 成功更新的记录数
 */
function updateMusicFromRemoteToLocal(updateMusicArr) {
  let count = 0;
  // 批量更新本地数据
  updateMusicArr.forEach((item) => {
    updateLocalMusicByData(item); // 更新本地音乐
    count++;
  });
  return count;
}

/**
 * 批量新增远程 Note 到本地
 * @param {Array<Object>} addNoteArr - 来自远程的笔记新增数组
 * @returns {number} 成功新增的记录数
 */
function addNoteFromRemoteToLocal(addNoteArr) {
  let count = 0;
  // 批量新增本地数据
  addNoteArr.forEach((item) => {
    insertLocalNoteByData(item); // 插入本地笔记
    count++;
  });
  return count;
}

/**
 * 批量新增远程 Music 到本地
 * @param {Array<Object>} addMusicArr - 来自远程的音乐新增数组
 * @returns {number} 成功新增的记录数
 */
function addMusicFromRemoteToLocal(addMusicArr) {
  let count = 0;
  // 批量新增本地数据
  addMusicArr.forEach((item) => {
    insertLocalMusicByData(item); // 插入本地音乐
    count++;
  });
  return count;
}
/**
 * 获取远程 Note 最大更新时间戳
 * 
 * 通过 GET 请求调用 `getNoteBiggestUpdateTimeStamp.php` 接口，
 * 使用 `apiAjaxGetRequest` 获取远程 Note 的最大 updateTimeStamp。
 * 若返回结果中的 errno 不为 0，则弹窗提示并返回 undefined。
 *
 * @async
 * @returns {Promise<Object|undefined>} 成功时返回接口结果对象，失败时返回 undefined
 */
async function getRemoteNoteBiggestUpdateTimeStamp() {
  const queryUrl = `getNoteBiggestUpdateTimeStamp.php`;
  const result = await apiAjaxGetRequest(queryUrl);
  if (result.errno !== 0) {
    alert("获取需要更新的数据失败");
    alert(result.message);
    return;
  }
  return result;
}

/**
 * 获取远程 Note 最大新增时间戳
 * @async
 * @returns {Promise<Object|undefined>} 成功时返回接口结果对象，失败时返回 undefined
 */
async function getRemoteNoteBiggestAddTimeStamp() {
  const queryUrl = `getNoteBiggestAddTimeStamp.php`;
  const result = await apiAjaxGetRequest(queryUrl);
  if (result.errno !== 0) {
    alert("获取需要新增的数据失败");
    alert(result.message);
    return;
  }
  return result;
}
/**
 * 获取远程 categorySearch 表的最大 updateTimeStamp
 * @returns {Promise<number|undefined>} 最大更新时间戳，失败时返回 undefined
 */
async function getRemoteCategorySearchBiggestUpdateTimeStamp() {
  const queryUrl = `getCategorySearchBiggestUpdateTimeStamp.php`;
  const result = await apiAjaxGetRequest(queryUrl);
  if (result.errno !== 0) {
    alert("获取需要更新的分类数据失败");
    alert(result.message);
    return;
  }
  return result;
}

/**
 * 获取远程 categorySearch 表的最大 addTimeStamp
 * @returns {Promise<number|undefined>} 最大新增时间戳，失败时返回 undefined
 */
async function getRemoteCategorySearchBiggestAddTimeStamp() {
  const queryUrl = `getCategorySearchBiggestAddTimeStamp.php`;
  const result = await apiAjaxGetRequest(queryUrl);
  if (result.errno !== 0) {
    alert("获取需要新增的分类数据失败");
    alert(result.message);
    return;
  }
  return result;
}

/**
 * 并行下载给定的音频文件并返回成功下载的文件数量
 * @async
 * @param {string[]} urlsArray - 音频文件 URL 数组
 * @returns {Promise<number>} 成功保存的文件数量
 * @throws {Error} 如果任何单个下载操作失败，则抛出错误
 */
async function downloadAudioToLocal(urlsArray) {
  // 并行执行下载，缩短整体等待时间
  const results = await Promise.all(urlsArray.map((url) => savePathFromUrl(url)));
  // 过滤出成功的下载并返回数量
  return results.filter(Boolean).length;
}

/**
 * 在 appInfo 表中删除 addTimeStamp 小于今天零点时间戳的记录
 * @returns {Object} SQL 执行结果对象，通常包含受影响行数等信息
 */
function clearAppInfoDataBeforeToday() {
  const todayTimestamp = getTodayZeroTimeStamp();
  const sqlQuery = `DELETE FROM appInfo WHERE addTimeStamp < ${todayTimestamp}`;
  const sqlResult = runExecSql(sqlQuery);
  return sqlResult;
}
/**
 * 补全 appInfo 数据的函数
 *
 * 此函数主要执行以下操作：
 * 1. 获取最新的 appInfo 数据记录。
 * 2. 校验最新记录的 endTimeStamp 是否为正常时间戳：
 *    - 如果 endTimeStamp 不等于 0，则跳过补全操作。
 *    - 如果 endTimeStamp 等于 0，则进行数据补全操作。
 * 3. 根据本地存储的数据获取 jpushID，并检查是否有需要复习的笔记：
 *    - 若存在复习笔记，则更新 noteNumber 为复习笔记数量。
 *    - 否则，从本地存储中获取 nextRemindTimeStamp。
 * 4. 计算当前时间戳和记录的 startTimeStamp 之间的时间差（timeSpan）。
 * 5. 拼接并执行 SQL 更新语句，更新 endTimeStamp、updateTimeStamp、timeSpan、
 *    remindTimeStamp、noteNumber 和 jpushID。
 * 6. 查询并输出 appInfo 表中所有数据以验证更新操作。
 *
 * @returns {void}
 */
function completeAppInfoData() {
  // 获取最新的appInfo数据
  const appInfoLastData = getLastAppInfoData();
  if (appInfoLastData.length > 0) {
    // 判断最新记录的endTimeStamp是否已经有正常的时间戳
    if (parseInt(appInfoLastData[0].endTimeStamp, 10) !== 0) {
      return; // 不需要补全数据，直接退出
    }
    // 仅在需要补全数据时计算以下变量
    const jpushID = localStorage.getItem("xgToken");
    let noteNumber = 0;
    let nextRemindTimeStamp = 0;
    // 判断是否有笔记需要复习
    const allRemindNotesNumber = queryAllRemindNotesNumber();
    if (allRemindNotesNumber > 0) {
      noteNumber = allRemindNotesNumber;
    } else {
      nextRemindTimeStamp = Number(localStorage.getItem("nextRemindTimeStamp") || 0);
    }
    const nowTimeStamp = Math.floor(Date.now() / 1000);
    const timeSpan = nowTimeStamp - parseInt(appInfoLastData[0].startTimeStamp, 10);
    // 拼接SQL语句，更新endTimeStamp、updateTimeStamp、timeSpan、remindTimeStamp、noteNumber、jpushID
    const sqlQuery = `UPDATE appInfo SET endTimeStamp = ${nowTimeStamp}, updateTimeStamp = ${nowTimeStamp}, timeSpan = ${timeSpan}, remindTimeStamp = ${nextRemindTimeStamp}, noteNumber = ${noteNumber}, jpushID = '${jpushID}' WHERE id = ${appInfoLastData[0].id}`;
    const sqlResult = runExecSql(sqlQuery);
  } else {
    alert("没有数据, 严重错误!!!");
  }
  // 查询并展示当前appInfo表的全部数据
  const sqlQuery = `SELECT * FROM appInfo`;
  const sqlResult = runSelectSql(sqlQuery);
}

/**
 * 获取最新的app信息数据
 *
 * 此函数用于从appInfo表中按添加时间戳降序排列后获取最新的一条记录。
 * 它构造并执行SQL查询语句：
 *    "SELECT * FROM appInfo ORDER BY addTimeStamp DESC LIMIT 1"
 *
 * @returns {Array<Object>} 查询结果数组
 */
function getLastAppInfoData() {
  const sqlQuery = `SELECT * FROM appInfo ORDER BY addTimeStamp DESC LIMIT 1`;
  const sqlResult = runSelectSql(sqlQuery);
  return sqlResult;
}

/**
 * 返回当日零点（00:00）的时间戳，单位为秒
 * @returns {number} 当天00:00的时间戳（秒）
 */
function getTodayZeroTimeStamp() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 设置时间为当天零点
  const todayTimestamp = Math.floor(today.getTime() / 1000); // 转换为秒级时间戳
  return todayTimestamp;
}

/**
 * 获取所有应用信息数据
 *
 * 该函数执行 SQL 查询 "SELECT * FROM appInfo"，并返回查询结果列表。
 *
 * @returns {Array<Object>} 包含所有应用记录的数组
 */
function getAllAppInfoData() {
  const sqlQuery = `SELECT * FROM appInfo`;
  const sqlResult = runSelectSql(sqlQuery);
  return sqlResult;
}
/**
 * 将应用信息数据推送到远程服务器
 *
 * 此函数异步获取所有的应用信息数据，并通过 POST 请求将数据发送到指定的服务器端脚本。
 * 如果请求过程中出现错误，将会抛出该错误。
 *
 * @async
 * @returns {Promise<Object>} 返回一个 Promise 对象，解析结果为服务器响应的结果
 * @throws {Error} 当网络请求异常时抛出错误
 */
async function pushAppInfoToRemote() {
  const appInfoData = getAllAppInfoData();
  const pushAppInfoUrl = `app.php`;
  try {
    const result = await apiAjaxPostRequest(pushAppInfoUrl, appInfoData);
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * 查询学习时间
 *
 * 该函数向服务器发送请求以获取学习时间数据。如果请求失败，则弹出错误提示信息；如果请求成功，
 * 则将服务器返回的时间戳转换为格式化的时间字符串并返回。
 *
 * @async
 * @returns {Promise<string|undefined>} 返回格式化的时间字符串，如果请求失败，则返回 undefined
 */
async function queryStudyTime() {
  const queryStudyTimeUrl = `queryStudyTime.php`;
  const result = await apiAjaxGetRequest(queryStudyTimeUrl);
  if (result.errno !== 0) {
    alert("获取学习时间失败");
    alert(result.message);
  } else {
    return timeStampToTimeString(result.data);
  }
}

/**
 * 清除应用信息数据
 *
 * 该函数通过执行 SQL 删除语句，从 appInfo 表中删除所有数据。
 * 删除操作的结果通过 runExecSql 函数执行。
 *
 * @returns {Object} 执行删除操作后返回的结果对象
 */
function clearAppInfoData() {
  const sqlQuery = `DELETE FROM appInfo`;
  const sqlResult = runExecSql(sqlQuery);
  return sqlResult;
}

/**
 * 异步检查链接状态
 *
 * 此函数调用 apiAjaxGetRequest 方法发送网络请求到 checkLink.php 以检测链接状态。
 * 若请求成功，则返回请求结果（JSON 格式）；若请求失败，则返回一个包含错误号和错误信息的对象。
 *
 * @async
 * @returns {Promise<Object>} 返回一个 Promise 对象，其解析值为请求结果或错误信息对象
 */
async function checkLink() {
  const checkLinkUrl = `checkLink.php`;
  try {
    const result = await apiAjaxGetRequest(checkLinkUrl);
    return result;
  } catch (error) {
    return { errno: 1, message: "网络请求失败" }; // 返回错误信息
  }
}
// ------------------------------------------------------------------
// 以下函数封装了 PHP 分页接口逻辑，用于 Note 和 Music 数据的分页同步
// ------------------------------------------------------------------

/**
 * 获取远程 Note 更新总数
 * @param {number} addTime - 本地最大 addTimeStamp
 * @param {number} updateTime - 本地最大 updateTimeStamp
 * @returns {Promise<number>} 返回待更新条目总数
 * @throws {Error} 获取失败时抛出错误
 */
async function getNoteUpdateCount(addTime, updateTime) {
  const res = await apiAjaxGetRequest(`getNoteUpdateCount.php?addTime=${addTime}&updateTime=${updateTime}`);
  if (res.errno !== 0) throw new Error("获取 Note 更新总数失败：" + res.message);
  return res.data.count;
}

/**
 * 分页获取需要更新的 Note 数据
 * @param {number} addTime - 本地最大 addTimeStamp
 * @param {number} updateTime - 本地最大 updateTimeStamp
 * @param {number} limit - 每页大小
 * @param {number} offset - 偏移量
 * @returns {Promise<Array<Object>>} 返回当前页数据数组
 * @throws {Error} 获取失败时抛出错误
 */
async function fetchNeedUpdateNotes(addTime, updateTime, limit, offset) {
  const res = await apiAjaxGetRequest(
    `queryNeedUpdateNotes.php?addTime=${addTime}&updateTime=${updateTime}&limit=${limit}&offset=${offset}`
  );
  if (res.errno !== 0) throw new Error("获取更新页数据失败：" + res.message);
  return res.data || [];
}

/**
 * 获取远程 Note 新增总数
 * @param {number} addTime - 本地最大 addTimeStamp
 * @returns {Promise<number>} 返回待新增条目总数
 * @throws {Error} 获取失败时抛出错误
 */
async function getNoteAddCount(addTime) {
  const res = await apiAjaxGetRequest(`getNoteAddCount.php?addTime=${addTime}`);
  if (res.errno !== 0) throw new Error("获取 Note 新增总数失败：" + res.message);
  return res.data.count;
}

/**
 * 分页获取需要新增的 Note 数据
 * @param {number} addTime - 本地最大 addTimeStamp
 * @param {number} limit - 每页大小
 * @param {number} offset - 偏移量
 * @returns {Promise<Array<Object>>} 返回当前页数据数组
 * @throws {Error} 获取失败时抛出错误
 */
async function fetchNeedAddNotes(addTime, limit, offset) {
  const res = await apiAjaxGetRequest(`queryNeedAddNotes.php?addTime=${addTime}&limit=${limit}&offset=${offset}`);
  if (res.errno !== 0) throw new Error("获取新增页数据失败：" + res.message);
  return res.data || [];
}

/**
 * 获取远程 Music 更新总数
 * @param {number} addTime - 本地最大 addTimeStamp
 * @param {number} updateTime - 本地最大 updateTimeStamp
 * @returns {Promise<number>} 返回待更新音乐总数
 * @throws {Error} 获取失败时抛出错误
 */
async function getMusicUpdateCount(addTime, updateTime) {
  const res = await apiAjaxGetRequest(`getMusicUpdateCount.php?addTime=${addTime}&updateTime=${updateTime}`);
  if (res.errno !== 0) throw new Error("获取 Music 更新总数失败：" + res.message);
  return res.data.count;
}

/**
 * 分页获取需要更新的 Music 数据
 * @param {number} addTime - 本地最大 addTimeStamp
 * @param {number} updateTime - 本地最大 updateTimeStamp
 * @param {number} limit - 每页大小
 * @param {number} offset - 偏移量
 * @returns {Promise<Array<Object>>} 返回当前页音乐数据数组
 * @throws {Error} 获取失败时抛出错误
 */
async function fetchNeedUpdateMusics(addTime, updateTime, limit, offset) {
  const res = await apiAjaxGetRequest(
    `queryNeedUpdateMusics.php?addTime=${addTime}&updateTime=${updateTime}&limit=${limit}&offset=${offset}`
  );
  if (res.errno !== 0) throw new Error("获取更新音乐页数据失败：" + res.message);
  return res.data || [];
}

/**
 * 获取远程 Music 新增总数
 * @param {number} addTime - 本地最大 addTimeStamp
 * @returns {Promise<number>} 返回待新增音乐总数
 * @throws {Error} 获取失败时抛出错误
 */
async function getMusicAddCount(addTime) {
  const res = await apiAjaxGetRequest(`getMusicAddCount.php?addTime=${addTime}`);
  if (res.errno !== 0) throw new Error("获取 Music 新增总数失败：" + res.message);
  return res.data.count;
}
