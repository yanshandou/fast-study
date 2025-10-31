/**
 * APICloud 应用入口函数
 * 在 APICloud 框架加载完成后自动调用,初始化应用核心功能
 */
apiready = function () {
  getStartTimeStamp();
  const tpush = api.require("tpnsApiCloud");
  const pushConfig = { accessId: "accessId", accessKey: "accessKey" };
  tpush.startXg(pushConfig, function (ret, err) {
    if (ret && ret.xgToken) {
      localStorage.setItem("xgToken", ret.xgToken);
    } else {
      console.error("推送服务初始化失败:", err ? err.msg : "未知错误");
    }
  });
  const db = api.require("db");
  db.openDatabase({ name: "studyApp" }, function (ret, err) {
    if (!ret.status) {
      console.error("数据库打开失败:", err ? err.msg : "未知错误");
      return;
    }
    createTables(db)
      .then(() => {
        appToFront("index.html apiready");
        checkNeedSyncByUpdateTimeStamp(openMainPage);
      })
      .catch((err) => {
        console.error("数据库初始化失败:", err);
      });
  });
  /**
   * 创建应用所需的所有数据库表
   * @param {Object} db - 数据库对象
   * @returns {Promise<void>} 所有表创建完成时 resolve
   */
  function createTables(db) {
    const tables = [
      `CREATE TABLE IF NOT EXISTS appInfo ( id INTEGER PRIMARY KEY AUTOINCREMENT, noteNumber INTEGER DEFAULT 0, jpushID TEXT DEFAULT '', startTimeStamp INTEGER DEFAULT 0, endTimeStamp INTEGER DEFAULT 0, timeSpan INTEGER DEFAULT 0, remindTimeStamp INTEGER DEFAULT 0, addTimeStamp INTEGER DEFAULT 0, updateTimeStamp INTEGER DEFAULT 0 );`,
      `CREATE TABLE IF NOT EXISTS music ( id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', speed REAL NOT NULL DEFAULT 1, count INTEGER NOT NULL DEFAULT 0, start TEXT NOT NULL DEFAULT '00:00:00:000', addTimeStamp INTEGER DEFAULT 0, updateTimeStamp INTEGER DEFAULT 0 );`,
      `CREATE TABLE IF NOT EXISTS note ( id INTEGER PRIMARY KEY AUTOINCREMENT, side1 TEXT NOT NULL DEFAULT '', side2 TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 0, remindTimeStamp INTEGER NOT NULL DEFAULT 0, isDelete INTEGER NOT NULL DEFAULT 0, addTimeStamp INTEGER NOT NULL DEFAULT 0, updateTimeStamp INTEGER NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT '', alignCode TEXT NOT NULL DEFAULT '', hasAI INTEGER NOT NULL DEFAULT 0 );`,
      `CREATE TABLE IF NOT EXISTS urlMap ( id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, path TEXT NOT NULL );`,
      `CREATE TABLE IF NOT EXISTS alignCode ( id INTEGER PRIMARY KEY AUTOINCREMENT, alignCode TEXT NOT NULL DEFAULT '', addTimeStamp INTEGER DEFAULT 0 );`,
      `CREATE TABLE IF NOT EXISTS categorySearch ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 0, addTimeStamp INTEGER NOT NULL DEFAULT 0, updateTimeStamp INTEGER NOT NULL DEFAULT 0, isDelete INTEGER NOT NULL DEFAULT 0 );`,
    ];
    return new Promise((resolve, reject) => {
      let completed = 0;
      tables.forEach((sql) => {
        db.executeSql({ name: "studyApp", sql: sql }, function (ret, err) {
          if (!ret.status) {
            console.error("创建表失败:", err ? err.msg : "未知错误");
            reject(err);
            return;
          }
          completed++;
          if (completed === tables.length) {
            resolve();
          }
        });
      });
    });
  }
  /**
   * 打开应用主页面
   */
  function openMainPage() {
    api.openWin({
      name: "category",
      url: "./category.html",
      pageParam: { name: "category" },
    });
  }
  /**
   * 打印 alignCode 表的所有数据(调试用)
   * @param {Object} db - 数据库对象
   */
  function logAllAlignCode(db) {
    const ret = db.selectSqlSync({
      name: "studyApp",
      sql: "SELECT * FROM alignCode ORDER BY id DESC",
    });
    if (ret.status && ret.data && ret.data.length > 0) {
    } else {
    }
  }
};
