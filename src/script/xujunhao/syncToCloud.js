/**
 * syncToCloud.js — 扩展版同步逻辑模块
 * Note 与 Music、以及 AppInfo 同步的逻辑对象。
 */
function createSyncLogic() {
  const tencentSecretID = "tencentSecretID";
  const tencentSecretKey = "tencentSecretKey";

  /**
   * 初始化腾讯云 COS 客户端
   * @param {string} secretID - 腾讯云 SecretID
   * @param {string} secretKey - 腾讯云 SecretKey
   */
  function initializeTencentCloudCosClient(secretID, secretKey) {
    cosClient = api.require("cosClient");
    // 1. 设置永久密钥（如有临时密钥建议用setupSessionToken）
    cosClient.setupPermanentCredentail({
      secretID: secretID,
      secretKey: secretKey,
    });
    // 2. 注册传输管理服务
    cosClient.registerTransferManger({
      serviceKey: "serviceKey", // 你自定义的服务key，后续upload要保持一致
      useHttps: true,
      timeOut: 30000000, // 单位毫秒
    });
  }

  initializeTencentCloudCosClient(tencentSecretID, tencentSecretKey);

  /**
   * 日志输出
   * 当 app 处于后台且 moreAction === "notice" 时，发送通知并设置应用图标角标
   * @param {string} msg - 要输出的消息内容
   * @param {string} [moreAction=""] - 可选，触发额外操作，例如 "notice"
   * @param {boolean} [mark=false] - 是否标记为重要消息
   */
  function logMessage(msg, moreAction = "", mark = false) {
    const currentAppStatus = localStorage.getItem("appState");
    if (currentAppStatus === "back" && moreAction === "notice") {
      // 后台模式下发送本地通知
      sendNotification(msg);
      api.setAppIconBadge({ badge: 1 });
    }
    if (currentAppStatus === "front") {
      showContentToPage(msg, mark);
    }
  }

  /**
   * 处理笔记的语音备注
   * - 查询 urlmap 表，获取本地语音文件
   * - 上传到腾讯云，更新 urlmap 表
   * - 查找 note 表中未更换 https 的语音备注
   * - 更新语音备注的 url 为 https
   * - 更新笔记的 updateTimeStamp
   * @param {boolean} [isShowMessage=true] - 是否显示消息
   * @returns {Promise<void>}
   */
  async function handleNoteVoiceComment(isShowMessage = true) {
    if (isShowMessage) {
      logMessage("🔄开始处理笔记语音备注");
      updateProgress(0, "处理笔记语音备注");
    }
    const db = api.require("db");
    if (isShowMessage) {
      logMessage("正在查询urlmap表中的语音文件");
    }
    // 查询本地语音文件
    let urlMapRet = db.selectSqlSync({
      name: "studyApp",
      sql: `SELECT * FROM urlmap WHERE url IS NOT NULL AND url <> '' AND url NOT LIKE 'https://%'`,
    });
    if (!urlMapRet.status) {
      if (isShowMessage) {
        logMessage("❌查询urlmap失败:" + JSON.stringify(urlMapRet));
        updateProgress(100, "urlmap 查询失败");
      }
      return;
    }
    const voiceFiles = urlMapRet.data;
    if (!voiceFiles || voiceFiles.length === 0) {
      if (isShowMessage) {
        logMessage("没有找到任何语音文件，跳过处理。");
        updateProgress(100, "没有语音文件");
      }
      return;
    }
    // 批量上传
    if (isShowMessage) {
      logMessage(`准备上传${voiceFiles.length}个语音文件到腾讯云`);
    }
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < voiceFiles.length; i++) {
      const file = voiceFiles[i];
      try {
        if (isShowMessage) updateProgress((i / voiceFiles.length) * 100, `上传第 ${i + 1} 个...`);
        const cloudUrl = await uploadVoiceToTencentCloud(file.path); // 你要确保这个是Promise
        if (!cloudUrl) {
          throw new Error("上传失败或返回空URL");
        }
        // 更新urlmap
        let safePath = file.path.replace(/'/g, "''");
        let safeUrl = cloudUrl.replace(/'/g, "''");
        let updateRet = db.executeSqlSync({
          name: "studyApp",
          sql: `UPDATE urlmap SET url = '${safeUrl}' WHERE path = '${safePath}'`,
        });
        if (!updateRet.status) throw new Error("urlmap表更新失败");
        // 替换note表
        let now = Math.floor(Date.now() / 1000);
        let updateNoteRet = db.executeSqlSync({
          name: "studyApp",
          sql: ` UPDATE note SET side2 = REPLACE(side2, '${safePath}', '${safeUrl}'), updateTimeStamp = ${now} WHERE side2 LIKE '%${safePath}%' `,
        });
        if (!updateNoteRet.status) throw new Error("note表更新失败");
        successCount++;
        if (isShowMessage) logMessage(`✅成功上传并替换:${successCount}/${voiceFiles.length}`);
      } catch (e) {
        failCount++;
        if (isShowMessage) logMessage(`❌处理失败:${failCount}/${voiceFiles.length}`);
      }
    }
    // 总结
    if (isShowMessage) {
      updateProgress(100, `处理完毕。共${voiceFiles.length}个，成功${successCount}，失败${failCount}`);
      logMessage(`🎉语音文件批量处理结束！共${voiceFiles.length}个，成功${successCount}，失败${failCount}`);
    }
  }

  /**
   * 上传语音文件到腾讯云
   * @param {string} path - 本地语音文件路径
   * @returns {Promise<string>} 返回上传后的 HTTPS URL
   */
  function uploadVoiceToTencentCloud(path) {
    return new Promise((resolve, reject) => {
      const region = "region";
      const bucket = "bucket";
      const objectName = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}_${path.split("/").pop()}`;
      cosClient.uploadObject(
        {
          serviceKey: "serviceKey",
          region: region,
          bucket: bucket,
          filePath: path,
          object: objectName,
        },
        function (ret, err) {
          if (err) {
            reject(err);
          } else if (ret.result === "success") {
            const fileUrl = `存储桶地址`;
            resolve(fileUrl);
          } else if (ret.result === "processing" && ret.data) {
          } else {
            reject(new Error("上传失败或未知状态: " + JSON.stringify(ret)));
          }
        }
      );
    });
  }

  /**
   * 对齐 Note 数据
   * 将 note 表中指定分类的所有未删卡片的 level 和 remindTimeStamp 同步到该分类当前最小的那条记录
   * @param {boolean} [isShowMessage=true] - 是否显示消息
   * @returns {Object} 返回对齐结果 {errno, message, data}
   */
  function alignNotesByCode(isShowMessage = true) {
    if (isShowMessage) {
      logMessage("✨开始对齐Note");
      updateProgress(0, "准备查询alignCode");
    }
    const db = api.require("db");
    const nowTs = Math.floor(Date.now() / 1000);
    const esc = (str) => str.replace(/'/g, "''");

    const result = {
      errno: 0,
      message: "对齐成功",
      data: {
        totalCodes: 0,
        processedCodes: 0,
        alignedNotes: 0,
        skippedCodes: 0,
      },
    };
    try {
      if (isShowMessage) {
        logMessage("正在查询alignCode...");
      }
      let codeRet = db.selectSqlSync({
        name: "studyApp",
        sql: `SELECT DISTINCT alignCode FROM alignCode`,
      });
      if (!codeRet.status) {
        result.errno = -1;
        result.message = "获取alignCode失败";
        if (isShowMessage) {
          logMessage("❌获取alignCode失败:" + JSON.stringify(codeRet));
          updateProgress(100, "alignCode查询失败");
        }
        return result;
      }
      const codes = codeRet.data.map((r) => r.alignCode).filter(Boolean);
      result.data.totalCodes = codes.length;
      if (isShowMessage) {
        logMessage(`已获取到${codes.length}个alignCode：${codes.join("，")}`);
      }

      if (codes.length === 0) {
        result.errno = 1;
        result.message = "没有需要对齐的Note数据";
        if (isShowMessage) {
          updateProgress(100, "没有需要对齐的Note（alignCode 为空）");
          logMessage("alignCode没有数据，跳过对齐。");
        }
        return result;
      }

      if (isShowMessage) {
        logMessage("清空alignCode表");
      }
      db.executeSqlSync({
        name: "studyApp",
        sql: `DELETE FROM alignCode`,
      });
      if (isShowMessage) {
        updateProgress(2, "alignCode 表已清空");
      }
      const totalCount = codes.length;

      codes.forEach((code, index) => {
        if (isShowMessage) {
          logMessage(`正在对齐第${index + 1}个alignCode："${code}"...`);
        }
        const codeEsc = esc(code);

        let minRet = db.selectSqlSync({
          name: "studyApp",
          sql: `SELECT level, remindTimeStamp
           FROM note
          WHERE isDelete = 0
            AND alignCode = '${codeEsc}'
          ORDER BY level ASC, remindTimeStamp ASC
          LIMIT 1`,
        });
        if (minRet.status && minRet.data.length) {
          const minLevel = minRet.data[0].level;
          const minRem = minRet.data[0].remindTimeStamp;

          let countRet = db.selectSqlSync({
            name: "studyApp",
            sql: `SELECT COUNT(*) as count FROM note WHERE isDelete = 0 AND alignCode = '${codeEsc}'`,
          });

          let updateRet = db.executeSqlSync({
            name: "studyApp",
            sql: `
            UPDATE note
               SET level = ${minLevel},
                   remindTimeStamp = ${minRem},
                   updateTimeStamp = ${nowTs}
             WHERE isDelete = 0
               AND alignCode = '${codeEsc}'
               AND (level <> ${minLevel}
                 OR remindTimeStamp <> ${minRem})
          `,
          });
          if (updateRet.status && countRet.status && countRet.data.length) {
            result.data.alignedNotes += parseInt(countRet.data[0].count) || 0;
          }
          result.data.processedCodes++;
          if (isShowMessage) {
            logMessage(`对齐“${code}”完成，level=${minLevel}, remindTimeStamp=${minRem}`);
          }
        } else {
          result.data.skippedCodes++;
          if (isShowMessage) {
            logMessage(`分类"${code}"下没有可对齐的note数据，跳过。`);
          }
        }

        const percent = Math.floor(((index + 1) / totalCount) * 100);
        if (isShowMessage) {
          updateProgress(percent, `已对齐 "${code}" (${index + 1}/${totalCount})`);
        }
      });

      if (isShowMessage) {
        updateProgress(100, "所有Note对齐完成");
        logMessage("🎉所有Note对齐完成!");
      }
    } catch (err) {
      result.errno = -1;
      result.message = "对齐过程中发生异常: " + err;
      if (isShowMessage) {
        logMessage("对齐过程中发生异常:" + err);
        updateProgress(100, "对齐异常，请检查控制台");
      }
      return result;
    }
    return result;
  }

  /**
   * 更新页面同步进度条与文本
   * @param {number} percent - 当前进度百分比
   * @param {string} text - 旁白文本
   */
  function updateProgress(percent, text) {
    const bar = document.getElementById("syncProgressBar");
    const txt = document.getElementById("syncProgressText");
    if (bar && txt) {
      bar.value = percent;
      txt.textContent = `${percent}% ${text}`;
    }
  }

  /**
   * 向页面插入一段日志内容并自动滚动
   * @param {string} content - 要插入的文本
   * @param {boolean} [mark=false] - 是否标记为重要
   */
  function showContentToPage(content, mark = false) {
    const container = document.querySelector(".sync-log-container");
    if (container) {
      const p = document.createElement("p");
      p.textContent = content;
      p.classList.add("animate__animated", "animate__fadeInUp");
      if (mark) {
        p.classList.add("comment-tag");
      }
      container.appendChild(p);
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * 跳转到分类页面，并解绑摇一摇与长按事件
   */
  function gotoCategory() {
    api.removeEventListener({ name: "shake" });
    api.removeEventListener({ name: "longpress" });
    api.openWin({
      name: "category",
      url: "./category.html",
      animation: { type: "push", subType: "from_right" },
    });
  }

  /**
   * 初始化入口
   * - 绑定左右滑动、返回键事件触发分类页面
   * - 延迟关闭其他窗口，避免残留
   * - 立即执行一次同步
   * @param {string} action - 操作类型
   */
  function init(action) {
    api.addEventListener({ name: "swipeleft" }, () => {
      shakeThePhone();
      gotoCategory();
    });
    api.addEventListener({ name: "keyback" }, () => {
      shakeThePhone();
      gotoCategory();
    });

    syncData(action);
  }

  /**
   * 检查同步是否上锁
   * @returns {boolean} 是否已锁定
   */
  function isSyncLocked() {
    const now = Math.floor(Date.now() / 1000);
    const lockTimestamp = localStorage.getItem("syncLockTimestamp");
    if (!lockTimestamp) return false;
    const lockTime = parseInt(lockTimestamp, 10);
    const timeDiff = now - lockTime;
    if (timeDiff > 60) {
      localStorage.removeItem("syncLockTimestamp");
      logMessage(`⏱️锁已过期(${timeDiff}秒)，自动清理`);
      return false;
    }
    return true;
  }

  /**
   * 上锁
   */
  function lockSync() {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem("syncLockTimestamp", now.toString());
    logMessage("🔒同步已上锁，开始同步操作");
  }

  /**
   * 解锁
   */
  function unlockSync() {
    localStorage.removeItem("syncLockTimestamp");
    logMessage("🔓同步已解锁");
  }

  /**
   * 核心同步流程
   * - 同步锁机制：确保同时只有一个同步操作
   * - 检测链接有效性
   * - 同步 AppInfo 数据
   * - 同步 Note 与 Music（双向增删改）
   * @param {string} action - 操作类型
   * @returns {Promise<void>}
   */
  async function syncData(action) {
    // 尝试获取同步锁
    if (isSyncLocked()) {
      logMessage("已有同步操作正在进行，跳过本次同步。", "notice");
      return;
    }
    lockSync();

    await handleNoteVoiceComment();
    alignNotesByCode();

    updateProgress(0, "开始同步");
    let studyTimeFromAppInfo = null;
    try {
      if (action === "auto") {
        const link = await checkLinkStatus();
        if (link.errno !== 0) {
          alert(link.message);
          logMessage("😭同步失败:" + link.message, "notice");
          return;
        }
      }

      studyTimeFromAppInfo = await syncAppInfo();
      await syncNote();
      logMessage("🎉全部同步完成！");
      updateProgress(100, "全部同步完成！");

      if (studyTimeFromAppInfo && typeof showStudyTimeAndGoToCategory === "function") {
        showStudyTimeAndGoToCategory(studyTimeFromAppInfo);
      } else if (typeof showStudyTimeAndGoToCategory === "function") {
        showStudyTimeAndGoToCategory("同步完成");
      }
    } catch (err) {
      console.error("同步出错:", err);
      logMessage("❌同步过程中发生错误:" + (err.message || err), "notice");
    } finally {
      unlockSync();
    }
  }

  /**
   * 后台同步
   * @returns {Promise<void>}
   */
  async function backSync() {
    if (isSyncLocked()) {
      logMessage("已有同步操作正在进行，跳过本次同步。", "notice");
      return;
    }
    lockSync();
    try {
      await handleNoteVoiceComment(false);
      alignNotesByCode(false);

      const link = await checkLinkStatus(false);
      if (link.errno !== 0) {
        return;
      }

      await syncAppInfo(false);
      await syncNoteForBack();
    } catch (err) {
      console.error("后台同步出错:", err);
      logMessage("❌后台同步过程中发生错误:" + (err.message || err), "notice");
    } finally {
      unlockSync();
    }
  }

  /**
   * 检查网络/链接状态
   * @param {boolean} [isShowMessage=true] - 是否显示消息
   * @returns {Promise<Object>} 返回 {errno, message}
   */
  async function checkLinkStatus(isShowMessage = true) {
    if (isShowMessage) {
      logMessage("正在检查链接🚀");
    }
    try {
      const res = await checkLink();
      if (isShowMessage) {
        logMessage("检查结果:" + res.message);
      }
      return res;
    } catch (e) {
      if (isShowMessage) {
        console.error("检查链接时出错:", e);
      }
      return { errno: -1, message: "检查链接失败" };
    }
  }

  /**
   * 同步 AppInfo
   * - 自动补全本地数据，推送到远程
   * - 清空本地缓存，插入前台学习时长提示
   * @param {boolean} [isShowMessage=true] - 是否显示消息
   * @returns {Promise<string|null>} 返回学习时长或null
   */
  async function syncAppInfo(isShowMessage = true) {
    if (isShowMessage) {
      logMessage("🔄开始同步AppInfo↓");
      updateProgress(0, "✨ 同步 AppInfo");
    }
    try {
      if (isShowMessage) {
        logMessage("🛠️补全数据，为同步做准备");
      }
      completeAppInfoData();

      if (isShowMessage) {
        logMessage("🚀推送AppInfo到远程");
      }
      const res = await pushAppInfoToRemote();
      if (isShowMessage) {
        logMessage(`📤推送结果:${res.message}`);
      }
      if (res.errno !== 0) {
        if (isShowMessage) {
          alert(`⚠️ AppInfo 推送失败: ${res.message}`);
        }
      }

      if (isShowMessage) {
        logMessage("🗑️清空本地AppInfo数据");
      }
      clearAppInfoData();
      if (isShowMessage) {
        logMessage("✅AppInfo同步完成🎉");
        updateProgress(100, "🎉 AppInfo 同步完成");
        logMessage("⏱️开始获取学习时长");
      }
      const studyTime = await queryStudyTime();
      logMessage(`📝学习时长:${studyTime}`, "notice", true);
      if (localStorage.getItem("appState") === "front") {
        const jpushID = localStorage.getItem("xgToken");
        insertDataToAppInfo({ noteNumber: 0, jpushID, remindTimeStamp: 0 }, "front");
        if (isShowMessage) {
          showMessage(`${studyTime} `, 5000, "donesuccess", "success");
        }
      }

      return studyTime;
    } catch (e) {
      if (isShowMessage) {
        console.error("❌ syncAppInfo 错误:", e);
      }
      logMessage(`❌同步AppInfo出错:${e.message}`, "notice");
      return null;
    }
  }

  /**
   * 同步 Note 与 Music
   * - 获取本地/远程最大更新时间戳、添加时间戳
   * - 根据时间戳差异决定推送/拉取数据
   * - 下载新增的音频资源
   * @returns {Promise<void>}
   */
  async function syncNote() {
    logMessage("🔄开始同步Note");
    updateProgress(0, "同步 Note");

    const localUpdateTs = getLocalNoteBiggestUpdateTimeStamp();
    const localAddTs = getLocalNoteBiggestAddTimeStamp();
    const remoteUpdateTsRes = await getRemoteNoteBiggestUpdateTimeStamp();
    const remoteAddTsRes = await getRemoteNoteBiggestAddTimeStamp();
    if (remoteUpdateTsRes.errno !== 0) {
      alert(`获取远程 Note 时间戳失败：${remoteUpdateTsRes.message}`);
      return;
    }
    if (remoteAddTsRes.errno !== 0) {
      alert(`获取远程 Note 添加时间戳失败：${remoteAddTsRes.message}`);
      return;
    }
    const remoteUpdateTs = remoteUpdateTsRes.data;
    const remoteAddTs = remoteAddTsRes.data;

    if (localUpdateTs > remoteUpdateTs) {
      logMessage(`⌚️本地Note最后更新时间:${localUpdateTs}`);
      logMessage(`⌚️远程Note最后更新时间:${remoteUpdateTs}`);
      logMessage("本地Note更新时间大于远程,需要推送本地Note到远程");
      const localToRemoteUpdates =
        localUpdateTs > remoteUpdateTs ? getDataForUpdateNoteFromLocalToRemote(localUpdateTs, remoteUpdateTs) : [];

      logMessage(`🔄准备推送本地Note，共${localToRemoteUpdates.length}条`, "notice", true);

      const batchSize = 100;
      const total = localToRemoteUpdates.length;
      const totalBatches = Math.ceil(total / batchSize);
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, total);
        const batch = localToRemoteUpdates.slice(start, end);
        await updateNoteFromLocalToRemote(batch);

        const percent = Math.round(((batchIndex + 1) / totalBatches) * 100);
        updateProgress(percent, `已推送 ${batchIndex + 1}/${totalBatches} 批`);
      }
      updateProgress(100, "推送本地 Note 更新完成");
      logMessage("✅所有本地Note更新已推送完毕", "notice");
    } else if (localUpdateTs < remoteUpdateTs) {
      logMessage(`⌚️本地Note最后更新时间:${localUpdateTs}`);
      logMessage(`⌚️远程Note最后更新时间:${remoteUpdateTs}`);
      logMessage("远程Note更新时间大于本地,需要拉取远程Note到本地");

      const batchSize = 100;
      const totalCount = await getNoteUpdateCount(localAddTs, localUpdateTs);
      const totalBatches = Math.ceil(totalCount / batchSize);
      logMessage(`⬇️准备拉取远程Note更新，共${totalCount}条，分${totalBatches}批`, "", true);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const offset = batchIndex * batchSize;
        updateProgress(
          Math.round(((batchIndex + 1) / totalBatches) * 100),
          `拉取远程 Note 更新 ${batchIndex + 1}/${totalBatches}`
        );
        const batch = await fetchNeedUpdateNotes(localAddTs, localUpdateTs, batchSize, offset);
        updateNoteFromRemoteToLocal(batch);
      }
      updateProgress(100, "拉取远程 Note 更新完成");
      logMessage("✅所有远程Note更新已拉取并应用完毕");
    } else {
      logMessage(`⌚️本地Note最后更新时间:${localUpdateTs}`);
      logMessage(`⌚️远程Note最后更新时间:${remoteUpdateTs}`);
      logMessage("✅本地Note更新时间等于远程,无需操作");
    }
    if (localAddTs < remoteAddTs) {
      logMessage(`⌚️本地Note最后新增时间:${localAddTs}`);
      logMessage(`⌚️远程Note最后新增时间:${remoteAddTs}`);
      logMessage("本地Note新增时间小于远程,需要拉取远程Note新增到本地");

      const batchSize = 100;
      const totalCount = await getNoteAddCount(localAddTs);
      const totalBatches = Math.ceil(totalCount / batchSize);
      logMessage(`➕准备拉取远程Note新增，共${totalCount}条，分${totalBatches}批`, "", true);
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const offset = batchIndex * batchSize;
        updateProgress(
          Math.round(((batchIndex + 1) / totalBatches) * 100),
          `拉取远程 Note 新增 ${batchIndex + 1}/${totalBatches}`
        );
        const batch = await fetchNeedAddNotes(localAddTs, batchSize, offset);
        addNoteFromRemoteToLocal(batch);
      }

      updateProgress(100, "拉取远程 Note 新增完成");
      logMessage("✅所有远程Note新增已拉取并应用完毕");
    } else if (localAddTs == remoteAddTs) {
      logMessage(`⌚️本地Note最后新增时间:${localAddTs}`);
      logMessage(`⌚️远程Note最后新增时间:${remoteAddTs}`);
      logMessage("本地Note新增时间等于远程,无需操作");
    }

    const noteUrls = await checkNoteAudioSourceForDownloadLocalPaged(1000, updateProgress);
    if (noteUrls.length) {
      logMessage(`📥准备下载Note资源，共${noteUrls.length}个`);
      const batchSize = 100;
      const total = noteUrls.length;
      const totalBatches = Math.ceil(total / batchSize);
      let processed = 0;
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, total);
        const batch = noteUrls.slice(start, end);
        // 并行下载本批次
        await downloadAudioToLocal(batch);
        // 累计已处理（尝试下载）的数量
        processed += batch.length;
        const percent = Math.round((processed / total) * 100);
        updateProgress(percent, `下载 Note 资源 ${processed}/${total}`);
      }
      updateProgress(100, "✅ 所有 Note 资源下载完成");
    } else {
      logMessage("✅无Note资源下载");
      updateProgress(100, "下载 Note 资源: 无需操作");
    }
    logMessage("🎉Note同步完成🎉");
    updateProgress(100, "Note 同步完成");

    logMessage("🔄开始同步分类搜索");
    updateProgress(0, "同步 分类搜索");

    const localUpdateCategorySearchTs = getLocalCategorySearchBiggestUpdateTimeStamp();
    const localAddCategorySearchTs = getLocalCategorySearchBiggestAddTimeStamp();
    const remoteUpdateCategorySearchTsRes = await getRemoteCategorySearchBiggestUpdateTimeStamp();
    const remoteAddCategorySearchTsRes = await getRemoteCategorySearchBiggestAddTimeStamp();
    if (remoteUpdateCategorySearchTsRes.errno !== 0) {
      alert(`获取远程 分类搜索 时间戳失败：${remoteUpdateCategorySearchTsRes.message}`);
      return;
    }
    if (remoteAddCategorySearchTsRes.errno !== 0) {
      alert(`获取远程 分类搜索 添加时间戳失败：${remoteAddCategorySearchTsRes.message}`);
      return;
    }
    const remoteUpdateCategorySearchTs = remoteUpdateCategorySearchTsRes.data;
    const remoteAddUpdateCategorySearchTs = remoteAddCategorySearchTsRes.data;

    if (localUpdateCategorySearchTs > remoteUpdateCategorySearchTs) {
      logMessage(`⌚️本地分类搜索最后更新时间:${localUpdateCategorySearchTs}`);
      logMessage(`⌚️远程分类搜索最后更新时间:${remoteUpdateCategorySearchTs}`);
      logMessage("本地分类搜索更新时间大于远程,需要推送本地分类搜索到远程");
      const localToRemoteCategorySearchUpdates = getDataForUpdateCategorySearchFromLocalToRemote(
        localUpdateCategorySearchTs,
        remoteUpdateCategorySearchTs,
        remoteAddUpdateCategorySearchTs
      );

      logMessage(`🔄准备推送本地分类搜索到远程更新，共${localToRemoteCategorySearchUpdates.length}条`, "notice", true);
      await updateCategorySearchFromLocalToRemote(localToRemoteCategorySearchUpdates);
      updateProgress(100, "推送本地 分类搜索 更新完成");
      logMessage("✅所有本地分类搜索更新已推送完毕", "notice");

      if (localAddCategorySearchTs > remoteAddUpdateCategorySearchTs) {
        logMessage(`⌚️本地分类搜索最后新增时间:${localAddCategorySearchTs}`);
        logMessage(`⌚️远程分类搜索最后新增时间:${remoteAddUpdateCategorySearchTs}`);
        logMessage("本地分类搜索新增时间大于远程,需要推送本地分类搜索新增到远程");
        const localToRemoteCategorySearchAdds = getDataForAddCategorySearchFromLocalToRemote(
          localAddCategorySearchTs,
          remoteAddUpdateCategorySearchTs
        );

        logMessage(`🔄准备推送本地分类搜索到远程新增，共${localToRemoteCategorySearchAdds.length}条`, "notice", true);
        await addCategorySearchFromLocalToRemote(localToRemoteCategorySearchAdds);
        updateProgress(100, "推送本地 分类搜索 新增完成");
        logMessage("✅所有本地分类搜索新增已推送完毕", "notice");
        return;
      } else {
        logMessage(`⌚️本地分类搜索最后新增时间:${localAddCategorySearchTs}`);
        logMessage(`⌚️远程分类搜索最后新增时间:${remoteAddUpdateCategorySearchTs}`);
        logMessage("本地分类搜索新增时间等于远程,无需操作");
      }
    } else if (localUpdateCategorySearchTs < remoteUpdateCategorySearchTs) {
      logMessage(`⌚️本地分类搜索最后更新时间:${localUpdateCategorySearchTs}`);
      logMessage(`⌚️远程分类搜索最后更新时间:${remoteUpdateCategorySearchTs}`);
      logMessage("远程分类搜索更新时间大于本地,需要拉取远程分类搜索到本地");
      const dataForUpdateCategorySearchFromRemoteToLocal = await getDataForUpdateCategorySearchFromRemoteToLocal(
        localUpdateCategorySearchTs,
        localAddCategorySearchTs
      );
      logMessage(
        `🔄准备拉取分类搜索到本地更新，共${dataForUpdateCategorySearchFromRemoteToLocal.length}条`,
        "notice",
        true
      );
      updateCategorySearchFromRemoteToLocal(dataForUpdateCategorySearchFromRemoteToLocal);
      updateProgress(100, "拉取远程 分类搜索 更新完成");
      logMessage("✅所有远程分类搜索更新已拉取并应用完毕");

      if (localAddCategorySearchTs < remoteAddUpdateCategorySearchTs) {
        logMessage(`⌚️本地分类搜索最后新增时间:${localAddCategorySearchTs}`);
        logMessage(`⌚️远程分类搜索最后新增时间:${remoteAddUpdateCategorySearchTs}`);
        logMessage("远程分类搜索新增时间大于本地,需要拉取远程分类搜索新增到本地");
        const dataForAddCategorySearchFromRemoteToLocal = await getDataForAddCategorySearchFromRemoteToLocal(
          localAddCategorySearchTs
        );
        logMessage(
          `🔄准备拉取分类搜索到本地新增，共${dataForAddCategorySearchFromRemoteToLocal.length}条`,
          "notice",
          true
        );
        addCategorySearchFromRemoteToLocal(dataForAddCategorySearchFromRemoteToLocal);
        updateProgress(100, "拉取远程 分类搜索 新增完成");
        logMessage("✅所有远程分类搜索新增已拉取并应用完毕");
      }
    } else {
      logMessage(`⌚️本地分类搜索最后更新时间:${localUpdateCategorySearchTs}`);
      logMessage(`⌚️远程分类搜索最后更新时间:${remoteUpdateCategorySearchTs}`);
      logMessage("✅本地分类搜索更新时间等于远程,无需操作");
    }
    logMessage("🎉分类搜索同步完成🎉");
    updateProgress(100, "分类搜索 同步完成");

    logMessage("🔄开始同步Music");
    updateProgress(0, "同步 Music");

    const localMusicUpdateTs = getLocalMusicBiggestUpdateTimeStamp();
    const localMusicAddTs = getLocalMusicBiggestAddTimeStamp();
    const remoteMusicUpdateRes = await getRemoteMusicBiggestUpdateTimeStamp();
    const remoteMusicAddRes = await getRemoteMusicBiggestAddTimeStamp();
    const remoteMusicUpdateTs = remoteMusicUpdateRes.errno === 0 ? remoteMusicUpdateRes.data : 0;
    const remoteMusicAddTs = remoteMusicAddRes.errno === 0 ? remoteMusicAddRes.data : 0;

    if (localMusicUpdateTs < remoteMusicUpdateTs) {
      logMessage("本地Music更新时间小于远程,需要拉取远程Music更新到本地");
      logMessage(`⌚️本地Music更新时间:${localMusicUpdateTs}`);
      logMessage(`⌚️远程Music更新时间:${remoteMusicUpdateTs}`);
      const mUpdates =
        localMusicUpdateTs < remoteMusicUpdateTs
          ? await getDataForUpdateMusicFromRemoteToLocal(localMusicUpdateTs, localMusicAddTs)
          : [];

      logMessage(`⬇️准备拉取远程Music更新，共${mUpdates.length}条`, "", true);
      updateMusicFromRemoteToLocal(mUpdates);
      logMessage("✅所有远程Music更新已拉取并应用完毕");
    } else if (localMusicUpdateTs == remoteMusicUpdateTs) {
      logMessage(`⌚️本地Music更新时间:${localMusicUpdateTs}`);
      logMessage(`⌚️远程Music更新时间:${remoteMusicUpdateTs}`);
      logMessage("本地Music更新时间等于远程,无需操作");
    }
    if (localMusicAddTs < remoteMusicAddTs) {
      logMessage("本地Music新增时间小于远程,需要拉取远程Music新增到本地");
      logMessage(`⌚️本地Music新增时间:${localMusicAddTs}`);
      logMessage(`⌚️远程Music新增时间:${remoteMusicAddTs}`);
      const mAdds =
        localMusicAddTs < remoteMusicAddTs ? await getDataForAddMusicFromRemoteToLocal(localMusicAddTs) : [];
      logMessage(`➕准备拉取远程Music新增，共${mAdds.length}条`, "", true);
      addMusicFromRemoteToLocal(mAdds);
      logMessage("✅所有远程Music新增已拉取并应用完毕");
    } else if (localMusicAddTs == remoteMusicAddTs) {
      logMessage(`⌚️本地Music新增时间:${localMusicAddTs}`);
      logMessage(`⌚️远程Music新增时间:${remoteMusicAddTs}`);
      logMessage("本地Music新增时间等于远程,无需操作");
    }

    const musicUrls = checkMusicAudioSourceForDownloadLocal();
    if (musicUrls.length) {
      logMessage(`📥准备下载Music资源，共${musicUrls.length}个`, "", true);
      const batchSize = 2;
      const total = musicUrls.length;
      const totalBatches = Math.ceil(total / batchSize);
      let processed = 0;
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, total);
        const batch = musicUrls.slice(start, end);
        const successCount = await downloadAudioToLocal(batch);

        processed += successCount;
        const percent = Math.round((processed / total) * 100);
        updateProgress(percent, `下载 Music 资源 ${processed}/${total}`);
      }
      updateProgress(100, "✅ 所有 Music 资源下载完成");
      logMessage(`✅总共下载成功${processed}/${total}个`);
    } else {
      logMessage("✅无Music资源下载");
      updateProgress(100, "下载 Music 资源: 无需操作");
    }

    updateProgress(100, "Music 同步完成");
    logMessage("🎉Music同步完成🎉");
  }

  /**
   * 后台同步 Note
   * @returns {Promise<void>}
   */
  async function syncNoteForBack() {
    try {
      const localUpdateTs = getLocalNoteBiggestUpdateTimeStamp();
      const remoteUpdateTsRes = await getRemoteNoteBiggestUpdateTimeStamp();
      if (remoteUpdateTsRes.errno !== 0) {
        alert(`获取远程 Note 时间戳失败：${remoteUpdateTsRes.message}`);
        return;
      }
      const remoteUpdateTs = remoteUpdateTsRes.data;

      if (localUpdateTs > remoteUpdateTs) {
        const localToRemoteUpdates = getDataForUpdateNoteFromLocalToRemote(localUpdateTs, remoteUpdateTs);
        const total = localToRemoteUpdates.length;
        logMessage(`🔄推送本地Note，共${localToRemoteUpdates.length}条`, "notice", true);
        const batchSize = 100;
        const totalBatches = Math.ceil(total / batchSize);
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * batchSize;
          const end = Math.min(start + batchSize, total);
          const batch = localToRemoteUpdates.slice(start, end);
          await updateNoteFromLocalToRemote(batch);
        }
      }

      const localUpdateCategorySearchTs = getLocalCategorySearchBiggestUpdateTimeStamp();
      const localAddCategorySearchTs = getLocalCategorySearchBiggestAddTimeStamp();
      const remoteUpdateCategorySearchTsRes = await getRemoteCategorySearchBiggestUpdateTimeStamp();
      const remoteAddCategorySearchTsRes = await getRemoteCategorySearchBiggestAddTimeStamp();
      const remoteUpdateCategorySearchTs = remoteUpdateCategorySearchTsRes.data;
      const remoteAddUpdateCategorySearchTs = remoteAddCategorySearchTsRes.data;

      if (localUpdateCategorySearchTs > remoteUpdateCategorySearchTs) {
        const localToRemoteCategorySearchUpdates = getDataForUpdateCategorySearchFromLocalToRemote(
          localUpdateCategorySearchTs,
          remoteUpdateCategorySearchTs,
          remoteAddUpdateCategorySearchTs
        );

        await updateCategorySearchFromLocalToRemote(localToRemoteCategorySearchUpdates);

        if (localAddCategorySearchTs > remoteAddUpdateCategorySearchTs) {
          const localToRemoteCategorySearchAdds = getDataForAddCategorySearchFromLocalToRemote(
            localAddCategorySearchTs,
            remoteAddUpdateCategorySearchTs
          );

          await addCategorySearchFromLocalToRemote(localToRemoteCategorySearchAdds);
          return;
        }
      }
    } catch (err) {
      alert("syncNoteForBack 出错: " + (err && err.message ? err.message : err));
    }
  }

  return {
    init,
    syncData,
    syncNote,
    syncAppInfo,
    backSync,
    alignNotesByCode,
    isSyncLocked,
  };
}
