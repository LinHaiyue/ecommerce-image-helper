/**
 * 通用兜底采集器。
 * 平台适配器会随电商改版失效，这里的 DOM 扫描是不依赖具体选择器的主力方案。
 */
(function () {
  'use strict';

  const E = window.__ECI;
  const U = E.utils;

  function collectImages() {
    const out = [];
    const images = document.images;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const url = U.pickImageUrl(img);
      if (!url) continue;
      if (U.isHttp(url) && U.isNoiseUrl(url)) continue;
      const size = U.elementSize(img);
      out.push({ url, source: 'unknown', width: size.width, height: size.height });
    }
    return out;
  }

  function collectBackgrounds() {
    const out = [];
    const selector = [
      '[class*="img" i]',
      '[class*="pic" i]',
      '[class*="photo" i]',
      '[class*="thumb" i]',
      '[class*="banner" i]',
      '[class*="swiper" i]',
      '[class*="carousel" i]',
      '[style*="background"]'
    ].join(',');

    let nodes;
    try {
      nodes = document.querySelectorAll(selector);
    } catch (err) {
      return out;
    }

    let scanned = 0;
    for (const el of nodes) {
      if (scanned++ > 1200) break;
      let background = '';
      try {
        background = getComputedStyle(el).backgroundImage;
      } catch (err) {
        continue;
      }
      if (!background || background === 'none' || !background.includes('url(')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) continue;
      const regexp = /url\((['"]?)(.*?)\1\)/g;
      let match;
      while ((match = regexp.exec(background))) {
        const url = U.abs(match[2]);
        if (!url || !U.isHttp(url) || U.isNoiseUrl(url)) continue;
        out.push({ url, source: 'unknown', width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    }
    return out;
  }

  /** 少数详情页把主图或详情图画在 canvas 里，能取到就补一张 */
  function collectCanvases() {
    const out = [];
    document.querySelectorAll('canvas').forEach((canvas) => {
      if (canvas.width < 200 || canvas.height < 200) return;
      try {
        const data = canvas.toDataURL('image/png');
        if (data && data.length > 8000) {
          out.push({ url: data, source: 'unknown', width: canvas.width, height: canvas.height });
        }
      } catch (err) {
        // 画布被跨域图片污染，跳过即可
      }
    });
    return out;
  }

  E.registerAdapter('generic', {
    collect() {
      return [...collectImages(), ...collectBackgrounds(), ...collectCanvases()];
    },
    normalize(url) {
      return url;
    },
    getTitle() {
      return document.title;
    }
  });
})();
