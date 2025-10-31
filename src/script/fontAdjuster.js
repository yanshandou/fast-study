/**
 * 字体调节器模块
 * 提供简单版和动态版两种字体大小调节方案
 */
(function () {
  const FontAdjuster = (() => {
    let isAdjustMode = false;
    let timeoutId;
    const AUTO_CLOSE = 5000;
    let baseSizes = {};
    let elementsMap = {};
    let storageKeyScale, storageKeyBase;
    let scale = 1;
    let taps = 0;
    const MAX_TAPS = 7;
    const TAP_TIMEOUT = 5000;
    let tapTimer;

    /**
     * 初始化字体调节器
     * @param {string[]} selectors - CSS 选择器数组
     */
    function init(selectors) {
      const docId = document.title || location.pathname;
      storageKeyScale = `fontScale_${docId}`;
      storageKeyBase = `fontBaseSizes_${docId}`;

      const savedBase = localStorage.getItem(storageKeyBase);
      baseSizes = savedBase ? JSON.parse(savedBase) : {};

      elementsMap = {};
      selectors.forEach((sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (!els.length) return;
        elementsMap[sel] = els;
        if (!(sel in baseSizes)) {
          baseSizes[sel] = parseFloat(getComputedStyle(els[0]).fontSize);
          if (isNaN(baseSizes[sel])) baseSizes[sel] = 16;
        }
      });
      if (!Object.keys(elementsMap).length) {
        console.error("FontAdjuster: No elements found for", selectors);
        return;
      }
      localStorage.setItem(storageKeyBase, JSON.stringify(baseSizes));

      const savedScale = localStorage.getItem(storageKeyScale);
      scale = savedScale ? parseFloat(savedScale) : 1;
      if (isNaN(scale)) scale = 1;

      _updateAll();
      if (!FontAdjuster._registered) {
        api.addEventListener({ name: "tap" }, _onTap);
        FontAdjuster._registered = true;
      }
    }

    /**
     * 更新所有元素的字体大小
     */
    function _updateAll() {
      Object.entries(elementsMap).forEach(([sel, els]) => {
        const base = baseSizes[sel];
        const final = base * scale;
        els.forEach((el) => el.style.setProperty("font-size", final + "px", "important"));
      });
    }

    /**
     * 调整字体大小
     * @param {number} factor - 缩放因子
     */
    function _adjust(factor) {
      scale = Math.min(10, Math.max(0.1, scale * factor));
      _updateAll();
      localStorage.setItem(storageKeyScale, scale.toFixed(2));
      _resetClose();
    }

    /**
     * 处理屏幕点击事件
     */
    function _onTap() {
      const isPlaying = localStorage.getItem("playListIsPlaying") === "true";
      if (isPlaying) {
        return;
      }
      if (isAdjustMode) return;

      if (!taps) tapTimer = setTimeout(() => (taps = 0), TAP_TIMEOUT);
      if (++taps >= MAX_TAPS) {
        clearTimeout(tapTimer);
        taps = 0;
        _enterMode();
      }
    }

    /**
     * 进入调节模式
     */
    function _enterMode() {
      isAdjustMode = true;
      api.addEventListener({ name: "volumeup" }, () => _adjust(1.1));
      api.addEventListener({ name: "volumedown" }, () => _adjust(1 / 1.1));
      _resetClose();
    }

    /**
     * 重置自动关闭定时器
     */
    function _resetClose() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        isAdjustMode = false;
        api.removeEventListener({ name: "volumeup" });
        api.removeEventListener({ name: "volumedown" });
      }, AUTO_CLOSE);
    }

    /**
     * 重置点击计数
     */
    function resetTaps() {
      taps = 0;
    }
    return { init, resetTaps };
  })();

  window.FontAdjuster = FontAdjuster;

  const DynamicFontAdjuster = (() => {
    const AUTO_CLOSE = 5000;
    const TAP_TIMEOUT = 5000;
    const MAX_TAPS = 7;
    const STEP = 1.1;
    let cfg;
    let adjusting = false;
    let taps = 0;
    let tapTimer;
    let closeTimer;
    const baseSizes = {};
    let elementsMap = {};
    const scales = { true: 1, false: 1 };

    /**
     * 初始化动态字体调节器
     * @param {Object} config - 配置对象
     */
    function init(config) {
      cfg = config;
      const docId = document.title || location.pathname;

      ["true", "false"].forEach((key) => {
        const v = localStorage.getItem(`dfa_${cfg.flagName}_${docId}_${key}`);
        scales[key] = v ? parseFloat(v) : 1;
      });

      elementsMap = {};

      const allSelectors = Object.values(cfg.variants)
        .flat()
        .concat(cfg.common || []);
      allSelectors.forEach((sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (!els.length) return;
        elementsMap[sel] = els;
        if (!(sel in baseSizes)) {
          baseSizes[sel] = parseFloat(getComputedStyle(els[0]).fontSize);
        }
      });

      Object.keys(cfg.variants).forEach((key) => {
        cfg.variants[key].forEach((sel) => {
          const sc = scales[key],
            b = baseSizes[sel];
          elementsMap[sel]?.forEach((el) => el.style.setProperty("font-size", b * sc + "px", "important"));
        });
      });

      (cfg.common || []).forEach((sel) => {
        const b = baseSizes[sel],
          sc = scales["true"];
        elementsMap[sel]?.forEach((el) => el.style.setProperty("font-size", b * sc + "px", "important"));
      });

      _applyAll();

      if (!DynamicFontAdjuster._registered) {
        api.addEventListener({ name: "tap" }, _onTap);
        DynamicFontAdjuster._registered = true;
      }
    }

    /**
     * 处理屏幕点击事件
     */
    function _onTap() {
      const isPlaying = localStorage.getItem("playListIsPlaying") === "true";
      if (isPlaying) {
        return;
      }
      if (adjusting) return;

      if (!taps) tapTimer = setTimeout(() => (taps = 0), TAP_TIMEOUT);
      if (++taps >= MAX_TAPS) {
        clearTimeout(tapTimer);
        taps = 0;
        _enterMode();
      }
    }

    /**
     * 进入调节模式
     */
    function _enterMode() {
      adjusting = true;
      api.addEventListener({ name: "volumeup" }, () => _adjust(STEP));
      api.addEventListener({ name: "volumedown" }, () => _adjust(1 / STEP));
      _resetClose();
    }

    /**
     * 重置自动关闭定时器
     */
    function _resetClose() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(_exitMode, AUTO_CLOSE);
    }

    /**
     * 退出调节模式
     */
    function _exitMode() {
      adjusting = false;
      api.removeEventListener({ name: "volumeup" });
      api.removeEventListener({ name: "volumedown" });
    }

    /**
     * 调整字体大小
     * @param {number} delta - 缩放增量
     */
    function _adjust(delta) {
      const key = window[cfg.flagName] ? "true" : "false";
      const docId = document.title || location.pathname;
      scales[key] = Math.min(10, Math.max(0.1, scales[key] * delta));
      localStorage.setItem(`dfa_${cfg.flagName}_${docId}_${key}`, scales[key].toFixed(2));
      _applyAll();
      window.dispatchEvent(new Event("font-adjusted"));
      _resetClose();
    }

    /**
     * 应用字体大小到所有元素
     */
    function _applyAll() {
      const key = window[cfg.flagName] ? "true" : "false";
      cfg.variants[key].forEach((sel) => {
        const b = baseSizes[sel],
          sc = scales[key];
        elementsMap[sel]?.forEach((el) => el.style.setProperty("font-size", b * sc + "px", "important"));
      });
      (cfg.common || []).forEach((sel) => {
        const b = baseSizes[sel],
          sc = scales[key];
        elementsMap[sel]?.forEach((el) => el.style.setProperty("font-size", b * sc + "px", "important"));
      });
    }

    /**
     * 重置点击计数
     */
    function resetTaps() {
      taps = 0;
    }

    return { init, resetTaps };
  })();

  window.DynamicFontAdjuster = DynamicFontAdjuster;
})();
