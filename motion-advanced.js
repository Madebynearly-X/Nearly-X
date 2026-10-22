/**
 * motion-advanced.js  |  NEARLY Studio
 * Additive. Load with `defer` AFTER script.js. Same-origin, no inline code, so it
 * satisfies the site's script-src 'self' policy.
 *
 * script.js already handles: scroll reveals, the scroll-progress bar, tile
 * spotlight and tilt, and the payment-plan switch. This file only adds:
 *   1. Bounce on reveal            (springs each block in as script.js reveals it)
 *   2. 3D tilt on cards            (.tile)
 *   3. Parallax on hero visuals    (.stage, .visual-card)
 *   4. Magnetic buttons            (every .button outside the header, plus [data-magnetic])
 *   5. Price pop on the plan switch (watches [data-plans], no change to script.js)
 *   6. The before/after comparison ([data-compare])
 */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* 1. Bounce on reveal ----------------------------------------------------- */
  // script.js fades blocks in by adding .is-visible. We watch for that class and
  // play a springy rise on top, honouring the stagger delay (--d) that script.js
  // sets. Done in JS (not a CSS animation) so script.js clearing --d afterwards
  // cannot make a running animation jump.
  if (!reduced.matches && 'MutationObserver' in window && Element.prototype.animate) {
    const bounce =
      getComputedStyle(document.documentElement).getPropertyValue('--bounce').trim() ||
      'cubic-bezier(0.16, 1, 0.3, 1)';
    const played = new WeakSet();

    new MutationObserver((records) => {
      records.forEach(({ target: el }) => {
        if (played.has(el) || !el.classList.contains('reveal') || !el.classList.contains('is-visible')) return;
        played.add(el);
        const delay = (parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0) * 1000;
        el.animate(
          [{ transform: 'translateY(56px) scale(0.92)' }, { transform: 'translateY(0) scale(1)' }],
          { duration: 900, delay, easing: bounce, fill: 'backwards' }
        );
      });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  /* 2. 3D tilt on cards ----------------------------------------------------- */
  if (finePointer.matches && !reduced.matches) {
    document.querySelectorAll('.tile').forEach((tile) => {
      tile.addEventListener(
        'pointermove',
        (e) => {
          const r = tile.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          tile.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
          tile.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
        },
        { passive: true }
      );
      tile.addEventListener(
        'pointerleave',
        () => {
          tile.style.removeProperty('--rx');
          tile.style.removeProperty('--ry');
        },
        { passive: true }
      );
    });
  }

  /* 3. Parallax on hero visuals --------------------------------------------- */
  // Each visual lags slightly behind the page as it scrolls past. The offset is
  // 0 when the element first enters the screen (so nothing is displaced at page
  // load) and grows to a capped 48px.
  const layers = [...document.querySelectorAll('.stage, .visual-card')].map((el) => ({
    el,
    py: 0,
    start: 0,
    span: 1,
  }));

  if (layers.length && !reduced.matches) {
    const measure = () => {
      const vh = window.innerHeight;
      layers.forEach((layer) => {
        const r = layer.el.getBoundingClientRect();
        const top = r.top + window.scrollY - layer.py; // position without our own offset
        layer.start = Math.max(0, top - vh);
        layer.span = vh + r.height;
      });
    };

    let queued = false;
    const update = () => {
      queued = false;
      layers.forEach((layer) => {
        const progress = Math.min(Math.max(window.scrollY - layer.start, 0), layer.span);
        layer.py = Math.min(progress * 0.05, 48);
        layer.el.style.setProperty('--py', `${layer.py.toFixed(1)}px`);
      });
    };
    const schedule = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };

    measure();
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { measure(); schedule(); }, { passive: true });
    window.addEventListener('load', () => { measure(); schedule(); }, { once: true });
  }

  /* 4. Magnetic CTAs ------------------------------------------------------- */
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

  /* 5. Price pop ----------------------------------------------------------- */
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

  /* 6. Before / after comparison -------------------------------------------- */
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
