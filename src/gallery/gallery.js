/**
 * 画廊页：展示采集结果、处理选择状态、把图片统一转成 PNG 下载。
 * 选择在扩展页面里做转换，是因为扩展页面有 host_permissions，可以绕过 CDN 的跨域限制。
 */
const STORAGE_KEY = 'lastCapture';
const CONCURRENCY = 3;

const TICK_SVG = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const els = {
  title: document.getElementById('page-title'),
  meta: document.getElementById('page-meta'),
  sourceLink: document.getElementById('source-link'),
  recapture: document.getElementById('recapture-btn'),
  empty: document.getElementById('empty-state'),
  gallery: document.getElementById('gallery'),
  grid: document.getElementById('grid'),
  actionbar: document.getElementById('actionbar'),
  count: document.getElementById('selection-count'),
  selectAll: document.getElementById('select-all'),
  invert: document.getElementById('invert'),
  clear: document.getElementById('clear'),
  retry: document.getElementById('retry'),
  cancel: document.getElementById('cancel'),
  download: document.getElementById('download'),
  status: document.getElementById('status'),
  progress: document.getElementById('progress'),
  progressBar: document.getElementById('progress-bar'),
  toast: document.getElementById('toast')
};

const state = {
  capture: null,
  selected: new Set(),
  failed: new Set(),
  downloading: false,
  cancelled: false
};

let toastTimer = 0;

/* ------------------------------ 初始化 ------------------------------ */

async function init() {
  bindEvents();

  try {
    const data = await chrome.storage.session.get(STORAGE_KEY);
    applyCapture(data[STORAGE_KEY] || null);
  } catch (err) {
    console.error('[电商图片助手] 读取采集结果失败', err);
    applyCapture(null);
  }

  chrome.storage.session.onChanged.addListener((changes) => {
    const change = changes[STORAGE_KEY];
    if (!change) return;
    applyCapture(change.newValue || null);
  });
}

function applyCapture(capture) {
  state.capture = capture && Array.isArray(capture.items) && capture.items.length ? capture : null;
  state.selected.clear();
  state.failed.clear();
  render();
}

/* ------------------------------ 渲染 ------------------------------ */

function render() {
  const capture = state.capture;

  if (!capture) {
    els.title.textContent = '图片画廊';
    els.title.removeAttribute('title');
    els.meta.textContent = '暂无采集结果';
    els.sourceLink.hidden = true;
    els.recapture.hidden = true;
    els.empty.hidden = false;
    els.gallery.hidden = true;
    els.actionbar.hidden = true;
    els.grid.replaceChildren();
    return;
  }

  els.empty.hidden = true;
  els.gallery.hidden = false;
  els.actionbar.hidden = false;

  els.title.textContent = capture.title || '未命名商品';
  els.title.title = capture.title || '';
  els.meta.textContent = `${capture.platformLabel || '网页'} · 共 ${capture.items.length} 张 · ${formatTime(capture.capturedAt)}`;

  if (capture.pageUrl) {
    els.sourceLink.href = capture.pageUrl;
    els.sourceLink.hidden = false;
  } else {
    els.sourceLink.hidden = true;
  }

  els.recapture.hidden = typeof capture.tabId !== 'number';

  buildGrid(capture.items);
  updateBar();
  resetProgress();
}

function buildGrid(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.src = item.url;

    // 用一个透明按钮覆盖整张卡片来承载点击与键盘操作，链接作为兄弟节点叠在上层，
    // 避免 button 内嵌 a 这种非法的交互嵌套。
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'select-hit';
    hit.dataset.id = item.id;
    hit.setAttribute('aria-pressed', 'false');
    hit.setAttribute(
      'aria-label',
      `第 ${index + 1} 张图片${item.width && item.height ? `，${item.width}×${item.height}` : ''}`
    );

    const check = document.createElement('span');
    check.className = 'check';
    check.innerHTML = TICK_SVG;

    const openLink = document.createElement('a');
    openLink.className = 'open-link';
    openLink.href = item.originalUrl || item.url;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = '打开原图';
    openLink.hidden = true;

    img.addEventListener('error', () => {
      card.classList.add('is-broken');
      openLink.hidden = false;
    });

    thumb.append(img, hit, check, openLink);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = String(index + 1).padStart(2, '0');

    const size = document.createElement('span');
    size.className = 'size';
    size.textContent = item.width && item.height ? `${item.width}×${item.height}` : '';

    foot.append(idx, size);
    card.append(thumb, foot);
    fragment.appendChild(card);
  });

  els.grid.replaceChildren(fragment);
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
  } catch (err) {
    return '';
  }
}

