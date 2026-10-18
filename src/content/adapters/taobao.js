/**
 * 淘宝 / 天猫适配器。
 * 选择器只做增强，抓不到时由通用扫描兜底，因此这里全部包了容错。
 */
(function () {
  'use strict';

  const E = window.__ECI;
  const U = E.utils;

  const MAIN = ['#J_ImgBooth', '.tb-main-pic img', '[class*="PicGallery"] img', '[class*="mainPic"] img'];
  const THUMB = ['.tb-thumb img', '#J_UlThumb img', '[class*="thumbnail"] img', '[class*="thumbnails"] img'];
  const DETAIL = ['#description img', '#J_DivItemDesc img', '#J_ItemDesc img', '[class*="desc"] img', '[class*="detail"] img'];
  const TITLE = ['#J_Title .tb-main-title', '.tb-main-title', '[class*="ItemHeader"] [class*="title"]', 'h1'];

  /**
   * alicdn 的图片会带尺寸/质量后缀，去掉后缀拿原图：
   *   xxx.jpg_430x430q90.jpg  -> xxx.jpg
   *   xxx.jpg_.webp           -> xxx.jpg
   *   xxx.jpg_q90.jpg         -> xxx.jpg
   */
  function normalize(url) {
    let result = U.abs(url);
    if (!result || U.isDataImage(result)) return result;
    result = U.stripQuery(result);
    result = result.replace(/(\.(?:jpe?g|png|webp|gif))_[^/]*$/i, '$1');
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
    return document.title.replace(/[-—|].*(淘宝|天猫|tmall|taobao).*$/i, '').trim();
  }

  E.registerAdapter('taobao', {
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
