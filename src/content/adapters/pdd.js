/**
 * 拼多多适配器：同时覆盖消费者端（mobile.yangkeduo.com）与商家后台（mms.pinduoduo.com）。
 * 两边 DOM 差异很大，选择器尽量用「属性包含」这种较稳的写法。
 */
(function () {
  'use strict';

  const E = window.__ECI;
  const U = E.utils;

  const MAIN = [
    '[class*="goods"] [class*="swiper"] img',
    '[class*="swiper"] img',
    '[class*="goods-image"] img',
    '[class*="goodsImage"] img',
    '[class*="goodsPic"] img',
    '[class*="banner"] img'
  ];
  const THUMB = ['[class*="thumb"] img', '[class*="thumbnails"] img', '[class*="carousel"] img'];
  const DETAIL = ['[class*="detail"] img', '[class*="desc"] img', '[class*="goods-detail"] img'];
  const TITLE = ['[class*="goods-name"]', '[class*="goodsName"]', '.goods-name', '[class*="goods-title"]', 'h1'];

  /**
   * pddpic / yangkeduo 的图片常带处理参数与派生后缀：
   *   ...jpeg?imageView2/2/w/1300  -> ...jpeg
   *   ...jpeg.a.jpeg               -> ...jpeg
   *   ...png_.webp                 -> ...png
   */
  function normalize(url) {
    let result = U.abs(url);
    if (!result || U.isDataImage(result)) return result;
    result = U.stripQuery(result);
    result = result.replace(/_\.(?:webp|avif)$/i, '');
    result = result.replace(/_(\d+x\d+)(?:q\d+)?(?:\.(?:jpe?g|png|webp|avif))?$/i, '');
    result = result.replace(/\.a\.(jpe?g|png|webp|avif)$/i, '.$1');
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
    return document.title.replace(/[-—|].*(拼多多|pinduoduo|yangkeduo).*$/i, '').trim();
  }

  E.registerAdapter('pdd', {
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
