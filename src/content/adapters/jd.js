/**
 * 京东适配器。
 */
(function () {
  'use strict';

  const E = window.__ECI;
  const U = E.utils;

  const MAIN = ['#spec-img', '.sku-img img', '[class*="main-img"] img', '[class*="mainImg"] img'];
  const THUMB = ['#spec-list img', '.spec-items img', '[class*="spec-list"] img', '[class*="specList"] img'];
  const DETAIL = ['#J-detail-content img', '.detail-content img', '[class*="detail-content"] img', '#J-detail img', '[class*="pd-detail"] img'];
  const TITLE = ['.sku-name', '[class*="sku-name"]', '[class*="skuName"]', 'h1'];

  /**
   * 京东图片路径里的 n0 才是原图，n1/n5 等都是规格图：
   *   /n1/s450x450_jfs/t1/...jpg -> /n0/jfs/t1/...jpg
   * 另外去掉 !q70.dpg.webp 之类的处理参数。
   */
  function normalize(url) {
    let result = U.abs(url);
    if (!result || U.isDataImage(result)) return result;
    result = U.stripQuery(result);
    result = result.replace(/\/n\d+\//i, '/n0/');
    result = result.replace(/\/s\d+x\d+_jfs\//i, '/jfs/');
    result = result.replace(/![^/]*$/i, '');
    return result;
  }

  function getTitle() {
    for (const selector of TITLE) {
      let node;
      try {
        node = document.querySelector(selector);
      } catch (err) {
        continue;
      }
      const text = node && (node.textContent || node.getAttribute('title') || '');
      if (text && text.trim()) return text.trim();
    }
    return document.title.replace(/[-—|].*(京东|jd\.com).*$/i, '').trim();
  }

  E.registerAdapter('jd', {
    collect() {
      const out = [];
      U.collectBySelectors(MAIN, 'main', out);
      U.collectBySelectors(THUMB, 'thumb', out);
      U.collectBySelectors(DETAIL, 'detail', out);
      return out;
    },
    normalize,
    getTitle
  });
})();