/* ------------------------------ 选择 ------------------------------ */

function toggleSelection(id) {
  if (!id) return;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  refreshCard(id);
  updateBar();
}

function refreshCard(id) {
  const card = els.grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  const selected = state.selected.has(id);
  card.classList.toggle('is-selected', selected);
  const hit = card.querySelector('.select-hit');
  if (hit) hit.setAttribute('aria-pressed', selected ? 'true' : 'false');
}

function refreshAllCards() {
  for (const card of els.grid.children) {
    const selected = state.selected.has(card.dataset.id);
    card.classList.toggle('is-selected', selected);
    const hit = card.querySelector('.select-hit');
    if (hit) hit.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
}

function selectAll() {
  if (!state.capture) return;
  state.selected = new Set(state.capture.items.map((item) => item.id));
  refreshAllCards();
  updateBar();
}

function invertSelection() {
  if (!state.capture) return;
  const next = new Set();
  for (const item of state.capture.items) {
    if (!state.selected.has(item.id)) next.add(item.id);
  }
  state.selected = next;
  refreshAllCards();
  updateBar();
}

function clearSelection() {
  state.selected.clear();
  refreshAllCards();
  updateBar();
}

function selectedItems() {
  if (!state.capture) return [];
  return state.capture.items.filter((item) => state.selected.has(item.id));
}

function updateBar() {
  const total = state.capture ? state.capture.items.length : 0;
  els.count.textContent = `已选 ${state.selected.size} / 共 ${total} 张`;

  els.download.disabled = state.selected.size === 0 || state.downloading;
  els.download.textContent = state.downloading ? '下载中…' : '下载 PNG';

  els.retry.hidden = state.downloading || state.failed.size === 0;
  els.retry.textContent = `重试失败项 (${state.failed.size})`;

  els.cancel.hidden = !state.downloading;
  els.selectAll.disabled = !state.capture || state.downloading;
  els.invert.disabled = !state.capture || state.downloading;
  els.clear.disabled = !state.capture || state.downloading || state.selected.size === 0;
}

/* ------------------------------ 下载 ------------------------------ */

function downloadSelected() {
  runDownload(selectedItems());
}

function retryFailed() {
  if (!state.capture || !state.failed.size) return;
  const items = state.capture.items.filter((item) => state.failed.has(item.id));
  runDownload(items);
}

async function runDownload(items) {
  if (state.downloading || !state.capture || !items.length) return;

  state.downloading = true;
  state.cancelled = false;
  state.failed = new Set();
  els.grid.querySelectorAll('.is-failed, .is-done').forEach((card) => {
    card.classList.remove('is-failed', 'is-done');
  });
  updateBar();
  els.progress.hidden = false;
  els.progressBar.style.width = '0%';
  els.status.textContent = `正在下载 0/${items.length}`;

  const folder = [
    '电商图片',
    sanitizePart(state.capture.platformLabel || '网页', 20),
    sanitizePart(state.capture.title || 'goods', 40)
  ].join('/');

  const jobs = items.map((item, index) => ({ item, no: index + 1 }));
  const total = jobs.length;
  const failed = new Set();
  let done = 0;

  const worker = async () => {
    while (jobs.length && !state.cancelled) {
      const job = jobs.shift();
      try {
        await downloadOne(job.item, folder, job.no);
        done += 1;
        setCardFlag(job.item.id, 'is-done', true);
      } catch (err) {
        console.error('[电商图片助手] 下载失败', job.item.url, err);
        failed.add(job.item.id);
        setCardFlag(job.item.id, 'is-failed', true);
      }
      updateProgress(done, failed.size, total);
    }
  };

  try {
    const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, worker);
    await Promise.all(workers);
  } finally {
    const cancelled = state.cancelled;
    state.downloading = false;
    state.cancelled = false;
    state.failed = failed;

    updateBar();
    updateProgress(done, failed.size, total);

    if (cancelled) {
      showToast(`已取消：成功 ${done} 张，失败 ${failed.size} 张`);
    } else if (failed.size) {
      showToast(`下载完成：成功 ${done} 张，失败 ${failed.size} 张，可点击「重试失败项」`);
    } else {
      showToast(`已下载 ${done} 张 PNG`);
    }

    window.setTimeout(() => {
      if (!state.downloading) resetProgress();
    }, 4000);
  }
}

