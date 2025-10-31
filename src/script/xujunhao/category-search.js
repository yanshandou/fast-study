/**
 * APICloud 应用就绪时的初始化函数
 * 设置事件监听器，关闭其他窗口，初始化页面状态
 */
apiready = function () {
  setTimeout(() => {
    api.closeWin({ name: "card" });
    api.closeWin({ name: "studyInfo" });
    api.closeWin({ name: "list" });
    api.closeWin({ name: "category" });
  }, 500);
  api.addEventListener({ name: "keyback" }, function () {
    keyback();
  });
  api.addEventListener({ name: "resume" }, function () {
    getStartTimeStamp();
    appToFront("category-search, resume");
    checkNeedSyncByUpdateTimeStamp();
  });
  api.addEventListener({ name: "pause" }, function () {
    appToBack();
  });
  api.removeEventListener({ name: "shake" });
  api.removeEventListener({ name: "longpress" });
  /**
   * 跳转到分类页面
   * @param {string} searchCategoryContent - 搜索的分类内容
   */
  function toCategory(searchCategoryContent) {
    api.removeEventListener({ name: "shake" });
    api.removeEventListener({ name: "longpress" });
    api.openWin({
      name: "category",
      url: "./category.html",
      pageParam: { searchCategoryContent },
      animation: { type: "push", subType: "from_bottom" },
    });
  }
  /**
   * 返回键处理函数
   * 清除事件监听器并返回到分类页面
   */
  function keyback() {
    api.removeEventListener({ name: "shake" });
    api.removeEventListener({ name: "longpress" });
    api.openWin({
      name: "category",
      url: "./category.html",
      animation: { type: "push", subType: "from_bottom" },
    });
  }
  let historyData = queryCategorySearch();
  const deletedCache = {};
  /**
   * 获取按名称排序的历史记录
   * @returns {Array} 按中文名称排序的历史记录数组
   */
  function getSortedHistory() {
    return [...historyData].sort((a, b) => {
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }
  /**
   * 根据搜索次数获取对应的CSS渐变背景
   * @param {number} count - 搜索次数
   * @returns {string} CSS渐变背景字符串
   */
  function getGradient(count) {
    switch (count) {
      case 1:
        return "linear-gradient(to right, #2c3e50, #bdc3c7)";
      case 2:
        return "linear-gradient(to right, #ff0844, #ffb199)";
      case 3:
        return "linear-gradient(to right, #f09819, #f6d365)";
      case 4:
        return "linear-gradient(to right, #2f80ed, #56ccf2)";
      case 5:
        return "linear-gradient(to right, #0ba360, #3cba92)";
      default:
        return "linear-gradient(to right, #5961f9, #ee9ae5)";
    }
  }
  /**
   * 为DOM元素添加长按监听器
   * @param {HTMLElement} div - 需要添加监听器的DOM元素
   * @param {Object} item - 搜索历史项目对象
   */
  function addLongPressListener(div, item) {
    let timer = null;
    let longPressed = false;
    const start = () => {
      timer = setTimeout(() => {
        longPressed = true;
        handleLongPress(item, div);
      }, 500);
    };
    const cancel = (isClick) => {
      clearTimeout(timer);
      if (!longPressed && isClick) handleClick(item);
      longPressed = false;
    };
    div.addEventListener("pointerdown", start);
    div.addEventListener("pointerup", () => cancel(true));
    div.addEventListener("pointercancel", () => cancel(false));
    div.addEventListener("pointerleave", () => cancel(false));
  }
  /**
   * 处理历史项目的点击事件
   * @param {Object} item - 被点击的历史项目对象
   */
  function handleClick(item) {
    const input = document.getElementById("searchInput");
    if (input.value === item.name) {
      doSearch();
    } else {
      input.value = item.name;
    }
  }
  /**
   * 处理历史项目的长按事件
   * @param {Object} item - 被长按的历史项目对象
   * @param {HTMLElement} div - 对应的DOM元素
   */
  /**
   * 处理历史项目的长按事件
   * @param {Object} item - 被长按的历史项目对象
   * @param {HTMLElement} div - 对应的DOM元素
   */
  function handleLongPress(item, div) {
    shakeThePhone();
    div.style.display = "none";
    if (!item.isTemporary) {
      deleteCategorySearch(item.id);
    }
    historyData = historyData.filter((h) => h.id !== item.id);
    deletedCache[item.id] = { item, element: div };
    let showMessageCategoryText = item.name;
    if (showMessageCategoryText.length > 8) {
      showMessageCategoryText = showMessageCategoryText.slice(0, 8) + "...";
    }
    showMessage(
      `点击恢复「${showMessageCategoryText}」`,
      2000,
      "delete2",
      "warning",
      "center",
      restoreCategoryDeletedSearch,
      item.id
    );
  }
  /**
   * 恢复被删除的分类搜索历史
   * @param {string} id - 要恢复的历史记录ID
   */
  function restoreCategoryDeletedSearch(id) {
    const cache = deletedCache[id];
    if (!cache) return;
    if (!cache.item.isTemporary) {
      restoreCategorySearch(id);
    }
    historyData.push(cache.item);
    cache.element.style.display = "flex";
    delete deletedCache[id];
    renderHistory();
  }
  /**
   * 渲染搜索历史记录到页面
   * 创建历史记录的DOM元素并添加事件监听器
   */
  function renderHistory() {
    const container = document.getElementById("historyContainer");
    if (!historyData.length) {
      container.style.display = "none";
      return;
    }
    container.style.display = "flex";
    container.innerHTML = "";
    getSortedHistory().forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.style.background = getGradient(item.count);
      const spanText = document.createElement("span");
      spanText.textContent = item.name;
      div.appendChild(spanText);
      addLongPressListener(div, item);
      container.appendChild(div);
    });
  }
  /**
   * 执行搜索操作
   * 处理普通搜索和特殊的"*"搜索（显示所有分类）
   */
  function doSearch() {
    const input = document.getElementById("searchInput");
    const val = input.value.trim();
    if (!val) return;
    if (val === "*") {
      const allCategories = getAllCategories();
      if (allCategories.length === 0) {
        showMessage("没有查询到任何分类!", 2000, "doneerror2", "error");
        return;
      }
      const existingCategoryNames = new Set(historyData.map((item) => item.name));
      const newCategories = allCategories.filter((category) => !existingCategoryNames.has(category));
      if (newCategories.length === 0) {
        showMessage("所有分类都已在页面中显示!", 2000, "doneerror2", "warning");
        return;
      }
      newCategories.forEach((category) => {
        historyData.push({
          id: `temp_${Date.now()}_${Math.random()}`,
          name: category,
          count: 1,
          isTemporary: true,
        });
      });
      renderHistory();
      input.value = "";
      showMessage(
        `显示了 ${newCategories.length} 个新分类，共 ${allCategories.length} 个分类!`,
        3000,
        "donesuccess2",
        "success",
        "center",
        toCategory,
        "*"
      );
      return;
    }
    const added = addCategorySearch(val);
    if (!added) return;
    const existingIndex = historyData.findIndex((i) => i.name === added.name);
    if (existingIndex !== -1) {
      historyData[existingIndex] = added;
    } else {
      historyData.push(added);
    }
    renderHistory();
    input.value = "";
    const inputCategoryList = val.split(/[,，]/).map((i) => i.trim());
    const searchCategoryArray = getSearchedCategory(inputCategoryList, "AND");
    if (searchCategoryArray.length === 0) {
      showMessage("没有查询到内容!", 2000, "doneerror2", "error");
    } else {
      showMessage(
        `查询到 ${searchCategoryArray.length} 个分类!`,
        3000,
        "donesuccess2",
        "success",
        "center",
        toCategory,
        val
      );
    }
  }
  // 绑定UI事件监听器
  document.getElementById("searchBtn").onclick = doSearch;
  document.getElementById("cancelBtn").onclick = keyback;
  document.getElementById("searchInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      doSearch();
    }
  });
  // 初始化渲染历史记录
  renderHistory();
};
