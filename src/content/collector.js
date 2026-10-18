/**
 * 采集调度器：滚动触发懒加载 -> 平台适配器 -> 通用扫描 -> 网络资源兜底 -> 清洗去重排序。
 */
(function () {
  'use strict';

  const E = window.__ECI;
  const U = E.utils;

  const MAX_IMAGES = 500;
  const MIN_SIDE = 200;
  const SCROLL_BUDGET_MS = 6000;

  const SOURCE_RANK = { main: 0, thumb: 1, detail: 2, unknown: 3 };

  function rankOf(source) {
    return Object.prototype.hasOwnProperty.call(SOURCE_RANK, source) ? SOURCE_RANK[source] : SOURCE_RANK.unknown;
  }

  /**
   * 详情图普遍是懒加载的，不滚到位置就不会请求图片。
   * 这里按视口高度分段滚到底，再恢复原来的滚动位置；用时间预算防止无限滚动页面卡死。
   */
  async function warmUpLazyImages() {
    const doc = document.scrollingElement || document.documentElement;
    const startY = doc.scrollTop;
    const viewport = window.innerHeight || 800;
    const step = Math.round(viewport * 0.8);
    const startedAt = Date.now();
    let y = startY;

    try {
      while (Date.now() - startedAt < SCROLL_BUDGET_MS) {
        y += step;
        doc.scrollTop = y;
        await U.sleep(120);
        if (y >= doc.scrollHeight - viewport) break;
      }
      await U.sleep(150);
    } finally {
      doc.scrollTop = startY;
    }
  }

  /** 从 Performance 资源列表里补齐已被轮播替换掉的图片请求 */
  function collectFromNetwork(site) {
    const out = [];
    const hosts = (site && site.hosts) || [];
    let entries = [];
    try {
      entries = performance.getEntriesByType('resource');
    } catch (err) {
      return out;
    }
    for (const entry of entries) {
      const name = entry && entry.name;
      if (!name || !U.isImageResource(name)) continue;
      let host = '';
      try {
        host = new URL(name).hostname;
      } catch (err) {
        continue;
      }
      if (hosts.length && !U.hostMatches(host, hosts)) continue;
      out.push({ url: name, source: 'unknown', width: 0, height: 0 });
    }
    return out;
  }

  function dedupe(rawItems, adapter) {
    const map = new Map();
    let order = 0;

    for (const raw of rawItems) {
      const input = raw && raw.url;
      if (!input) continue;
      const abs = U.abs(input);
      if (!abs) continue;
      if (!U.isHttp(abs) && !U.isDataImage(abs)) continue;

      let normalized = abs;
      if (adapter && typeof adapter.normalize === 'function') {
        const candidate = adapter.normalize(abs);
        if (candidate) normalized = candidate;
      }

      const trusted = raw.source !== 'unknown';
      if (!trusted && U.isHttp(abs) && U.isNoiseUrl(abs)) continue;
      if (raw.width && raw.height && Math.max(raw.width, raw.height) < MIN_SIDE) continue;

      const key = U.isDataImage(normalized) ? 'data:' + U.hash(normalized) : U.stripQuery(normalized).toLowerCase();
      const previous = map.get(key);
      if (previous) {
        if (!previous.width && raw.width) {
          previous.width = raw.width;
          previous.height = raw.height;
        }
        if (rankOf(raw.source) < rankOf(previous.source)) previous.source = raw.source;
        continue;
      }

      map.set(key, {
        id: '',
        url: abs,
        originalUrl: U.isDataImage(normalized) ? abs : normalized,
        width: raw.width || 0,
        height: raw.height || 0,
        source: raw.source || 'unknown',
        order: order++
      });
    }

    return Array.from(map.values());
  }

  function sortItems(items) {
    return items.sort((a, b) => rankOf(a.source) - rankOf(b.source) || a.order - b.order);
  }

  async function collect(options) {
    const site = options && options.site;
    const adapter = site && E.adapters[site.id];
    const generic = E.adapters.generic;

    await warmUpLazyImages();

    const raw = [];
    if (adapter && typeof adapter.collect === 'function') {
      try {
        raw.push(...adapter.collect());
      } catch (err) {
        console.warn('[电商图片助手] 平台适配器采集失败，改用通用扫描', err);
      }
    }
    if (generic && typeof generic.collect === 'function') {
      try {
        raw.push(...generic.collect());
      } catch (err) {
        console.warn('[电商图片助手] 通用扫描失败', err);
      }
    }
    raw.push(...collectFromNetwork(site));

    const items = sortItems(dedupe(raw, adapter)).slice(0, MAX_IMAGES);
    items.forEach((item, index) => {
      item.id = 'img_' + index;
    });

    let title = '';
    if (adapter && typeof adapter.getTitle === 'function') {
      try {
        title = adapter.getTitle();
      } catch (err) {
        title = '';
      }
    }
    if (!title) title = document.title;

    return {
      version: 1,
      capturedAt: Date.now(),
      pageUrl: location.href,
      platform: site ? site.id : 'unknown',
      platformLabel: site ? site.label : '网页',
      title: U.sanitizeFilenamePart(title, 60),
      items
    };
  }

  E.collect = collect;
})();
