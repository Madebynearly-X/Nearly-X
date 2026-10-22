/**
 * motion-advanced.js  |  NEARLY Studio
 * Additive. Load with `defer` AFTER script.js. Same-origin, no inline code, so it
 * satisfies the site's script-src 'self' policy.
 *
 * script.js already handles: scroll reveals, the scroll-progress bar, tile
 * spotlight and tilt, and the payment-plan switch. This file only adds:
 *   1. Magnetic buttons            (every .button outside the header, plus [data-magnetic])
 *   2. Price pop on the plan switch (watches [data-plans], no change to script.js)
 *   3. The before/after comparison ([data-compare])
 */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* 1. Magnetic CTAs ------------------------------------------------------- */
  if (finePointer.matches && !reduced.matches) {
    const magnets = new Set([
      ...document.querySelectorAll('[data-magnetic]'),
      ...document.querySelectorAll('main .button, .cta-band .button'),
    ]);

    magnets.forEach((el) => {
      const strength = Number(el.dataset.magnetic) || 0.25;
      let frame = 0;

      el.addEventListener(
        'pointermove',
        (e) => {
          if (frame) return; // at most one style write per frame
          frame = requestAnimationFrame(() => {
            frame = 0;
            const r = el.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) * strength;
            const dy = (e.clientY - (r.top + r.height / 2)) * strength;
            el.style.setProperty('--mag-x', `${dx.toFixed(1)}px`);
            el.style.setProperty('--mag-y', `${dy.toFixed(1)}px`);
          });
        },
        { passive: true }
      );

      el.addEventListener(
        'pointerleave',
        () => {
          cancelAnimationFrame(frame);
          frame = 0;
          el.style.removeProperty('--mag-x');
          el.style.removeProperty('--mag-y');
        },
        { passive: true }
      );
    });
  }

  /* 2. Price pop ----------------------------------------------------------- */
  // script.js rewrites the prices when the service toggle changes. Watching the
  // text lets us pop each number without touching that code.
  const plans = document.querySelector('[data-plans]');
  if (plans && !reduced.matches && 'MutationObserver' in window) {
    new MutationObserver((records) => {
      const changed = new Set();
      records.forEach((record) => {
        const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const el = node && node.closest('[data-plan-price], [data-plan-total]');
        if (el) changed.add(el);
      });
      [...changed].forEach((el, i) => {
        el.classList.remove('is-popping');
        void el.offsetWidth; // restart the animation
        el.style.setProperty('--pop-delay', `${i * 45}ms`);
        el.classList.add('is-popping');
      });
    }).observe(plans, { childList: true, characterData: true, subtree: true });

    plans.addEventListener('animationend', (e) => e.target.classList.remove('is-popping'));
  }

  /* 3. Before / after comparison -------------------------------------------- */
  // Without JS the stage shows a static 50/50 split and the range stays hidden,
  // the same progressive-enhancement pattern the payment-plan switch uses.
  document.querySelectorAll('[data-compare]').forEach((root) => {
    const stage = root.querySelector('[data-compare-stage]');
    const range = root.querySelector('[data-compare-range]');
    if (!stage || !range) return;

    const update = () => {
      const value = Number(range.value);
      stage.style.setProperty('--split', `${value}%`);
      range.setAttribute(
        'aria-valuetext',
        `${value}% focused page, ${100 - value}% generic template`
      );
    };

    range.addEventListener('input', update);
    range.hidden = false;
    update();
  });
})();
