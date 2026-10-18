/**
 * 内容脚本共享命名空间与基础工具。
 *
 * 为什么不用 ES Module：manifest 中 content_scripts 声明的脚本不支持 import/export，
 * 多个文件按 js 数组顺序在同一个隔离世界中执行，因此统一挂载到 window.__ECI 上。
 */
(function () {
  'use strict';

  if (window.__ECI) return;

  /** 支持的站点：test 判断是否为商品详情页，hosts 用于筛选网络请求中的图片域名 */
  const SITE_LIST = [
    {
      id: 'taobao',
      label: '淘宝/天猫',
      hosts: ['alicdn.com', 'taobaocdn.com'],
      test(url) {
        return (
          /^https?:\/\/item\.taobao\.com\/item\.htm/i.test(url) ||
          /^https?:\/\/detail\.tmall\.com\/item\.htm/i.test(url) ||
          /^https?:\/\/chaoshi\.detail\.tmall\.com\//i.test(url) ||
          /^https?:\/\/detail\.tmall\.hk\//i.test(url) ||
          /^https?:\/\/world\.taobao\.com\/item\//i.test(url)
        );
      }
    },
    {
      id: 'jd',
      label: '京东',
      hosts: ['360buyimg.com'],
      test(url) {
        return (
          /^https?:\/\/item\.jd\.com\/\d+\.html/i.test(url) ||
          /^https?:\/\/(?:item|npcitem)\.jd\.hk\/\d+\.html/i.test(url)
        );
      }
    },
    {
      id: 'pdd',
      label: '拼多多',
      hosts: ['pddpic.com', 'yangkeduo.com'],
      test(url) {
        if (/^https?:\/\/mobile\.yangkeduo\.com\/goods/i.test(url)) return true;
        if (/^https?:\/\/mms\.pinduoduo\.com\//i.test(url)) {
          // 商家后台是单页应用，只在商品相关的页面注入，避免在订单/结算页误弹按钮
          return /goods|detail|edit/i.test(url);
        }
        return false;
      }
    }
  ];

  const utils = {
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    /** 协议相对、相对路径统一成绝对 URL，失败返回空串 */
    abs(url) {
      if (!url) return '';
      const raw = String(url).trim();
      if (!raw) return '';
      if (/^data:/i.test(raw)) return raw;
      const withProto = raw.startsWith('//') ? 'https:' + raw : raw;
      try {
        return new URL(withProto, location.href).href;
      } catch (err) {
        return '';
      }
    },

    stripQuery(url) {
      const index = url.indexOf('?');
      return index === -1 ? url : url.slice(0, index);
    },

    isHttp(url) {
      return /^https?:\/\//i.test(url);
    },

    isDataImage(url) {
      return /^data:image\//i.test(url);
    },

    /** 常见的小图标、占位图、埋点，命中即认为不是商品图 */
    isNoiseUrl(url) {
      return /(sprite|icon|logo|avatar|qrcode|qr[_-]?code|placeholder|loading|pixel|1x1|blank|spacer|spaceball|transparent|grey\.gif)/i.test(url);
    },

    isImageResource(url) {
      return /\.(?:jpe?g|png|webp|avif|gif|bmp)(?:[?#]|$)/i.test(url);
    },

    /** 从 srcset 中挑最大的一张：优先按 w 描述符，其次按 x */
    srcsetMax(srcset) {
      if (!srcset) return '';
      let best = '';
      let bestScore = -1;
      for (const part of String(srcset).split(',')) {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) continue;
        const desc = bits[1] || '1x';
        const match = /^([\d.]+)(w|x)$/.exec(desc);
        const score = match ? Number(match[1]) * (match[2] === 'w' ? 1 : 1000) : 1;
        if (score > bestScore) {
          bestScore = score;
          best = bits[0];
        }
      }
      return best;
    },

    /**
     * 读取 img 的真实图片地址。
     * 顺序很关键：懒加载属性里通常是真正的商品图，而 src 可能还停在占位图上。
     */
    pickImageUrl(img) {
      const attrs = ['data-src', 'data-ks-lazyload', 'data-lazyload', 'data-original', 'data-origin', 'data-lazy-img', 'data-url', 'data-image'];
      for (const name of attrs) {
        const value = img.getAttribute(name);
        const abs = value && utils.abs(value);
        if (abs && utils.isHttp(abs)) return abs;
      }
      const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset');
      const fromSet = srcset && utils.srcsetMax(srcset);
      if (fromSet) {
        const abs = utils.abs(fromSet);
        if (abs && utils.isHttp(abs)) return abs;
      }
      if (img.currentSrc) {
        const abs = utils.abs(img.currentSrc);
        if (abs && utils.isHttp(abs)) return abs;
      }
      const src = img.getAttribute('src') || '';
      const abs = utils.abs(src);
      if (abs && utils.isHttp(abs)) return abs;
      if (utils.isDataImage(src)) return src;
      return '';
    },

    /** 元素尺寸：优先图片的自然尺寸，取不到时回退到布局尺寸 */
    elementSize(el) {
      let width = 0;
      let height = 0;
      if (el && el.tagName === 'IMG') {
        width = el.naturalWidth || 0;
        height = el.naturalHeight || 0;
      }
      if (!width || !height) {
        const rect = el.getBoundingClientRect();
        width = Math.round(rect.width);
        height = Math.round(rect.height);
      }
      return { width, height };
    },

    /**
     * 按选择器收集图片，支持元素本身是 img、元素内部包着 img、以及背景图三种情况。
     * 平台适配器共用，减少重复代码。
     */
    collectBySelectors(selectors, source, out) {
      for (const selector of selectors) {
        let nodes;
        try {
          nodes = document.querySelectorAll(selector);
        } catch (err) {
          continue;
        }
        for (const node of nodes) {
          const img = node.tagName === 'IMG' ? node : node.querySelector('img');
          if (img) {
            const url = utils.pickImageUrl(img);
            if (!url) continue;
            const size = utils.elementSize(img);
            out.push({ url, source, width: size.width, height: size.height });
            continue;
          }
          let background = '';
          try {
            background = getComputedStyle(node).backgroundImage;
          } catch (err) {
            background = '';
          }
          const match = background && /url\((['"]?)(.*?)\1\)/.exec(background);
          if (!match) continue;
          const url = utils.abs(match[2]);
          if (!url) continue;
          const rect = node.getBoundingClientRect();
          out.push({ url, source, width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      }
      return out;
    },

    hostMatches(host, list) {
      if (!host) return false;
      return list.some((item) => host === item || host.endsWith('.' + item));
    },

    sanitizeFilenamePart(text, maxLength) {
      const limit = maxLength || 40;
      const cleaned = String(text || '')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+/, '')
        .replace(/\.+$/, '');
      return cleaned.slice(0, limit) || 'goods';
    },

    /** 给 data URL 生成短去重键，避免把整段 base64 当 key */
    hash(str) {
      let hash = 5381;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
      }
      return (hash >>> 0).toString(36);
    }
  };

  const adapters = {};

  window.__ECI = {
    sites: SITE_LIST,
    utils,
    adapters,

    registerAdapter(id, adapter) {
      adapters[id] = adapter;
    },

    detectSite() {
      const href = location.href;
      return SITE_LIST.find((site) => site.test(href)) || null;
    }
  };
})();
