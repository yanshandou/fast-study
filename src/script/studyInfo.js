/**
 * 显示学习总时长对话框并跳转到分类页面
 * @param {string} studyTimeString - 学习时长文本，用于在对话框中显示
 *
 * 功能：
 * 1. 使用 SweetAlert2 显示成功提示框，内容为学习时长
 * 2. 用户点击确定后跳转到 category.html 页面
 * 3. 使用从右滑入的动画效果
 */
function showStudyTimeAndGoToCategory(studyTimeString) {
  Swal.fire({
    title: studyTimeString,
    icon: "success",
    confirmButtonText: "确定",
    customClass: {
      popup: "swal-custom-popup",
      confirmButton: "swal-button--confirm-full-green",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      api.openWin({
        name: "category",
        url: "./category.html",
        animation: {
          type: "push",
          subType: "from_right",
        },
      });
    }
  });
}
/**
 * APICloud 页面入口函数
 * 页面加载完成后自动调用
 *
 * 主要功能：
 * 1. 初始化同步逻辑模块
 * 2. 根据页面参数执行对应操作
 * 3. 监听应用前后台切换事件
 * 4. 清理旧窗口，避免内存泄漏
 */
apiready = function () {
  const sync = createSyncLogic();
  const action = api.pageParam.action || "";
  sync.init(action);
  api.addEventListener({ name: "resume" }, () => {
    getStartTimeStamp();
    appToFront("card.html, resume");
    checkNeedSyncByUpdateTimeStamp();
  });
  api.addEventListener({ name: "pause" }, () => {
    appToBack();
  });
  setTimeout(() => {
    api.closeWin({ name: "category" });
    api.closeWin({ name: "list" });
    api.closeWin({ name: "card" });
    api.closeWin({
      name: "category-search",
    });
  }, 1000);
};
