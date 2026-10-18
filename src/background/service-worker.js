/**
 * Service Worker：只做消息路由与结果暂存，避免被 MV3 休眠打断耗时逻辑。
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'lastCapture';
  const GALLERY_PAGE = 'src/gallery/gallery.html';

  function openGallery() {
    return chrome.tabs.create({ url: chrome.runtime.getURL(GALLERY_PAGE) });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'ECI_COLLECT_RESULT') return false;

    const payload = message.payload || {};
    const tabId = sender.tab && sender.tab.id;
    const record = Object.assign({}, payload, {
      tabId: typeof tabId === 'number' ? tabId : null
    });

    chrome.storage.session
      .set({ [STORAGE_KEY]: record })
      .then(openGallery)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('[电商图片助手] 保存采集结果失败', err);
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });

    return true; // 告诉 Chrome 这是异步响应
  });

  // 点击工具栏图标时打开画廊，展示最近一次采集结果
  chrome.action.onClicked.addListener(() => {
    openGallery().catch((err) => {
      console.error('[电商图片助手] 打开画廊失败', err);
    });
  });
})();
