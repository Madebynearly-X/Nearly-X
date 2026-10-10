(() => {
  "use strict";

  const demos = [...document.querySelectorAll("[data-demo]")];
  const live = document.querySelector("[data-demo-live]");
  if (!demos.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let current = null;
  let opener = null;

  const announce = (message) => {
    if (!live) return;
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = message;
    }, 30);
  };

  const route = (moveFocus = false) => {
    let target = null;
    try {
      target = window.location.hash
        ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
        : null;
    } catch (error) {
      target = null;
    }

    const active = target?.closest("[data-demo]") || null;
    const changed = active !== current;
    demos.forEach((demo) => {
      demo.hidden = active ? demo !== active : false;
    });
    current = active;

    if (target) {
      target.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start",
      });
    }

    if (!moveFocus) return;

    if (active && target === active) {
      const heading = active.querySelector("h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    } else if (!active && changed && opener?.isConnected) {
      opener.focus();
    }

    if (changed) {
      const heading = active?.querySelector("h2");
      announce(active
        ? `Showing ${heading?.innerText.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "") || "website demo"}.`
        : "Showing all website concepts.");
    }
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#demo-"], a[href="#all-demos"]');
    if (!link) return;

    if (link.matches('a[href^="#demo-"]')) opener = link;
    if (link.getAttribute("href") === window.location.hash) route(true);
  });

  window.addEventListener("hashchange", () => route(true));
  route();

  const player = document.querySelector("[data-player]");
  const audioStatus = document.querySelector("[data-audio-status]");
  const audioToggle = document.querySelector("[data-audio-toggle]");
  const actButtons = [...document.querySelectorAll("[data-act]")];
  const audioContextConstructor = window.AudioContext;
  let audioContext = null;
  let playbackTimer = 0;
  let playbackVersion = 0;
  let activeAct = null;

  const setPlayerState = (act, message) => {
    activeAct = act;
    if (player) {
      if (act) player.dataset.active = act;
      else delete player.dataset.active;
    }
    actButtons.forEach((button) => {
      const active = button.dataset.act === act;
      button.setAttribute("aria-pressed", String(active));
      const state = button.querySelector(".pulse__act-state");
      if (state) state.textContent = active ? "Stop ↗" : "Play ↗";
    });
    if (audioToggle) {
      audioToggle.setAttribute("aria-pressed", String(Boolean(act)));
      const label = audioToggle.firstChild;
      if (label?.nodeType === Node.TEXT_NODE) {
        label.textContent = act ? "Stop sound preview " : "Play a sound preview ";
      }
    }
    if (audioStatus && message) audioStatus.textContent = message;
  };

  const stopAudio = (message = "Sound preview stopped.") => {
    playbackVersion += 1;
    window.clearTimeout(playbackTimer);
    setPlayerState(null, message);
    if (audioContext?.state === "running") {
      audioContext.suspend().catch((error) => {
        if (audioStatus) audioStatus.textContent = "The sound preview could not be paused.";
        console.error("Could not pause the sound preview.", error);
      });
    }
  };

  const playAudio = async (act) => {
    if (!audioContextConstructor) {
      setPlayerState(null, "Audio previews are not supported in this browser.");
      return;
    }
    if (activeAct) {
      stopAudio();
      return;
    }

    const version = ++playbackVersion;
    const presets = {
      nova: { root: 196, notes: [0, 3, 7, 10, 7, 3, 5, 10], beat: 0.34, wave: "sine" },
      amber: { root: 147, notes: [0, 5, 7, 12, 7, 5, 3, 10], beat: 0.27, wave: "triangle" },
      orbit: { root: 110, notes: [0, 2, 5, 7, 5, 2, 3, 7], beat: 0.42, wave: "sine" },
      kiln: { root: 165, notes: [0, 1, 7, 8, 7, 1, 5, 8], beat: 0.23, wave: "triangle" },
    };
    const preset = presets[act];
    if (!preset) return;

    try {
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new audioContextConstructor();
      }
      await audioContext.resume();
      if (version !== playbackVersion) return;

      setPlayerState(act, "Playing a short, original sound sketch generated in your browser.");
      const startAt = audioContext.currentTime + 0.04;
      preset.notes.forEach((note, index) => {
        const start = startAt + index * preset.beat;
        const duration = preset.beat * 0.72;
        const oscillator = audioContext.createOscillator();
        const volume = audioContext.createGain();
        oscillator.type = preset.wave;
        oscillator.frequency.setValueAtTime(preset.root * 2 ** (note / 12), start);
        volume.gain.setValueAtTime(0.0001, start);
        volume.gain.exponentialRampToValueAtTime(0.075, start + 0.025);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(volume);
        volume.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });

      playbackTimer = window.setTimeout(() => {
        if (version !== playbackVersion) return;
        setPlayerState(null, "Sound preview complete. Choose another artist to listen again.");
        if (audioContext?.state === "running") {
          audioContext.suspend().catch((error) => {
            if (audioStatus) audioStatus.textContent = "The sound preview finished but could not be paused.";
            console.error("Could not suspend the sound preview.", error);
          });
        }
      }, preset.notes.length * preset.beat * 1000 + 250);
    } catch (error) {
      setPlayerState(null, "Could not start the audio preview. Check your browser's sound settings and try again.");
      console.error("Could not play the sound preview.", error);
    }
  };

  actButtons.forEach((button) => {
    button.addEventListener("click", () => playAudio(button.dataset.act));
  });
  audioToggle?.addEventListener("click", () => playAudio("nova"));

  window.addEventListener("hashchange", () => {
    if (current?.dataset.demo !== "pulse" && activeAct) stopAudio("Sound preview stopped when you left this concept.");
    const dialog = document.querySelector("[data-watch-dialog]");
    if (current?.dataset.demo !== "stream" && dialog?.open) dialog.close();
  });

  const quantity = document.querySelector("[data-qty-out]");
  const quantityButtons = [...document.querySelectorAll("[data-qty]")];
  let places = 1;
  const updatePlaces = () => {
    if (quantity) quantity.value = String(places);
    quantityButtons.forEach((button) => {
      button.disabled = button.dataset.qty === "-1" && places === 1;
    });
  };
  quantityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      places = Math.max(1, places + Number(button.dataset.qty));
      updatePlaces();
    });
  });
  updatePlaces();

  const reserveButton = document.querySelector("[data-reserve-demo]");
  const ticketStatus = document.querySelector("[data-ticket-status]");
  reserveButton?.addEventListener("click", () => {
    const ticketType = document.querySelector('input[name="pulse-ticket"]:checked')?.value || "selected";
    if (ticketStatus) {
      ticketStatus.textContent = `Demo only: ${places} ${ticketType} place${places === 1 ? "" : "s"} selected. Nothing has been reserved.`;
    }
  });

  const companyTabs = [...document.querySelectorAll("[data-company-tab]")];
  const selectCompanyTab = (selectedTab) => {
    companyTabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });
  };
  companyTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectCompanyTab(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % companyTabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + companyTabs.length) % companyTabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = companyTabs.length - 1;
      else return;
      event.preventDefault();
      companyTabs[nextIndex].focus();
      selectCompanyTab(companyTabs[nextIndex]);
    });
  });

  const streamFilters = [...document.querySelectorAll("[data-stream-filter]")];
  const streamCards = [...document.querySelectorAll("[data-stream-card]")];
  streamFilters.forEach((filter) => {
    filter.addEventListener("click", () => {
      const category = filter.dataset.streamFilter;
      streamFilters.forEach((button) => {
        button.setAttribute("aria-pressed", String(button === filter));
      });
      streamCards.forEach((card) => {
        card.hidden = category !== "all" && card.dataset.genre !== category;
      });
    });
  });

  const watchDialog = document.querySelector("[data-watch-dialog]");
  const dialogTitle = document.querySelector("[data-dialog-title]");
  const dialogKind = document.querySelector("[data-dialog-kind]");
  const dialogDescription = document.querySelector("[data-dialog-description]");
  document.querySelectorAll("[data-watch-open]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!watchDialog || !dialogTitle || !dialogKind || !dialogDescription) return;
      dialogTitle.textContent = button.dataset.title || "Untitled concept";
      dialogKind.textContent = button.dataset.kind || "Fictional title";
      dialogDescription.textContent = button.dataset.description || "";
      if (typeof watchDialog.showModal === "function") watchDialog.showModal();
    });
  });
})();
