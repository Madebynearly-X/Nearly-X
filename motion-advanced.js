/**
 * motion-advanced.js  |  NEARLY Studio
 * Additive. Load with defer AFTER script.js. Same-origin, no inline code, so it
 * satisfies the site's script-src 'self' policy.
 *
 * Handles:
 *   1. Bounce on reveal
 *   2. 3D tilt on cards (mouse hover, or finger down on touch)
 *   3. Interactive 3D hero stage (eased tilt, specular sheen, optional gyro)
 *   4. Parallax on hero visuals
 *   5. Magnetic buttons
 *   6. Price pop on plan switch
 *   7. Before/after comparison slider
 *   8. Ambient lightweight 3D geometric wireframe canvas in hero
 */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* 1. Bounce on reveal ----------------------------------------------------- */
  // Cards, price rows and the compare block spring in. Headings, FAQ rows and
  // the contact form stay on the plain fade from styles.css: text that
  // overshoots reads as nervous, and a form that bounces is harder to aim at.
  const BOUNCY = '.tile, .price-row, .cmp, .cta-band, .feature-list li';

  if (!reduced.matches && 'MutationObserver' in window && Element.prototype.animate) {
    const bounce =
      getComputedStyle(document.documentElement).getPropertyValue('--bounce').trim() ||
      'cubic-bezier(0.16, 1, 0.3, 1)';
    const played = new WeakSet();

    new MutationObserver((records) => {
      records.forEach(({ target: el }) => {
        if (played.has(el) || !el.classList.contains('is-visible') || !el.matches(BOUNCY)) return;
        if (!el.classList.contains('reveal')) return;
        played.add(el);
        const delay = (parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0) * 1000;
        try {
          el.animate(
            [{ transform: 'translateY(36px) scale(0.96)' }, { transform: 'translateY(0) scale(1)' }],
            { duration: 800, delay, easing: bounce, fill: 'backwards' }
          );
        } catch (err) {
          /* Easing not supported: the CSS reveal in styles.css has already run. */
        }
      });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  /* 2. 3D tilt on cards ------------------------------------------------------ */
  // One set of pointer events for mouse and touch. A mouse tilts on hover; a
  // finger tilts only while it is down. When the browser takes the gesture over
  // to scroll it fires pointercancel, which resets the card, so scrolling past
  // a card never leaves it tilted (the old touchmove version did).
  if (!reduced.matches) {
    document.querySelectorAll('.tile').forEach((tile) => {
      let touching = false;

      const aim = (e) => {
        const r = tile.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tile.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
        tile.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
      };

      const reset = () => {
        touching = false;
        tile.classList.remove('is-touch-tilted');
        tile.style.removeProperty('--rx');
        tile.style.removeProperty('--ry');
      };

      tile.addEventListener(
        'pointerdown',
        (e) => {
          if (e.pointerType === 'mouse') return;
          touching = true;
          tile.classList.add('is-touch-tilted');
          aim(e);
        },
        { passive: true }
      );

      tile.addEventListener(
        'pointermove',
        (e) => {
          if (e.pointerType === 'mouse' || touching) aim(e);
        },
        { passive: true }
      );

      ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) =>
        tile.addEventListener(type, reset, { passive: true })
      );
    });
  }

  /* 3. Interactive 3D hero stage ---------------------------------------------- */
  // script.js used to tilt .browser as well, by writing an inline transform that
  // beat these CSS variables, so the two fought. That call has been removed and
  // this is now the only tilt on the stage.
  const stage = document.querySelector('.stage');
  const browser = document.querySelector('.browser');
  if (stage && browser && !reduced.matches) {
    let targetRx = 0;
    let targetRy = 0;
    let currentRx = 0;
    let currentRy = 0;
    let rafId = 0;
    let last = 0;
    let stageInView = true;

    const step = (now) => {
      // Time-based easing, so 60 Hz and 120 Hz screens feel the same.
      const dt = Math.min((now - last) / 16.67 || 1, 3);
      last = now;
      const k = 1 - Math.pow(0.88, dt);
      currentRx += (targetRx - currentRx) * k;
      currentRy += (targetRy - currentRy) * k;
      browser.style.setProperty('--stage-rx', `${currentRx.toFixed(2)}deg`);
      browser.style.setProperty('--stage-ry', `${currentRy.toFixed(2)}deg`);

      const shine = Math.min(Math.max((currentRy - currentRx) * 0.04 + 0.15, 0), 0.55);
      browser.style.setProperty('--stage-shine', shine.toFixed(2));

      if (Math.abs(targetRx - currentRx) > 0.02 || Math.abs(targetRy - currentRy) > 0.02) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = 0;
      }
    };

    const schedule = () => {
      if (rafId) return;
      last = performance.now();
      rafId = requestAnimationFrame(step);
    };

    const aim = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      targetRx = -((clientY - r.top) / r.height - 0.5) * 10;
      targetRy = ((clientX - r.left) / r.width - 0.5) * 12;
      schedule();
    };

    stage.addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
    stage.addEventListener(
      'pointerleave',
      () => {
        targetRx = 0;
        targetRy = 0;
        schedule();
      },
      { passive: true }
    );

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        stageInView = entries[entries.length - 1].isIntersecting;
      }).observe(stage);
    }

    // Subtle device gyroscope tilt on phones, only while the stage is on screen.
    // iOS needs an explicit permission prompt before it sends these events;
    // without one this simply never fires there.
    if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
      window.addEventListener(
        'deviceorientation',
        (e) => {
          if (!stageInView || e.beta == null || e.gamma == null) return;
          const gamma = Math.max(-25, Math.min(25, e.gamma));
          const beta = Math.max(10, Math.min(60, e.beta)) - 35;
          targetRy = (gamma / 25) * 6;
          targetRx = (-beta / 25) * 5;
          schedule();
        },
        { passive: true }
      );
    }
  }

  /* 4. Parallax on hero visuals --------------------------------------------- */
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
        const top = r.top + window.scrollY - layer.py;
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

  /* 5. Magnetic CTAs ------------------------------------------------------- */
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
          if (frame) return;
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

  /* 6. Price pop on plan switch -------------------------------------------- */
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
        void el.offsetWidth;
        el.style.setProperty('--pop-delay', `${i * 45}ms`);
        el.classList.add('is-popping');
      });
    }).observe(plans, { childList: true, characterData: true, subtree: true });

    plans.addEventListener('animationend', (e) => e.target.classList.remove('is-popping'));
  }

  /* 7. Before / after comparison -------------------------------------------- */
  document.querySelectorAll('[data-compare]').forEach((root) => {
    const stageEl = root.querySelector('[data-compare-stage]');
    const range = root.querySelector('[data-compare-range]');
    if (!stageEl || !range) return;

    const update = () => {
      const value = Number(range.value);
      stageEl.style.setProperty('--split', `${value}%`);
      range.setAttribute(
        'aria-valuetext',
        `${value}% focused page, ${100 - value}% generic template`
      );
    };

    range.addEventListener('input', update);
    range.hidden = false;
    update();
  });

  /* 8. Ambient 3D wireframe canvas in the hero -------------------------------- */
  const canvas = document.getElementById('hero-3d-ambient');
  const ctx = canvas && !reduced.matches && canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) {
    const EDGE = 'rgba(0, 102, 204, 0.16)'; // site --blue (#06c) at low alpha
    const DOT = 'rgba(0, 102, 204, 0.28)';
    let width = 0;
    let height = 0;
    let rafId = 0;
    let last = 0;
    let inView = false;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      width = r.width;
      height = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Cube and octahedron wireframes
    const makeCube = (size) => {
      const s = size / 2;
      return {
        vertices: [
          [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
          [-s, -s, s],  [s, -s, s],  [s, s, s],  [-s, s, s],
        ],
        edges: [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ],
      };
    };

    const makeOctahedron = (size) => {
      const s = size;
      return {
        vertices: [
          [s, 0, 0], [-s, 0, 0],
          [0, s, 0], [0, -s, 0],
          [0, 0, s], [0, 0, -s],
        ],
        edges: [
          [0, 2], [0, 3], [0, 4], [0, 5],
          [1, 2], [1, 3], [1, 4], [1, 5],
          [2, 4], [4, 3], [3, 5], [5, 2],
        ],
      };
    };

    // Positions are fractions of the canvas; spin rates are radians per 60 Hz frame.
    const solids = [
      { geom: makeCube(70), x: -0.32, y: -0.22, z: 200, rx: 0.2, ry: 0.3, rz: 0.1, vx: 0.004, vy: 0.005, vz: 0.003 },
      { geom: makeOctahedron(55), x: 0.36, y: -0.18, z: 240, rx: 0.5, ry: 0.2, rz: 0.4, vx: -0.005, vy: 0.004, vz: 0.002 },
      { geom: makeCube(45), x: -0.38, y: 0.25, z: 280, rx: 0.8, ry: 0.6, rz: 0.2, vx: 0.003, vy: -0.004, vz: 0.003 },
      { geom: makeOctahedron(48), x: 0.35, y: 0.32, z: 260, rx: 0.3, ry: 0.9, rz: 0.5, vx: -0.003, vy: 0.005, vz: -0.004 },
    ];

    const rotatePoint = (p, rx, ry, rz) => {
      const [x, y, z] = p;
      let cos = Math.cos(rx);
      let sin = Math.sin(rx);
      const y1 = y * cos - z * sin;
      const z1 = y * sin + z * cos;
      cos = Math.cos(ry);
      sin = Math.sin(ry);
      const x2 = x * cos + z1 * sin;
      const z2 = -x * sin + z1 * cos;
      cos = Math.cos(rz);
      sin = Math.sin(rz);
      return [x2 * cos - y1 * sin, x2 * sin + y1 * cos, z2];
    };

    const shouldRun = () => inView && !document.hidden && !reduced.matches;

    const draw = (now) => {
      rafId = 0;
      if (!shouldRun() || !width) return;

      const dt = Math.min((now - last) / 16.67 || 1, 3);
      last = now;
      ctx.clearRect(0, 0, width, height);

      const fov = 450;
      const cx = width / 2;
      const cy = height * 0.45;
      const count = width < 600 ? 2 : solids.length; // keep phones calm

      for (let n = 0; n < count; n += 1) {
        const item = solids[n];
        item.rx += item.vx * dt;
        item.ry += item.vy * dt;
        item.rz += item.vz * dt;

        const posX = cx + item.x * width;
        const posY = cy + item.y * height;

        const proj = item.geom.vertices.map((v) => {
          const r = rotatePoint(v, item.rx, item.ry, item.rz);
          const scale = fov / (fov + r[2] + item.z);
          return [posX + r[0] * scale, posY + r[1] * scale, scale];
        });

        ctx.strokeStyle = EDGE;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        item.geom.edges.forEach(([i, j]) => {
          ctx.moveTo(proj[i][0], proj[i][1]);
          ctx.lineTo(proj[j][0], proj[j][1]);
        });
        ctx.stroke();

        ctx.fillStyle = DOT;
        proj.forEach(([px, py, scale]) => {
          ctx.beginPath();
          ctx.arc(px, py, 2 * scale, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      rafId = requestAnimationFrame(draw);
    };

    // One place decides whether the loop should be running: hero on screen,
    // tab visible, motion allowed. Anything that changes those calls this.
    const sync = () => {
      if (shouldRun()) {
        if (!rafId) {
          last = performance.now();
          rafId = requestAnimationFrame(draw);
        }
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onResize = () => {
      resize();
      sync(); // restarts the loop if it stopped because the canvas had no size yet
    };

    resize();

    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(canvas);
    } else {
      window.addEventListener('resize', onResize, { passive: true });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        inView = entries[entries.length - 1].isIntersecting;
        sync();
      }).observe(canvas);
    } else {
      inView = true;
    }

    document.addEventListener('visibilitychange', sync);

    // Someone turns on "reduce motion" while the page is open: stop and clear.
    const onReducedChange = () => {
      if (reduced.matches) ctx.clearRect(0, 0, canvas.width, canvas.height);
      sync();
    };
    if (reduced.addEventListener) reduced.addEventListener('change', onReducedChange);

    sync();
  }
})();
