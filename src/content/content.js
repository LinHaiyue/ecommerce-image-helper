/**
 * 内容脚本入口：判断当前页是否为受支持的商品详情页，注入按钮并驱动采集流程。
 */
(function () {
  'use strict';

  const E = window.__ECI;
  if (!E || !E.ui) return;

  let mountedSiteId = null;
  let busy = false;

  function resetButtonLater() {
    window.setTimeout(() => {
      if (!busy) E.ui.setState('idle', '获取图片');
    }, 2500);
  }

  async function handleCapture() {
    const site = E.detectSite();
    if (!site || busy) return;

    busy = true;
    E.ui.setState('collecting', '正在获取…');

    try {
      const payload = await E.collect({ site });

      if (!payload.items.length) {
        E.ui.setState('idle', '获取图片');
        E.ui.toast('未获取到图片，请确认页面已完整加载后重试');
        return;
      }

      E.ui.setState('done', `已获取 ${payload.items.length} 张`);

      chrome.runtime.sendMessage({ type: 'ECI_COLLECT_RESULT', payload }, (response) => {
        if (chrome.runtime.lastError) {
          E.ui.toast('打开画廊失败：' + chrome.runtime.lastError.message);
          return;
        }
        if (!response || !response.ok) {
          E.ui.toast('打开画廊失败，请重试');
        }
      });
    } catch (err) {
      console.error('[电商图片助手] 采集失败', err);
      E.ui.setState('idle', '获取图片');
      E.ui.toast('获取失败，请重试');
    } finally {
      busy = false;
      resetButtonLater();
    }
  }

  function sync() {
    const site = E.detectSite();

    if (!site) {
      if (mountedSiteId) {
        mountedSiteId = null;
        E.ui.unmount();
      }
      return;
    }

    if (E.ui.isMounted()) {
      mountedSiteId = site.id;
      return;
    }

    mountedSiteId = site.id;
    E.ui.mount(site, handleCapture);
    E.ui.setState('idle', '获取图片');
  }

  // 商家后台、拼多多等都是单页应用，路由变化不会重新注入脚本，轮询 URL 成本很低且最稳。
  sync();
  window.setInterval(sync, 1500);
  window.addEventListener('popstate', sync);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'ECI_RECAPTURE') return false;
    if (!busy) handleCapture();
    sendResponse({ ok: true });
    return true;
  });
})();
