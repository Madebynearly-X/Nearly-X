/**
 * motion-advanced.js  |  NEARLY Studio
 * Additive. Load with defer AFTER script.js. Same-origin, no inline code, so it
 * satisfies the site's script-src 'self' policy.
 *
 * Handles:
 *   1. Bounce on reveal
 *   2. Multi-layer 3D tilt (Desktop pointer & Mobile touch + Gyro)
 *   3. Interactive 3D Hero Stage (multi-layer depth & specular sheen)
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

  /* 2. 3D Tilt on Cards (Desktop Pointer & Mobile Touch) ------------------- */
  if (!reduced.matches) {
    document.querySelectorAll('.tile').forEach((tile) => {
      let active = false;

      const onMove = (clientX, clientY) => {
        const r = tile.getBoundingClientRect();
        const x = (clientX - r.left) / r.width - 0.5;
        const y = (clientY - r.top) / r.height - 0.5;
        tile.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
        tile.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
      };

      const reset = () => {
        active = false;
        tile.classList.remove('is-touch-tilted');
        tile.style.removeProperty('--rx');
        tile.style.removeProperty('--ry');
      };

      // Desktop
      if (finePointer.matches) {
        tile.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
        tile.addEventListener('pointerleave', reset, { passive: true });
      } else {
        // Mobile Touch
        tile.addEventListener(
          'touchstart',
          (e) => {
            active = true;
            tile.classList.add('is-touch-tilted');
            const touch = e.touches[0];
            if (touch) onMove(touch.clientX, touch.clientY);
          },
          { passive: true }
        );

        tile.addEventListener(
          'touchmove',
          (e) => {
            if (!active) return;
            const touch = e.touches[0];
            if (touch) onMove(touch.clientX, touch.clientY);
          },
          { passive: true }
        );

        tile.addEventListener('touchend', reset, { passive: true });
        tile.addEventListener('touchcancel', reset, { passive: true });
      }
    });
  }

  /* 3. Interactive 3D Hero Stage (Multi-layer depth & sheen) --------------- */
  const stage = document.querySelector('.stage');
  const browser = document.querySelector('.browser');
  if (stage && browser && !reduced.matches) {
    let targetRx = 0;
    let targetRy = 0;
    let currentRx = 0;
    let currentRy = 0;
    let rafId = 0;

    const animateStage = () => {
      currentRx += (targetRx - currentRx) * 0.12;
      currentRy += (targetRy - currentRy) * 0.12;
      browser.style.setProperty('--stage-rx', `${currentRx.toFixed(2)}deg`);
      browser.style.setProperty('--stage-ry', `${currentRy.toFixed(2)}deg`);

      const shine = Math.min(Math.max((currentRy - currentRx) * 0.04 + 0.15, 0), 0.55);
      browser.style.setProperty('--stage-shine', shine.toFixed(2));

      if (Math.abs(targetRx - currentRx) > 0.02 || Math.abs(targetRy - currentRy) > 0.02) {
        rafId = requestAnimationFrame(animateStage);
      } else {
        rafId = 0;
      }
    };

    const scheduleStage = () => {
      if (!rafId) rafId = requestAnimationFrame(animateStage);
    };

    const updateFromCoords = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      const x = (clientX - r.left) / r.width - 0.5;
      const y = (clientY - r.top) / r.height - 0.5;
      targetRx = -y * 10;
      targetRy = x * 12;
      scheduleStage();
    };

    stage.addEventListener(
      'pointermove',
      (e) => {
        updateFromCoords(e.clientX, e.clientY);
      },
      { passive: true }
    );

    stage.addEventListener(
      'pointerleave',
      () => {
        targetRx = 0;
        targetRy = 0;
        scheduleStage();
      },
      { passive: true }
    );

    // Subtle device gyroscope tilt on mobile
    if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
      window.addEventListener(
        'deviceorientation',
        (e) => {
          if (e.beta == null || e.gamma == null) return;
          const gamma = Math.max(-25, Math.min(25, e.gamma));
          const beta = Math.max(10, Math.min(60, e.beta)) - 35;
          targetRy = (gamma / 25) * 6;
          targetRx = (-beta / 25) * 5;
          scheduleStage();
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

  /* 8. Ambient 3D Geometric Wireframe Canvas in Hero ----------------------- */
  const canvas = document.getElementById('hero-3d-ambient');
  if (canvas && !reduced.matches && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let animId = 0;
    let isVisible = true;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      width = r.width || window.innerWidth;
      height = r.height || 600;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    // 3D Math primitives: Cube and Octahedron wireframe vertices and edges
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

    // Floating 3D particles in hero space
    const solids = [
      { geom: makeCube(70), x: -0.32, y: -0.22, z: 200, rx: 0.2, ry: 0.3, rz: 0.1, vx: 0.004, vy: 0.005, vz: 0.003 },
      { geom: makeOctahedron(55), x: 0.36, y: -0.18, z: 240, rx: 0.5, ry: 0.2, rz: 0.4, vx: -0.005, vy: 0.004, vz: 0.002 },
      { geom: makeCube(45), x: -0.38, y: 0.25, z: 280, rx: 0.8, ry: 0.6, rz: 0.2, vx: 0.003, vy: -0.004, vz: 0.003 },
      { geom: makeOctahedron(48), x: 0.35, y: 0.32, z: 260, rx: 0.3, ry: 0.9, rz: 0.5, vx: -0.003, vy: 0.005, vz: -0.004 },
    ];

    const rotatePoint = (p, rx, ry, rz) => {
      let [x, y, z] = p;
      // rot X
      let cos = Math.cos(rx), sin = Math.sin(rx);
      let y1 = y * cos - z * sin;
      let z1 = y * sin + z * cos;
      // rot Y
      cos = Math.cos(ry); sin = Math.sin(ry);
      let x2 = x * cos + z1 * sin;
      let z2 = -x * sin + z1 * cos;
      // rot Z
      cos = Math.cos(rz); sin = Math.sin(rz);
      let x3 = x2 * cos - y1 * sin;
      let y3 = x2 * sin + y1 * cos;
      return [x3, y3, z2];
    };

    const render = () => {
      if (!isVisible) return;
      ctx.clearRect(0, 0, width, height);

      const fov = 450;
      const cx = width / 2;
      const cy = height * 0.45;

      solids.forEach((item) => {
        item.rx += item.vx;
        item.ry += item.vy;
        item.rz += item.vz;

        const posX = cx + item.x * width;
        const posY = cy + item.y * height;

        const proj = item.geom.vertices.map((v) => {
          const r = rotatePoint(v, item.rx, item.ry, item.rz);
          const z = r[2] + item.z;
          const scale = fov / (fov + z);
          return [posX + r[0] * scale, posY + r[1] * scale, scale];
        });

        // Draw edges
        ctx.strokeStyle = 'rgba(0, 102, 204, 0.16)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        item.geom.edges.forEach(([i, j]) => {
          ctx.moveTo(proj[i][0], proj[i][1]);
          ctx.lineTo(proj[j][0], proj[j][1]);
        });
        ctx.stroke();

        // Draw vertices
        ctx.fillStyle = 'rgba(0, 102, 204, 0.28)';
        proj.forEach(([px, py, scale]) => {
          ctx.beginPath();
          ctx.arc(px, py, 2 * scale, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      animId = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Pause when hero is out of view to save battery and performance
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible && !animId) {
            animId = requestAnimationFrame(render);
          } else if (!isVisible && animId) {
            cancelAnimationFrame(animId);
            animId = 0;
          }
        });
      });
      observer.observe(canvas);
    } else {
      animId = requestAnimationFrame(render);
    }
  }
})();