async function downloadOne(item, folder, index) {
  const source = item.originalUrl || item.url;
  const blob = await fetchImage(source);
  const png = await convertToPng(blob);
  const objectUrl = URL.createObjectURL(png);

  try {
    await chrome.downloads.download({
      url: objectUrl,
      filename: `${folder}/${String(index).padStart(2, '0')}.png`,
      conflictAction: 'uniquify',
      saveAs: false
    });
  } finally {
    // 下载是异步读取 blob 的，延迟回收，避免文件还没写完链接就失效
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
  }
}

async function fetchImage(url) {
  const attempts = [
    { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache' },
    { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'reload' }
  ];

  let lastError = null;
  for (const options of attempts) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const type = response.headers.get('content-type') || '';
      if (type && !/^(image\/|application\/octet-stream|binary\/octet-stream)/i.test(type)) {
        lastError = new Error(`响应不是图片（${type}）`);
        continue;
      }
      const blob = await response.blob();
      if (!blob.size) {
        lastError = new Error('图片内容为空');
        continue;
      }
      return blob;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('图片获取失败');
}

async function convertToPng(blob) {
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      if (typeof bitmap.close === 'function') bitmap.close();
      return await canvas.convertToBlob({ type: 'image/png' });
    } catch (err) {
      console.warn('[电商图片助手] OffscreenCanvas 转换失败，改用 DOM canvas', err);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('PNG 编码失败'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

/* ------------------------------ 辅助 ------------------------------ */

function setCardFlag(id, className, enabled) {
  const card = els.grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (card) card.classList.toggle(className, enabled);
}

function sanitizePart(text, limit) {
  const cleaned = String(text || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  return cleaned.slice(0, limit) || 'goods';
}

function updateProgress(done, failedCount, total) {
  els.progress.hidden = false;
  const finished = done + failedCount;
  const percent = total ? Math.min(100, Math.round((finished / total) * 100)) : 0;
  els.progressBar.style.width = percent + '%';
  els.status.textContent = finished >= total ? `已完成 ${total} 张` : `正在下载 ${finished}/${total}`;
}

function resetProgress() {
  els.progress.hidden = true;
  els.progressBar.style.width = '0%';
  els.status.textContent = '';
}

function showToast(message, duration) {
  els.toast.textContent = message;
  els.toast.dataset.show = 'true';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.dataset.show = 'false';
  }, duration || 3200);
}

async function recapture() {
  const capture = state.capture;
  if (!capture || typeof capture.tabId !== 'number') return;

  try {
    await chrome.tabs.update(capture.tabId, { active: true });
  } catch (err) {
    // 标签页可能已经被关闭，继续尝试发送消息即可
  }

  try {
    await chrome.tabs.sendMessage(capture.tabId, { type: 'ECI_RECAPTURE' });
    showToast('已请求重新采集，请回到原页面查看');
  } catch (err) {
    showToast('原页面已关闭或不支持，请手动刷新页面后重试');
  }
}

/* ------------------------------ 事件 ------------------------------ */

function bindEvents() {
  els.grid.addEventListener('click', (event) => {
    const hit = event.target.closest('.select-hit');
    if (!hit) return;
    const card = hit.closest('.card');
    if (!card) return;
    toggleSelection(card.dataset.id);
  });

  els.selectAll.addEventListener('click', selectAll);
  els.invert.addEventListener('click', invertSelection);
  els.clear.addEventListener('click', clearSelection);
  els.download.addEventListener('click', downloadSelected);
  els.retry.addEventListener('click', retryFailed);
  els.recapture.addEventListener('click', recapture);

  els.cancel.addEventListener('click', () => {
    if (!state.downloading) return;
    state.cancelled = true;
    els.status.textContent = '正在取消…';
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (!state.downloading) selectAll();
      return;
    }

    if (event.key === 'Escape') {
      if (!state.downloading) clearSelection();
      return;
    }

    if (event.key === 'Enter' && document.activeElement === document.body) {
      event.preventDefault();
      if (!els.download.disabled) downloadSelected();
    }
  });
}

init();
