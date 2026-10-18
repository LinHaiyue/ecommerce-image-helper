/**
 * 页面内悬浮按钮：全部放在 Shadow DOM 里，避免与原站点的样式互相污染。
 */
(function () {
  'use strict';

  const E = window.__ECI;

  const HOST_ID = '__eci_host__';

  let host = null;
  let shadow = null;
  let button = null;
  let label = null;
  let toastEl = null;
  let toastTimer = 0;
  let handler = null;
  let state = 'idle';

  const STYLE = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 18px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #ff7a3d 0%, #ff4d0f 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: .2px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(255, 77, 15, .28), 0 2px 6px rgba(0, 0, 0, .12);
      transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(255, 77, 15, .34), 0 3px 8px rgba(0, 0, 0, .14);
    }
    .btn:active { transform: translateY(0) scale(.98); }
    .btn:focus-visible { outline: 2px solid #1a1a1a; outline-offset: 3px; }
    .btn[disabled] { cursor: default; opacity: .85; transform: none; }
    .icon { display: inline-flex; width: 18px; height: 18px; flex: none; }
    .icon svg { display: block; width: 100%; height: 100%; }
    .spinner {
      display: none;
      width: 16px;
      height: 16px;
      flex: none;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, .35);
      border-top-color: #fff;
      animation: eci-spin .8s linear infinite;
    }
    .btn[data-state="collecting"] .icon { display: none; }
    .btn[data-state="collecting"] .spinner { display: inline-block; }
    .btn[data-state="done"] {
      background: linear-gradient(135deg, #2eb67d 0%, #1f9d68 100%);
      box-shadow: 0 8px 24px rgba(31, 157, 104, .26), 0 2px 6px rgba(0, 0, 0, .12);
    }
    .toast {
      max-width: 260px;
      padding: 9px 13px;
      border-radius: 10px;
      background: rgba(24, 24, 27, .94);
      color: #fff;
      font-size: 13px;
      line-height: 1.45;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .22);
      opacity: 0;
      transform: translateY(6px);
      transition: opacity .18s ease, transform .18s ease;
      pointer-events: none;
    }
    .toast[data-show="true"] { opacity: 1; transform: translateY(0); }
    @keyframes eci-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .btn, .toast { transition: none; }
      .spinner { animation-duration: 2s; }
    }
  `;

  function mount(site, onCapture) {
    if (host) return;
    handler = onCapture;

    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = [
      'position: fixed',
      'right: 24px',
      'bottom: 24px',
      'display: block',
      'z-index: 2147483646',
      'line-height: 0'
    ].join(';');

    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${STYLE}</style>
      <div class="wrap">
        <div class="toast" role="status" aria-live="polite"></div>
        <button class="btn" type="button" data-state="idle" aria-label="获取本页商品图片">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3v11" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <path d="m7 10 5 5 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 18.5h16" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="txt">获取图片</span>
          <span class="spinner" aria-hidden="true"></span>
        </button>
      </div>
    `;

    button = shadow.querySelector('.btn');
    label = shadow.querySelector('.txt');
    toastEl = shadow.querySelector('.toast');

    button.addEventListener('click', () => {
      if (state === 'collecting') return;
      if (typeof handler === 'function') handler();
    });

    (document.body || document.documentElement).appendChild(host);
  }

  function unmount() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
    button = null;
    label = null;
    toastEl = null;
    state = 'idle';
  }

  function setState(next, text) {
    state = next;
    if (!button) return;
    button.dataset.state = next;
    button.disabled = next === 'collecting';
    button.setAttribute('aria-busy', next === 'collecting' ? 'true' : 'false');
    if (label) {
      label.textContent = text || (next === 'collecting' ? '正在获取…' : '获取图片');
      button.setAttribute('aria-label', label.textContent);
    }
  }

  function toast(message, duration) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (toastEl) toastEl.dataset.show = 'false';
    }, duration || 3000);
  }

  E.ui = {
    mount,
    unmount,
    setState,
    toast,
    isMounted() {
      return Boolean(host && host.parentNode);
    }
  };
})();
