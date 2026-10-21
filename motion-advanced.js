/**
 * motion-advanced.js  |  NEARLY Studio
 * Additive. Load with `defer` AFTER script.js. Same-origin, no inline code, so it
 * satisfies the site's script-src 'self' policy.
 *
 * script.js already handles: scroll reveals, the scroll-progress bar, tile
 * spotlight and tilt, and the payment-plan switch. This file only adds:
 *   1. Opt-in magnetic CTAs        ([data-magnetic])
 *   2. The before/after comparison ([data-compare])
 */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* 1. Magnetic CTAs ------------------------------------------------------- */
  if (finePointer.matches && !reduced.matches) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = Number(el.dataset.magnetic) || 0.2;
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

  /* 2. Before / after comparison -------------------------------------------- */
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
