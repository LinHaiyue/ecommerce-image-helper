/**
 * 电商图片助手官网交互：
 * 1. 移动端导航展开/收起
 * 2. 顶栏滚动阴影
 * 3. 安装命令一键复制
 * 4. 滚动渐显（尊重减少动效偏好）
 * 5. 页脚年份
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ------------------------------ 移动端导航 ------------------------------ */

  const header = document.querySelector('.site-header');
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');

  function closeMenu() {
    if (!menu || !toggle) return;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', (event) => {
      if (!menu.classList.contains('is-open')) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 880) closeMenu();
    });
  }

  /* ------------------------------ 顶栏滚动状态 ------------------------------ */

  function syncHeader() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  /* ------------------------------ 复制安装命令 ------------------------------ */

  document.querySelectorAll('.copy-btn').forEach((button) => {
    const original = button.textContent;

    button.addEventListener('click', async () => {
      const value = button.dataset.copy || '';
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = '已复制';
      } catch (err) {
        button.textContent = '请手动复制';
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 1800);
    });
  });

  /* ------------------------------ 滚动渐显 ------------------------------ */

  const reveals = Array.from(document.querySelectorAll('[data-reveal]'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduceMotion) {
    reveals.forEach((element) => element.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -40px 0px' }
    );

    reveals.forEach((element) => observer.observe(element));
  }

  /* ------------------------------ 页脚年份 ------------------------------ */

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
