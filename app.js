(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = {
    state: "paidian.state.v1",
    settings: "paidian.settings.v1",
    presets: "paidian.presets.v1",
    stats: "paidian.stats.v1"
  };

  const VIEW_TITLES = {
    metronome: "节拍器",
    poly: "复节奏",
    rhythm: "节奏型",
    tuner: "调音器",
    stats: "练习记录"
  };

  const SOUND_NAMES = {
    wood: "木鱼",
    electronic: "电子",
    drum: "鼓点",
    cowbell: "牛铃"
  };

  const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const DAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

  const defaultState = {
    bpm: 96,
    beats: 4,
    subdivision: 2,
    sound: "wood",
    accents: [2, 1, 1, 1],
    volume: 0.72,
    flash: true,
    vibrate: false,
    swing: 0,
    muteBar: false,
    ramp: false,
    rampStart: 96,
    rampTarget: 120,
    rampBars: 4,
    polyRatio: "3:2",
    voiceA: true,
    voiceB: true,
    voiceAVolume: 0.82,
    voiceBVolume: 0.62,
    rhythmPattern: [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 1, 0, 0],
    rhythmMute: false,
    rhythmVolume: 0.76
  };

  const defaultSettings = {
    goal: 45,
    wakeLock: true,
    restore: true
  };

  const defaultPresets = [
    {
      id: "morning-scale",
      name: "晨间音阶",
      description: "木鱼 · 八分音符",
      bpm: 88,
      beats: 4,
      subdivision: 2,
      sound: "wood",
      accents: [2, 1, 1, 1],
      favorite: true
    },
    {
      id: "long-tone",
      name: "长音呼吸",
      description: "电子 · 四分音符",
      bpm: 60,
      beats: 4,
      subdivision: 1,
      sound: "electronic",
      accents: [2, 1, 1, 1],
      favorite: false
    },
    {
      id: "articulation",
      name: "快速吐音",
      description: "鼓点 · 十六分音符",
      bpm: 132,
      beats: 4,
      subdivision: 4,
      sound: "drum",
      accents: [2, 1, 2, 1],
      favorite: false
    },
    {
      id: "odd-time",
      name: "三拍律动",
      description: "牛铃 · 三拍子",
      bpm: 108,
      beats: 3,
      subdivision: 2,
      sound: "cowbell",
      accents: [2, 1, 1],
      favorite: false
    }
  ];

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private browsing; the app remains usable.
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfWeek(date = new Date()) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    const day = copy.getDay();
    const distance = day === 0 ? 6 : day - 1;
    copy.setDate(copy.getDate() - distance);
    return copy;
  }

  function addDays(date, amount) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function formatShortDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatTimer(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function seedStats() {
    const days = {};
    const today = new Date();
    const todayValues = [27, 38, 22, 51, 44, 18, 36];
    const sessions = [
      { label: "晨间音阶", bpm: 88, minutes: 14 },
      { label: "速度阶梯", bpm: 104, minutes: 9 },
      { label: "节奏型练习", bpm: 96, minutes: 4 }
    ];

    DAY_SHORT.forEach((_, index) => {
      const date = addDays(today, -index);
      const minutes = todayValues[index];
      days[dateKey(date)] = {
        minutes,
        sessions: index < 3 ? [{
          id: `seed-${index}`,
          date: date.toISOString(),
          label: sessions[index].label,
          bpm: sessions[index].bpm,
          minutes: sessions[index].minutes
        }] : []
      };
    });

    const lastSeven = Array.from({ length: 7 }, (_, index) => todayValues[index]).reduce((sum, value) => sum + value, 0);
    const previous = 205;
    return { days, previousWeekMinutes: previous, seeded: true, lastSeven };
  }

  function noteFromFrequency(frequency, reference) {
    const midi = 69 + 12 * Math.log2(frequency / reference);
    const rounded = Math.round(midi);
    const cents = Math.round((midi - rounded) * 100);
    return {
      name: NOTE_NAMES[((rounded % 12) + 12) % 12],
      octave: Math.floor(rounded / 12) - 1,
      cents,
      frequency
    };
  }

  class AudioEngine {
    constructor(app) {
      this.app = app;
      this.context = null;
      this.master = null;
      this.recordingDestination = null;
      this.noiseBuffer = null;
    }

    async ensure() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("当前浏览器不支持 Web Audio");
        try {
          this.context = new AudioContextClass({ latencyHint: "interactive" });
        } catch {
          this.context = new AudioContextClass();
        }
        this.master = this.context.createGain();
        this.master.gain.value = this.app.state.volume;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.14;
        this.recordingDestination = this.context.createMediaStreamDestination();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
        compressor.connect(this.recordingDestination);
        this.noiseBuffer = this.createNoiseBuffer();
      }

      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      // Playing an empty buffer inside a touch handler unlocks Web Audio on iOS.
      const unlock = this.context.createBuffer(1, 1, this.context.sampleRate);
      const source = this.context.createBufferSource();
      source.buffer = unlock;
      source.connect(this.context.destination);
      source.start();
      return this.context;
    }

    createNoiseBuffer() {
      const length = this.context.sampleRate * 0.22;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    setVolume(value) {
      if (!this.master || !this.context) return;
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.015);
    }

    envelope(time, peak, duration) {
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      return gain;
    }

    playClick(time, options = {}) {
      if (!this.context) return;
      const {
        sound = "wood",
        accent = false,
        level = 1,
        voice = "high"
      } = options;
      const destination = this.master;
      if (!destination) return;
      const volume = clamp(level, 0, 1.4);

      if (sound === "wood") {
        const osc = this.context.createOscillator();
        const gain = this.envelope(time, 0.32 * volume, accent ? 0.085 : 0.06);
        const filter = this.context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = accent ? 1180 : 900;
        filter.Q.value = 1.6;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(accent ? 1280 : 980, time);
        osc.frequency.exponentialRampToValueAtTime(accent ? 720 : 520, time + 0.05);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + 0.1);
        return;
      }

      if (sound === "electronic") {
        const osc = this.context.createOscillator();
        const gain = this.envelope(time, 0.2 * volume, accent ? 0.075 : 0.045);
        osc.type = "square";
        osc.frequency.setValueAtTime(accent ? 1760 : 1320, time);
        osc.frequency.exponentialRampToValueAtTime(accent ? 880 : 720, time + 0.035);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + 0.08);
        return;
      }

      if (sound === "drum") {
        const osc = this.context.createOscillator();
        const gain = this.envelope(time, 0.58 * volume, accent ? 0.19 : 0.14);
        osc.type = "sine";
        osc.frequency.setValueAtTime(voice === "low" ? 115 : 185, time);
        osc.frequency.exponentialRampToValueAtTime(voice === "low" ? 44 : 62, time + 0.13);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + 0.21);

        const noise = this.context.createBufferSource();
        const noiseGain = this.envelope(time, 0.08 * volume, 0.035);
        const noiseFilter = this.context.createBiquadFilter();
        noiseFilter.type = "highpass";
        noiseFilter.frequency.value = 1400;
        noise.buffer = this.noiseBuffer;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(destination);
        noise.start(time);
        return;
      }

      const oscA = this.context.createOscillator();
      const oscB = this.context.createOscillator();
      const gain = this.envelope(time, 0.15 * volume, accent ? 0.105 : 0.07);
      const filter = this.context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = accent ? 1120 : 840;
      filter.Q.value = 1.1;
      oscA.type = "square";
      oscB.type = "square";
      oscA.frequency.value = voice === "low" ? 410 : 590;
      oscB.frequency.value = voice === "low" ? 615 : 835;
      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      oscA.start(time);
      oscB.start(time);
      oscA.stop(time + 0.12);
      oscB.stop(time + 0.12);
    }
  }

  class PracticeApp {
    constructor() {
      this.storedSettings = loadJSON(STORAGE.settings, defaultSettings);
      this.settings = { ...defaultSettings, ...this.storedSettings };
      const storedState = loadJSON(STORAGE.state, defaultState);
      this.state = {
        ...defaultState,
        ...(this.settings.restore && storedState ? storedState : {})
      };
      this.presets = loadJSON(STORAGE.presets, defaultPresets);
      this.stats = loadJSON(STORAGE.stats, seedStats());
      this.engine = new AudioEngine(this);
      this.currentView = "metronome";
      this.mode = null;
      this.audioStep = 0;
      this.rhythmStep = 0;
      this.nextAudioTime = 0;
      this.schedulerTimer = null;
      this.visualTimers = new Set();
      this.tapTimes = [];
      this.tapResetTimer = null;
      this.practiceStartedAt = null;
      this.practiceTimer = null;
      this.lastSessionElapsed = 0;
      this.wakeLock = null;
      this.installPrompt = null;
      this.mediaRecorder = null;
      this.recordingChunks = [];
      this.recordingUrl = null;
      this.micStream = null;
      this.analyser = null;
      this.pitchFrame = null;
      this.referencePitch = 440;
      this.polyNextBar = 0;
      this.polyBarIndex = 0;
      this.rhythmLoop = 0;
      this.isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }

    init() {
      this.cacheElements();
      this.renderPresets();
      this.renderBeatPattern();
      this.renderBeatDots();
      this.renderSequencer();
      this.renderPolyRings();
      this.syncStateUI();
      this.renderStats();
      this.bindNavigation();
      this.bindTransport();
      this.bindTempo();
      this.bindPatternControls();
      this.bindPresets();
      this.bindPolyrhythm();
      this.bindSequencer();
      this.bindTuner();
      this.bindPractice();
      this.bindSettings();
      this.bindInstall();
      this.bindRecording();
      this.bindDialogs();
      this.bindKeyboard();
      this.bindLifecycle();
      this.applyQueryState();
      this.updateTodayMinutes();
      this.setupIosAudioUnlock();
      this.setupMediaSession();
      this.registerServiceWorker();
      document.documentElement.classList.toggle("is-standalone", this.isStandalone);
    }

    cacheElements() {
      this.elements = {
        transport: $(".transport"),
        statusText: $("#transport-status-text"),
        bpmValue: $("#bpm-value"),
        bpmRange: $("#bpm-range"),
        tempoName: $("#tempo-name"),
        beatNumber: $("#beat-number"),
        beatTotal: $("#beat-total"),
        beatDots: $("#beat-dots"),
        beatPattern: $("#beat-pattern"),
        pulseOrbit: $("#pulse-orbit"),
        signatureSummary: $("#signature-summary"),
        subdivisionSummary: $("#subdivision-summary"),
        metronomeToggle: $("#metronome-toggle"),
        volumeRange: $("#volume-range"),
        sessionTime: $("#session-time"),
        sessionState: $("#session-state"),
        sessionRing: $("#session-ring"),
        goalMinutes: $("#goal-minutes"),
        todayMinutes: $("#today-minutes"),
        planStart: $("#plan-start"),
        planTarget: $("#plan-target"),
        planProgress: $("#plan-progress-bar"),
        planStatus: $("#ramp-status"),
        tempoReadout: $("#rhythm-bpm"),
        polyBpm: $("#poly-bpm"),
        presetGrid: $("#preset-grid"),
        presetDialog: $("#preset-dialog"),
        deletePresetDialog: $("#delete-preset-dialog"),
        settingsDialog: $("#settings-dialog"),
        installDialog: $("#install-dialog"),
        toastRegion: $("#toast-region"),
        recordingStrip: $("#recording-strip"),
        recordAudio: $("#recording-audio"),
        downloadRecording: $("#download-recording"),
        tunerNote: $("#tuner-note"),
        tunerOctave: $("#tuner-octave"),
        tunerFrequency: $("#tuner-frequency"),
        tunerNeedle: $("#tuner-needle"),
        centsReadout: $("#cents-readout")
      };
    }

    persistState() {
      saveJSON(STORAGE.state, this.state);
    }

    setState(updates, options = {}) {
      Object.assign(this.state, updates);
      this.persistState();
      this.syncStateUI();
      if (options.renderPattern) this.renderBeatPattern();
      if (options.renderDots) this.renderBeatDots();
      if (options.renderStats) this.renderStats();
    }

    syncStateUI() {
      const { bpm, beats, subdivision, sound, accents, volume, flash, vibrate, swing, ramp, rampStart, rampTarget, polyRatio } = this.state;
      if (this.elements) {
        this.elements.bpmValue.textContent = String(bpm);
        this.elements.bpmRange.value = String(bpm);
        this.elements.tempoName.textContent = this.tempoName(bpm);
        this.elements.beatTotal.textContent = `/ ${beats}`;
        this.elements.signatureSummary.textContent = beats === 6 ? "6 / 8" : `${beats} / 4`;
        this.elements.subdivisionSummary.textContent = this.subdivisionName(subdivision);
        this.elements.volumeRange.value = String(Math.round(volume * 100));
        this.elements.planStart.textContent = String(ramp ? rampStart : bpm);
        this.elements.planTarget.textContent = String(rampTarget);
        this.elements.planProgress.style.width = ramp ? `${clamp(((bpm - rampStart) / Math.max(1, rampTarget - rampStart)) * 100, 0, 100)}%` : "0%";
        this.elements.planStatus.textContent = ramp ? "进行中" : "关闭";
        this.elements.planStatus.classList.toggle("is-active", ramp);
        this.elements.tempoReadout.textContent = String(bpm);
        this.elements.polyBpm.textContent = String(bpm);
        $("#ramp-toggle").checked = ramp;
        $("#mute-bar-toggle").checked = this.state.muteBar;
        $("#flash-toggle").classList.toggle("is-on", flash);
        $("#flash-toggle").setAttribute("aria-pressed", String(flash));
        $("#vibrate-toggle").classList.toggle("is-on", vibrate);
        $("#vibrate-toggle").setAttribute("aria-pressed", String(vibrate));
        $("#swing-range").value = String(swing);
        $("#swing-value").textContent = `${swing}%`;
        $("#sound-quick-name").textContent = SOUND_NAMES[sound] || "木鱼";
        $("#poly-ratio-label").textContent = polyRatio;
        $("#ratio-a").textContent = `${polyRatio.split(":")[0]} 连音`;
        $("#ratio-b").textContent = `${polyRatio.split(":")[1]} 连音`;
        $("#voice-a-toggle").checked = this.state.voiceA;
        $("#voice-b-toggle").checked = this.state.voiceB;
        $("#voice-a-volume").value = String(Math.round(this.state.voiceAVolume * 100));
        $("#voice-b-volume").value = String(Math.round(this.state.voiceBVolume * 100));
        $("#voice-a-value").textContent = String(Math.round(this.state.voiceAVolume * 100));
        $("#voice-b-value").textContent = String(Math.round(this.state.voiceBVolume * 100));
        $("#rhythm-volume").value = String(Math.round(this.state.rhythmVolume * 100));
        $("#rhythm-mute-toggle").checked = this.state.rhythmMute;
        $$("#time-signature button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.beats) === beats));
        $$("#subdivision-control button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.subdivision) === subdivision));
        $$("#sound-options .sound-option").forEach((button) => button.classList.toggle("is-active", button.dataset.sound === sound));
        $$("#poly-ratio button").forEach((button) => button.classList.toggle("is-active", button.dataset.ratio === polyRatio));
        $("#mute-button").innerHTML = `<svg class="icon"><use href="#${volume === 0 ? "i-volume-off" : "i-volume"}"/></svg>`;
      }
      this.engine.setVolume(volume);
    }

    tempoName(bpm) {
      if (bpm < 40) return "极慢";
      if (bpm < 60) return "慢板";
      if (bpm < 76) return "行板";
      if (bpm < 108) return "中板";
      if (bpm < 120) return "小快板";
      if (bpm < 168) return "快板";
      if (bpm < 200) return "急板";
      return "极急";
    }

    subdivisionName(value) {
      return { 1: "四分音符", 2: "八分音符", 3: "三连音", 4: "十六分音符" }[value] || "八分音符";
    }

    setupIosAudioUnlock() {
      const unlock = () => {
        this.engine.ensure().catch(() => {});
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("touchstart", unlock);
      };
      document.addEventListener("pointerdown", unlock, { passive: true, once: true });
      document.addEventListener("touchstart", unlock, { passive: true, once: true });
    }

    setupMediaSession() {
      if (!("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "拍点练习",
          artist: "Tempo Practice",
          album: `${this.state.bpm} BPM`,
          artwork: [
            { src: "./icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png" }
          ]
        });
        navigator.mediaSession.setActionHandler("play", () => {
          if (!this.isPlaying) this.startTransport(this.currentView);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          if (this.isPlaying) this.stopTransport({ record: true });
        });
        navigator.mediaSession.setActionHandler("stop", () => {
          if (this.isPlaying) this.stopTransport({ record: true });
        });
        navigator.mediaSession.setActionHandler("previoustrack", () => this.setBpm(this.state.bpm - 5));
        navigator.mediaSession.setActionHandler("nexttrack", () => this.setBpm(this.state.bpm + 5));
      } catch {
        // Media Session is optional; Bluetooth audio output still works automatically.
      }
    }

    bindNavigation() {
      $$(".nav-item").forEach((button) => {
        button.addEventListener("click", () => this.switchView(button.dataset.view));
      });
      $$("[data-goto]").forEach((button) => {
        button.addEventListener("click", () => this.switchView(button.dataset.goto));
      });
    }

    switchView(view) {
      if (!VIEW_TITLES[view]) return;
      const isDifferentTransport = this.mode && this.mode !== view;
      if (isDifferentTransport || view === "tuner" || view === "stats") {
        if (this.isPlaying) this.stopTransport({ record: true });
      }
      this.currentView = view;
      $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
      $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
      $("#page-title").textContent = VIEW_TITLES[view];
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      history.replaceState({}, "", url);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (view === "stats") this.renderStats();
    }

    toggleTransport(mode = this.currentView) {
      if (this.isPlaying) {
        this.stopTransport({ record: true });
      } else {
        const selected = ["poly", "rhythm"].includes(mode) ? mode : "metronome";
        this.startTransport(selected);
      }
    }

    async startTransport(mode) {
      try {
        await this.engine.ensure();
      } catch (error) {
        this.toast(error.message || "无法启动音频，请重试");
        return;
      }
      if (this.micStream) this.stopMicrophone();
      this.mode = mode;
      this.isPlaying = true;
      this.audioStep = 0;
      this.rhythmStep = 0;
      this.rhythmLoop = 0;
      this.polyNextBar = 0;
      this.polyBarIndex = 0;
      this.visualTimers.forEach((timer) => clearTimeout(timer));
      this.visualTimers.clear();
      this.nextAudioTime = this.engine.context.currentTime + 0.09;
      this.startPracticeClock();
      this.requestWakeLock();
      this.updatePlayingUI();
      this.schedulerTimer = window.setInterval(() => this.schedule(), 25);
      this.schedule();
    }

    stopTransport({ record = true } = {}) {
      if (!this.isPlaying && !this.practiceStartedAt) return;
      const elapsed = this.practiceStartedAt ? (Date.now() - this.practiceStartedAt) / 1000 : 0;
      const completedMode = this.mode;
      this.lastSessionElapsed = elapsed;
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      this.visualTimers.forEach((timer) => clearTimeout(timer));
      this.visualTimers.clear();
      this.isPlaying = false;
      this.mode = null;
      this.stopPracticeClock();
      this.releaseWakeLock();
      this.updatePlayingUI();
      this.clearPulse();
      if (record && elapsed >= 8) this.finalizePractice(elapsed, completedMode);
    }

    schedule() {
      if (!this.isPlaying || !this.engine.context) return;
      if (this.mode === "poly") {
        this.schedulePolyrhythm();
      } else if (this.mode === "rhythm") {
        this.scheduleRhythm();
      } else {
        this.scheduleMetronome();
      }
    }

    scheduleMetronome() {
      const context = this.engine.context;
      const lookAhead = 0.12;
      while (this.nextAudioTime < context.currentTime + lookAhead) {
        const step = this.audioStep;
        const subdivision = this.state.subdivision;
        const stepsPerBar = subdivision * this.state.beats;
        const bar = Math.floor(step / stepsPerBar);

        if (step > 0 && step % (stepsPerBar * this.state.rampBars) === 0 && this.state.ramp && this.state.bpm < this.state.rampTarget) {
          this.state.bpm = Math.min(this.state.rampTarget, this.state.bpm + 2);
          this.syncStateUI();
          this.persistState();
        }

        const baseInterval = 60 / this.state.bpm / subdivision;
        let interval = baseInterval;
        if (subdivision === 2 && this.state.swing > 0) {
          const ratio = 1 + (this.state.swing / 100) * 0.7;
          interval = step % 2 === 0 ? baseInterval * ratio : baseInterval * (2 - ratio);
        }

        const beat = Math.floor(step / subdivision) % this.state.beats;
        const subIndex = step % subdivision;
        let accentValue = this.state.accents[beat] ?? 1;
        if (subIndex > 0) accentValue = accentValue === 0 ? 0 : Math.max(0.35, accentValue * 0.7);
        const mutedBar = this.state.muteBar && bar % 2 === 1;
        if (accentValue > 0 && !mutedBar) {
          this.engine.playClick(this.nextAudioTime, {
            sound: this.state.sound,
            accent: accentValue === 2 && subIndex === 0,
            level: accentValue === 2 ? 1 : accentValue * 0.8
          });
        }
        this.visualAt(this.nextAudioTime, () => this.flashPulse(beat, subIndex, accentValue === 2 && subIndex === 0));
        this.nextAudioTime += interval;
        this.audioStep += 1;
      }
    }

    schedulePolyrhythm() {
      const context = this.engine.context;
      const lookAhead = 0.18;
      const [countA, countB] = this.state.polyRatio.split(":").map(Number);
      const barDuration = (60 / this.state.bpm) * 4;
      if (!this.polyNextBar) this.polyNextBar = context.currentTime + 0.08;

      while (this.polyNextBar < context.currentTime + lookAhead) {
        const barStart = this.polyNextBar;
        if (this.state.voiceA) {
          for (let index = 0; index < countA; index += 1) {
            const when = barStart + (barDuration / countA) * index;
            this.engine.playClick(when, {
              sound: "electronic",
              accent: index === 0,
              level: this.state.voiceAVolume * (index === 0 ? 0.75 : 0.6),
              voice: "high"
            });
            this.visualAt(when, () => this.hitPolyDot("ring-a", index));
          }
        }
        if (this.state.voiceB) {
          for (let index = 0; index < countB; index += 1) {
            const when = barStart + (barDuration / countB) * index;
            this.engine.playClick(when, {
              sound: "drum",
              accent: index === 0,
              level: this.state.voiceBVolume * (index === 0 ? 1 : 0.8),
              voice: "low"
            });
            this.visualAt(when, () => this.hitPolyDot("ring-b", index));
          }
        }
        this.polyBarIndex += 1;
        this.polyNextBar += barDuration;
      }
    }

    scheduleRhythm() {
      const context = this.engine.context;
      const lookAhead = 0.12;
      if (!this.nextAudioTime) this.nextAudioTime = context.currentTime + 0.08;
      while (this.nextAudioTime < context.currentTime + lookAhead) {
        const step = this.rhythmStep % 16;
        const loop = Math.floor(this.rhythmStep / 16);
        if (step === 0) this.rhythmLoop = loop;
        const level = this.state.rhythmPattern[step];
        const mutedBar = this.state.rhythmMute && loop % 2 === 1;
        if (level > 0 && !mutedBar) {
          this.engine.playClick(this.nextAudioTime, {
            sound: "drum",
            accent: level === 2,
            level: this.state.rhythmVolume * (level === 2 ? 1 : 0.68)
          });
        }
        const currentStep = step;
        this.visualAt(this.nextAudioTime, () => this.flashSequenceStep(currentStep));
        let interval = 60 / this.state.bpm / 4;
        if (this.state.swing > 0) {
          const ratio = 1 + (this.state.swing / 100) * 0.7;
          interval = step % 2 === 0 ? interval * ratio : interval * (2 - ratio);
        }
        this.nextAudioTime += interval;
        this.rhythmStep += 1;
      }
    }

    visualAt(when, callback) {
      if (!this.engine.context) return;
      const delay = Math.max(0, (when - this.engine.context.currentTime) * 1000);
      const timer = window.setTimeout(() => {
        this.visualTimers.delete(timer);
        if (this.isPlaying) callback();
      }, delay);
      this.visualTimers.add(timer);
    }

    flashPulse(beat, subdivisionIndex, isAccent) {
      const orbit = this.elements.pulseOrbit;
      orbit.classList.remove("is-pulsing", "is-accent", "is-subtle");
      // Force a fresh animation when very fast tempos produce close ticks.
      void orbit.offsetWidth;
      orbit.classList.add(subdivisionIndex > 0 ? "is-subtle" : "is-pulsing");
      if (isAccent) orbit.classList.add("is-accent");
      this.elements.beatNumber.textContent = String(beat + 1);
      $$(".beat-dot", this.elements.beatDots).forEach((dot, index) => dot.classList.toggle("is-current", index === beat));
      $$(".beat-cell", this.elements.beatPattern).forEach((cell, index) => cell.classList.toggle("is-current", index === beat));
      if (isAccent && this.state.vibrate) this.vibrate(18);
      window.clearTimeout(this.pulseClearTimer);
      this.pulseClearTimer = window.setTimeout(() => this.clearPulse(), 88);
    }

    clearPulse() {
      if (!this.elements) return;
      this.elements.pulseOrbit?.classList.remove("is-pulsing", "is-accent", "is-subtle");
      $$(".beat-cell", this.elements.beatPattern).forEach((cell) => cell.classList.remove("is-current"));
    }

    updatePlayingUI() {
      const buttons = [$("#metronome-toggle"), ...$$("[data-transport-toggle]")];
      buttons.forEach((button) => {
        if (!button) return;
        const use = $("use", button);
        const text = $("span", button);
        if (use) use.setAttribute("href", this.isPlaying ? "#i-pause" : "#i-play");
        if (text) text.textContent = this.isPlaying ? "停止" : "开始";
        button.setAttribute("aria-label", this.isPlaying ? "停止" : "开始");
      });
      this.elements.transport.classList.toggle("is-playing", this.isPlaying);
      this.elements.statusText.textContent = this.isPlaying
        ? `${this.mode === "poly" ? "复节奏" : this.mode === "rhythm" ? "节奏型" : "节拍器"}进行中`
        : "准备就绪";
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = this.isPlaying ? "playing" : "paused";
        if (navigator.mediaSession.metadata) {
          navigator.mediaSession.metadata.album = `${this.state.bpm} BPM`;
          navigator.mediaSession.metadata.title = this.mode === "poly" ? "复节奏练习" : this.mode === "rhythm" ? "节奏型练习" : "拍点练习";
        }
      }
      $("#poly-live-badge").textContent = this.isPlaying && this.mode === "poly" ? "播放中" : "待机";
      $("#poly-live-badge").classList.toggle("is-live", this.isPlaying && this.mode === "poly");
      $$(".channel-wave").forEach((wave, index) => {
        wave.classList.toggle("is-active", this.isPlaying && this.mode === "poly" && (index === 0 ? this.state.voiceA : this.state.voiceB));
      });
    }

    vibrate(duration) {
      if ("vibrate" in navigator) {
        try { navigator.vibrate(duration); } catch { /* iOS ignores haptics from web apps. */ }
      }
    }

    bindTransport() {
      $("#metronome-toggle").addEventListener("click", () => this.toggleTransport("metronome"));
      $$("[data-transport-toggle]").forEach((button) => {
        button.addEventListener("click", () => this.toggleTransport(this.currentView));
      });
      $("#tap-tempo").addEventListener("click", () => this.tapTempo($("#tap-tempo")));
      $("#poly-tap").addEventListener("click", () => this.tapTempo($("#poly-tap")));
      $("#flash-toggle").addEventListener("click", () => this.setState({ flash: !this.state.flash }));
      $("#vibrate-toggle").addEventListener("click", () => {
        if (!("vibrate" in navigator)) {
          this.toast("iPhone 上暂不支持网页震动，闪灯仍可使用");
          return;
        }
        this.setState({ vibrate: !this.state.vibrate });
      });
      $("#sound-quick-button").addEventListener("click", () => this.cycleSound());
      $("#mute-button").addEventListener("click", () => {
        if (this.state.volume > 0) {
          this.previousVolume = this.state.volume;
          this.setState({ volume: 0 });
        } else {
          this.setState({ volume: this.previousVolume || 0.72 });
        }
      });
      this.elements.volumeRange.addEventListener("input", (event) => {
        const volume = Number(event.target.value) / 100;
        this.setState({ volume });
      });
    }

    cycleSound() {
      const sounds = Object.keys(SOUND_NAMES);
      const next = sounds[(sounds.indexOf(this.state.sound) + 1) % sounds.length];
      this.setState({ sound: next });
      this.toast(`音色已切换为${SOUND_NAMES[next]}`);
    }

    bindTempo() {
      $("#bpm-down").addEventListener("click", () => this.setBpm(this.state.bpm - 1));
      $("#bpm-up").addEventListener("click", () => this.setBpm(this.state.bpm + 1));
      this.elements.bpmRange.addEventListener("input", (event) => this.setBpm(Number(event.target.value), false));
      let holdTimer = null;
      let holdInterval = null;
      const stopHold = () => {
        clearTimeout(holdTimer);
        clearInterval(holdInterval);
      };
      [["#bpm-down", -1], ["#bpm-up", 1]].forEach(([selector, direction]) => {
        const button = $(selector);
        button.addEventListener("pointerdown", () => {
          holdTimer = window.setTimeout(() => {
            holdInterval = window.setInterval(() => this.setBpm(this.state.bpm + direction), 70);
          }, 450);
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach((event) => button.addEventListener(event, stopHold));
      });
      $("#swing-range").addEventListener("input", (event) => {
        this.setState({ swing: Number(event.target.value) });
      });
    }

    setBpm(value, announce = true) {
      const bpm = clamp(Math.round(Number(value) || defaultState.bpm), 20, 300);
      if (bpm === this.state.bpm) return;
      this.setState({ bpm });
      if (this.state.ramp) {
        this.elements.planStart.dataset.initialBpm ||= String(bpm);
      }
      if (announce && bpm % 10 === 0) this.toast(`${bpm} BPM · ${this.tempoName(bpm)}`);
    }

    tapTempo(button) {
      const now = performance.now();
      this.engine.ensure().then(() => {
        this.engine.playClick(this.engine.context.currentTime, {
          sound: this.state.sound,
          accent: true,
          level: 0.8
        });
      }).catch(() => {});
      this.tapTimes = this.tapTimes.filter((time) => now - time < 2300);
      this.tapTimes.push(now);
      button.classList.add("is-tapped");
      window.clearTimeout(this.tapResetTimer);
      this.tapResetTimer = window.setTimeout(() => {
        this.tapTimes = [];
        button.classList.remove("is-tapped");
      }, 2300);

      if (this.tapTimes.length >= 2) {
        const intervals = this.tapTimes.slice(1).map((time, index) => time - this.tapTimes[index]);
        intervals.sort((a, b) => a - b);
        const median = intervals[Math.floor(intervals.length / 2)];
        this.setBpm(60000 / median, false);
      }
    }

    bindPatternControls() {
      $$("#time-signature button").forEach((button) => {
        button.addEventListener("click", () => {
          const beats = Number(button.dataset.beats);
          const accents = beats === 6 ? [2, 1, 1, 2, 1, 1] : Array.from({ length: beats }, (_, index) => index === 0 ? 2 : 1);
          this.setState({ beats, accents }, { renderPattern: true, renderDots: true });
          this.elements.beatTotal.textContent = `/ ${beats}`;
        });
      });
      $$("#subdivision-control button").forEach((button) => {
        button.addEventListener("click", () => {
          this.setState({ subdivision: Number(button.dataset.subdivision) });
        });
      });
      $$("#sound-options .sound-option").forEach((button) => {
        button.addEventListener("click", () => {
          this.setState({ sound: button.dataset.sound });
          this.engine.ensure().then(() => {
            this.engine.playClick(this.engine.context.currentTime, {
              sound: button.dataset.sound,
              accent: true
            });
          }).catch(() => {});
        });
      });
    }

    renderBeatPattern() {
      if (!this.elements?.beatPattern) return;
      const notes = ["", "普通", "重音"];
      this.elements.beatPattern.style.setProperty("--beats", this.state.beats);
      this.elements.beatPattern.innerHTML = this.state.accents.map((accent, index) => `
        <button class="beat-cell" data-accent="${accent}" data-beat="${index}" aria-label="第 ${index + 1} 拍，${accent === 0 ? "静音" : notes[accent]}">
          <span class="beat-cell-index">${index + 1}</span>
          <span class="beat-cell-label">
            <strong>${index === 0 ? "主拍" : index === 3 ? "回拍" : `第 ${index + 1} 拍`}</strong>
            <small>${accent === 0 ? "静音" : notes[accent]}</small>
          </span>
          <span class="beat-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        </button>
      `).join("");
      $$(".beat-cell", this.elements.beatPattern).forEach((button) => {
        button.addEventListener("click", () => {
          const beat = Number(button.dataset.beat);
          const accents = [...this.state.accents];
          accents[beat] = accents[beat] === 2 ? 1 : accents[beat] === 1 ? 0 : 2;
          this.setState({ accents }, { renderPattern: true });
        });
      });
    }

    renderBeatDots() {
      if (!this.elements?.beatDots) return;
      const count = this.state.beats;
      this.elements.beatDots.innerHTML = this.state.accents.map((accent, index) => {
        const angle = index * (360 / count);
        return `<span class="beat-dot ${accent === 2 ? "is-accent" : ""}" style="--angle:${angle}deg"></span>`;
      }).join("");
      this.elements.beatNumber.textContent = "1";
      this.elements.beatTotal.textContent = `/ ${count}`;
    }

    bindPolyrhythm() {
      $$("#poly-ratio button").forEach((button) => {
        button.addEventListener("click", () => {
          const wasPlaying = this.isPlaying;
          if (wasPlaying) this.stopTransport({ record: false });
          this.setState({ polyRatio: button.dataset.ratio });
          this.renderPolyRings();
          if (wasPlaying) this.startTransport("poly");
        });
      });
      $("#voice-a-toggle").addEventListener("change", (event) => this.setState({ voiceA: event.target.checked }));
      $("#voice-b-toggle").addEventListener("change", (event) => this.setState({ voiceB: event.target.checked }));
      $("#voice-a-volume").addEventListener("input", (event) => this.setState({ voiceAVolume: Number(event.target.value) / 100 }));
      $("#voice-b-volume").addEventListener("input", (event) => this.setState({ voiceBVolume: Number(event.target.value) / 100 }));
    }

    renderPolyRings() {
      const [countA, countB] = this.state.polyRatio.split(":").map(Number);
      const render = (element, count) => {
        if (!element) return;
        element.style.setProperty("--count", count);
        element.innerHTML = Array.from({ length: count }, (_, index) => `<span style="--i:${index}"></span>`).join("");
      };
      render($("#ring-a"), countA);
      render($("#ring-b"), countB);
    }

    hitPolyDot(ringId, index) {
      const dots = $$(`#${ringId} span`);
      dots.forEach((dot, dotIndex) => dot.classList.toggle("is-hit", dotIndex === index));
      window.clearTimeout(this[`${ringId}Timer`]);
      this[`${ringId}Timer`] = window.setTimeout(() => dots.forEach((dot) => dot.classList.remove("is-hit")), 115);
    }

    bindSequencer() {
      $("#clear-rhythm").addEventListener("click", () => {
        this.state.rhythmPattern = Array(16).fill(0);
        this.persistState();
        this.renderSequencer();
      });
      $("#rhythm-preset-a").addEventListener("click", () => {
        this.state.rhythmPattern = [2, 0, 0, 1, 1, 0, 0, 0, 2, 0, 0, 1, 1, 0, 0, 0];
        this.persistState();
        this.renderSequencer();
        this.toast("已载入：前八后十六");
      });
      $("#rhythm-preset-b").addEventListener("click", () => {
        this.state.rhythmPattern = [2, 0, 1, 1, 0, 1, 0, 0, 2, 0, 1, 1, 0, 1, 0, 0];
        this.persistState();
        this.renderSequencer();
        this.toast("已载入：切分练习");
      });
      $("#rhythm-mute-toggle").addEventListener("change", (event) => {
        this.setState({ rhythmMute: event.target.checked });
      });
      $("#rhythm-volume").addEventListener("input", (event) => {
        this.setState({ rhythmVolume: Number(event.target.value) / 100 });
      });
    }

    renderSequencer() {
      const grid = $("#sequencer-grid");
      if (!grid) return;
      const stepNames = ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"];
      const labels = { 0: "休止", 1: "普通", 2: "重音" };
      grid.innerHTML = this.state.rhythmPattern.map((state, index) => `
        <button class="sequence-step ${index % 4 === 0 ? "quarters" : ""}" data-step="${index}" data-state="${state}" aria-label="第 ${index + 1} 格，${labels[state]}">
          <span>${stepNames[index]}</span>
        </button>
      `).join("");
      $$(".sequence-step", grid).forEach((button) => {
        button.addEventListener("click", () => {
          const step = Number(button.dataset.step);
          this.state.rhythmPattern[step] = (this.state.rhythmPattern[step] + 1) % 3;
          this.persistState();
          this.renderSequencer();
          if (this.isPlaying && this.mode === "rhythm") {
            this.engine.ensure().then(() => {
              const level = this.state.rhythmPattern[step];
              if (level > 0) this.engine.playClick(this.engine.context.currentTime, {
                sound: "drum",
                accent: level === 2,
                level: this.state.rhythmVolume
              });
            }).catch(() => {});
          }
        });
      });
      $("#sequencer-index").innerHTML = `<span></span>${stepNames.map((name, index) => `<span>${index + 1}</span>`).join("")}`;
    }

    flashSequenceStep(index) {
      $$(".sequence-step").forEach((step, stepIndex) => step.classList.toggle("is-playing", stepIndex === index));
    }

    bindPractice() {
      $("#ramp-toggle").addEventListener("change", (event) => {
        const ramp = event.target.checked;
        let target = this.state.rampTarget;
        if (target <= this.state.bpm) target = clamp(this.state.bpm + 12, 40, 300);
        this.elements.planStart.dataset.initialBpm = String(this.state.bpm);
        this.setState({ ramp, rampStart: this.state.bpm, rampTarget: target });
        if (ramp) this.toast(`将从 ${this.state.bpm} BPM 逐步练习到 ${target} BPM`);
      });
      this.elements.planTarget.addEventListener("click", () => this.cycleRampTarget());
      $("#mute-bar-toggle").addEventListener("change", (event) => this.setState({ muteBar: event.target.checked }));
      $("#save-session").addEventListener("click", () => {
        if (this.isPlaying) {
          this.stopTransport({ record: true });
          this.toast("本次练习已写入记录");
        } else {
          this.toast("开始演奏后会自动记录练习时间");
        }
      });
      $("#session-settings").addEventListener("click", () => this.showSettings());
    }

    cycleRampTarget() {
      const values = [80, 92, 104, 120, 132, 144, 160, 184];
      const currentIndex = values.findIndex((value) => value >= this.state.rampTarget);
      const next = values[(currentIndex + 1) % values.length];
      this.setState({ rampTarget: next });
      this.toast(`提速目标：${next} BPM`);
    }

    startPracticeClock() {
      if (this.practiceStartedAt) return;
      this.practiceStartedAt = Date.now();
      this.elements.sessionTime.textContent = "00:00";
      this.elements.sessionState.textContent = "练习进行中";
      window.clearInterval(this.practiceTimer);
      this.practiceTimer = window.setInterval(() => {
        if (!this.practiceStartedAt) return;
        const seconds = (Date.now() - this.practiceStartedAt) / 1000;
        this.elements.sessionTime.textContent = formatTimer(seconds);
      }, 500);
    }

    stopPracticeClock() {
      window.clearInterval(this.practiceTimer);
      this.practiceTimer = null;
      this.practiceStartedAt = null;
      this.elements.sessionTime.textContent = formatTimer(this.lastSessionElapsed);
      this.elements.sessionState.textContent = this.lastSessionElapsed >= 8 ? "本次已记录" : "尚未开始";
    }

    finalizePractice(seconds, completedMode = this.mode) {
      const minutes = Math.max(1, Math.round(seconds / 60));
      const key = dateKey();
      const day = this.stats.days[key] || { minutes: 0, sessions: [] };
      day.minutes = Number(day.minutes) + minutes;
      day.sessions = day.sessions || [];
      day.sessions.unshift({
        id: `session-${Date.now()}`,
        date: new Date().toISOString(),
        label: completedMode === "poly" ? "复节奏练习" : completedMode === "rhythm" ? "节奏型练习" : this.state.ramp ? "速度阶梯" : "节拍器练习",
        bpm: this.state.bpm,
        minutes
      });
      day.sessions = day.sessions.slice(0, 12);
      this.stats.days[key] = day;
      saveJSON(STORAGE.stats, this.stats);
      this.updateTodayMinutes();
      this.renderStats();
      this.toast(`已记录 ${minutes} 分钟练习`);
    }

    updateTodayMinutes() {
      const minutes = Math.round(this.stats.days[dateKey()]?.minutes || 0);
      this.elements.todayMinutes.textContent = String(minutes);
      this.elements.goalMinutes.textContent = String(minutes);
      const goal = this.settings.goal;
      const angle = clamp(minutes / goal, 0, 1) * 360;
      this.elements.sessionRing.style.background = `conic-gradient(var(--orange) 0deg, var(--orange) ${angle}deg, var(--line) ${angle}deg)`;
    }

    requestWakeLock() {
      if (!this.settings.wakeLock || !("wakeLock" in navigator) || this.wakeLock) return;
      navigator.wakeLock.request("screen")
        .then((lock) => {
          this.wakeLock = lock;
          lock.addEventListener("release", () => { this.wakeLock = null; });
        })
        .catch(() => {});
    }

    releaseWakeLock() {
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
      }
    }

    bindLifecycle() {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.isPlaying) {
          this.engine.context?.resume().catch(() => {});
          this.requestWakeLock();
        }
      });
      window.addEventListener("pagehide", () => this.persistState());
    }

    showSettings() {
      $("#goal-select").value = String(this.settings.goal);
      $("#wake-lock-toggle").checked = this.settings.wakeLock;
      $("#restore-toggle").checked = this.settings.restore;
      this.elements.settingsDialog.showModal();
    }

    bindSettings() {
      $("#more-button").addEventListener("click", () => this.showSettings());
      $("#settings-dialog").addEventListener("close", () => {
        if ($("#settings-dialog").returnValue !== "save") return;
        this.settings.goal = Number($("#goal-select").value);
        this.settings.wakeLock = $("#wake-lock-toggle").checked;
        this.settings.restore = $("#restore-toggle").checked;
        saveJSON(STORAGE.settings, this.settings);
        this.updateTodayMinutes();
        this.renderStats();
        if (this.isPlaying) this.requestWakeLock();
        this.toast("练习设置已保存");
      });
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        $("#ios-install-note").style.display = "block";
      }
    }

    bindPresets() {
      $("#add-preset").addEventListener("click", () => {
        $("#preset-name").value = `${this.tempoName(this.state.bpm)}练习`;
        $("#preset-summary").innerHTML = `
          <span>速度<b>${this.state.bpm} BPM</b></span>
          <span>拍号<b>${this.state.beats === 6 ? "6 / 8" : `${this.state.beats} / 4`}</b></span>
          <span>音色<b>${SOUND_NAMES[this.state.sound]}</b></span>
        `;
        this.elements.presetDialog.showModal();
        window.setTimeout(() => $("#preset-name").select(), 50);
      });
      $("#preset-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#preset-name").value.trim();
        if (!name) return;
        const preset = {
          id: `preset-${Date.now()}`,
          name,
          description: `${SOUND_NAMES[this.state.sound]} · ${this.subdivisionName(this.state.subdivision)}`,
          bpm: this.state.bpm,
          beats: this.state.beats,
          subdivision: this.state.subdivision,
          sound: this.state.sound,
          accents: [...this.state.accents],
          favorite: false
        };
        this.presets.unshift(preset);
        saveJSON(STORAGE.presets, this.presets);
        this.renderPresets();
        this.elements.presetDialog.close("save");
        this.toast(`已保存“${name}”`);
      });
      $("#share-current").addEventListener("click", () => this.shareCurrentSettings());
      $("#confirm-delete-preset").addEventListener("click", () => this.deletePreset());
    }

    renderPresets() {
      if (!this.elements?.presetGrid) return;
      if (!this.presets.length) {
        this.elements.presetGrid.innerHTML = `
          <div class="preset-empty">
            <span class="preset-empty-icon"><svg class="icon"><use href="#i-star"/></svg></span>
            <span><strong>还没有练习预设</strong><small>调整节拍后，保存为你的第一个练习计划。</small></span>
          </div>
        `;
        return;
      }
      this.elements.presetGrid.innerHTML = this.presets.map((preset) => `
        <article class="preset-card" data-preset="${escapeHTML(preset.id)}" tabindex="0" role="button" aria-label="载入预设 ${escapeHTML(preset.name)}">
          <div class="preset-top">
            <div><h3>${escapeHTML(preset.name)}</h3><p>${escapeHTML(preset.description || SOUND_NAMES[preset.sound] || "")}</p></div>
            <div class="preset-actions">
              <button class="favorite-button ${preset.favorite ? "is-favorite" : ""}" data-favorite="${escapeHTML(preset.id)}" aria-label="${preset.favorite ? "取消收藏" : "收藏"}">
                <svg class="icon"><use href="#i-star"/></svg>
              </button>
              <button class="favorite-button" data-share-preset="${escapeHTML(preset.id)}" aria-label="分享预设">
                <svg class="icon"><use href="#i-share"/></svg>
              </button>
              <button class="favorite-button delete-preset-button" data-delete-preset="${escapeHTML(preset.id)}" aria-label="删除预设">
                <svg class="icon"><use href="#i-trash"/></svg>
              </button>
            </div>
          </div>
          <div class="preset-tempo">${preset.bpm}<small>BPM · ${preset.beats === 6 ? "6/8" : `${preset.beats}/4`}</small></div>
        </article>
      `).join("");

      $$(".preset-card", this.elements.presetGrid).forEach((card) => {
        card.addEventListener("click", () => {
          const preset = this.presets.find((item) => item.id === card.dataset.preset);
          if (preset) this.loadPreset(preset, card);
        });
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            card.click();
          }
        });
      });
      $$("[data-favorite]", this.elements.presetGrid).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const preset = this.presets.find((item) => item.id === button.dataset.favorite);
          if (!preset) return;
          preset.favorite = !preset.favorite;
          saveJSON(STORAGE.presets, this.presets);
          this.renderPresets();
        });
      });
      $$("[data-share-preset]", this.elements.presetGrid).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const preset = this.presets.find((item) => item.id === button.dataset.sharePreset);
          if (preset) this.sharePreset(preset);
        });
      });
      $$("[data-delete-preset]", this.elements.presetGrid).forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const preset = this.presets.find((item) => item.id === button.dataset.deletePreset);
          if (!preset) return;
          $("#delete-preset-id").value = preset.id;
          $("#delete-preset-name").textContent = preset.name;
          this.elements.deletePresetDialog.showModal();
        });
      });
    }

    deletePreset() {
      const id = $("#delete-preset-id").value;
      const preset = this.presets.find((item) => item.id === id);
      if (!preset) {
        this.elements.deletePresetDialog.close("cancel");
        return;
      }
      this.presets = this.presets.filter((item) => item.id !== id);
      saveJSON(STORAGE.presets, this.presets);
      this.renderPresets();
      this.elements.deletePresetDialog.close("delete");
      this.toast(`已删除“${preset.name}”`);
    }

    loadPreset(preset, card) {
      if (this.isPlaying) this.stopTransport({ record: true });
      this.setState({
        bpm: preset.bpm,
        beats: preset.beats,
        subdivision: preset.subdivision,
        sound: preset.sound,
        accents: [...preset.accents],
        ramp: false
      }, { renderPattern: true, renderDots: true });
      $$(".preset-card").forEach((item) => item.classList.remove("is-loaded"));
      card?.classList.add("is-loaded");
      this.toast(`已载入“${preset.name}” · ${preset.bpm} BPM`);
    }

    currentShareURL() {
      const payload = {
        bpm: this.state.bpm,
        beats: this.state.beats,
        subdivision: this.state.subdivision,
        sound: this.state.sound,
        accents: this.state.accents
      };
      const encoded = btoa(JSON.stringify(payload));
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("preset", encoded);
      return url.href;
    }

    async shareCurrentSettings() {
      const title = `拍点练习 · ${this.state.bpm} BPM`;
      const text = `${this.state.beats === 6 ? "6/8" : `${this.state.beats}/4`} · ${SOUND_NAMES[this.state.sound]} · ${this.subdivisionName(this.state.subdivision)}`;
      const url = this.currentShareURL();
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        this.toast("分享链接已复制");
      } catch {
        this.toast(`当前设置：${title}`);
      }
    }

    sharePreset(preset) {
      const payload = {
        bpm: preset.bpm,
        beats: preset.beats,
        subdivision: preset.subdivision,
        sound: preset.sound,
        accents: preset.accents
      };
      const encoded = btoa(JSON.stringify(payload));
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("preset", encoded);
      if (navigator.share) {
        navigator.share({ title: `拍点 · ${preset.name}`, text: `${preset.bpm} BPM · ${SOUND_NAMES[preset.sound]}`, url: url.href })
          .catch(() => {});
      } else {
        navigator.clipboard?.writeText(url.href)
          .then(() => this.toast("预设链接已复制"))
          .catch(() => this.toast("当前浏览器不支持分享"));
      }
    }

    applyQueryState() {
      const url = new URL(window.location.href);
      const view = url.searchParams.get("view");
      if (VIEW_TITLES[view]) this.switchView(view);
      const encoded = url.searchParams.get("preset");
      if (!encoded) return;
      try {
        const preset = JSON.parse(atob(encoded));
        this.setState({
          bpm: clamp(Number(preset.bpm), 20, 300),
          beats: [2, 3, 4, 6].includes(Number(preset.beats)) ? Number(preset.beats) : 4,
          subdivision: clamp(Number(preset.subdivision), 1, 4),
          sound: SOUND_NAMES[preset.sound] ? preset.sound : "wood",
          accents: Array.isArray(preset.accents) ? preset.accents.map((item) => clamp(Number(item), 0, 2)) : defaultState.accents,
          ramp: false
        }, { renderPattern: true, renderDots: true });
        this.toast("已载入分享的练习设置");
      } catch {
        this.toast("分享链接已失效");
      }
    }

    bindTuner() {
      $("#mic-button").addEventListener("click", () => {
        if (this.micStream) this.stopMicrophone();
        else this.startMicrophone();
      });
      $("#a4-down").addEventListener("click", () => {
        this.referencePitch = clamp(this.referencePitch - 1, 415, 466);
        $("#a4-value").textContent = String(this.referencePitch);
      });
      $("#a4-up").addEventListener("click", () => {
        this.referencePitch = clamp(this.referencePitch + 1, 415, 466);
        $("#a4-value").textContent = String(this.referencePitch);
      });
    }

    async startMicrophone() {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.toast("麦克风需要 HTTPS 或 localhost 环境");
        return;
      }
      if (this.isPlaying) this.stopTransport({ record: true });
      try {
        await this.engine.ensure();
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        const source = this.engine.context.createMediaStreamSource(this.micStream);
        this.analyser = this.engine.context.createAnalyser();
        this.analyser.fftSize = 4096;
        this.analyser.smoothingTimeConstant = 0.15;
        source.connect(this.analyser);
        $("#mic-button").classList.add("is-listening");
        $("#mic-button-text").textContent = "正在聆听";
        this.elements.tunerFrequency.textContent = "请持续演奏一个单音";
        this.pitchLoop();
      } catch (error) {
        this.toast(error.name === "NotAllowedError" ? "麦克风权限未开启" : "无法使用麦克风，请检查权限");
      }
    }

    stopMicrophone() {
      cancelAnimationFrame(this.pitchFrame);
      this.pitchFrame = null;
      this.micStream?.getTracks().forEach((track) => track.stop());
      this.micStream = null;
      this.analyser = null;
      $("#mic-button")?.classList.remove("is-listening");
      if ($("#mic-button-text")) $("#mic-button-text").textContent = "启用麦克风";
    }

    pitchLoop() {
      if (!this.analyser) return;
      const buffer = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(buffer);
      const pitch = this.autoCorrelate(buffer, this.engine.context.sampleRate);
      if (pitch > 45 && pitch < 1800) {
        const note = noteFromFrequency(pitch, this.referencePitch);
        this.elements.tunerNote.textContent = note.name;
        this.elements.tunerOctave.textContent = String(note.octave);
        this.elements.tunerFrequency.textContent = `${note.frequency.toFixed(1)} Hz`;
        this.elements.centsReadout.textContent = `${note.cents > 0 ? "+" : ""}${note.cents} cents`;
        this.elements.tunerNeedle.style.left = `${clamp(((note.cents + 50) / 100) * 100, 3, 97)}%`;
        this.elements.tunerNote.classList.toggle("is-in-tune", Math.abs(note.cents) <= 3);
        this.elements.centsReadout.textContent = Math.abs(note.cents) <= 3 ? "音准" : `${note.cents > 0 ? "偏高" : "偏低"} ${Math.abs(note.cents)} cents`;
      } else {
        this.elements.tunerNote.classList.remove("is-in-tune");
      }
      this.pitchFrame = requestAnimationFrame(() => this.pitchLoop());
    }

    autoCorrelate(buffer, sampleRate) {
      let rms = 0;
      for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
      rms = Math.sqrt(rms / buffer.length);
      if (rms < 0.012) return -1;

      let start = 0;
      let end = buffer.length - 1;
      const threshold = 0.2;
      while (start < end && Math.abs(buffer[start]) < threshold) start += 1;
      while (end > start && Math.abs(buffer[end]) < threshold) end -= 1;
      const trimmed = buffer.slice(start, end);
      const correlations = new Float32Array(trimmed.length);
      for (let offset = 0; offset < trimmed.length; offset += 1) {
        let sum = 0;
        for (let i = 0; i < trimmed.length - offset; i += 1) {
          sum += trimmed[i] * trimmed[i + offset];
        }
        correlations[offset] = sum;
      }
      let difference = 0;
      while (difference < trimmed.length - 1 && correlations[difference] > correlations[difference + 1]) difference += 1;
      let bestOffset = difference;
      while (bestOffset < trimmed.length - 1 && correlations[bestOffset] < correlations[bestOffset + 1]) bestOffset += 1;
      if (bestOffset === 0) return -1;
      let found = -1;
      for (let offset = bestOffset; offset < trimmed.length; offset += 1) {
        if (correlations[offset] > correlations[found] && Math.abs(offset - bestOffset) > 2) {
          found = offset;
          break;
        }
      }
      const candidate = found > 0 ? found : bestOffset;
      return sampleRate / candidate;
    }

    bindRecording() {
      $("#record-button").addEventListener("click", () => {
        if (this.mediaRecorder?.state === "recording") this.stopRecording();
        else this.startRecording();
      });
      $("#delete-recording").addEventListener("click", () => {
        this.elements.recordingStrip.hidden = true;
        this.elements.recordAudio.removeAttribute("src");
        if (this.recordingUrl) URL.revokeObjectURL(this.recordingUrl);
        this.recordingUrl = null;
        this.toast("录音已删除");
      });
    }

    async startRecording() {
      try {
        await this.engine.ensure();
        if (!window.MediaRecorder) {
          this.toast("当前浏览器不支持录音");
          return;
        }
        const supportedType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported?.(type));
        this.recordingChunks = [];
        this.mediaRecorder = supportedType
          ? new MediaRecorder(this.engine.recordingDestination.stream, { mimeType: supportedType })
          : new MediaRecorder(this.engine.recordingDestination.stream);
        this.mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) this.recordingChunks.push(event.data);
        });
        this.mediaRecorder.addEventListener("stop", () => this.finishRecording());
        this.mediaRecorder.start(250);
        $("#record-button").classList.add("is-recording");
        $("#record-button").setAttribute("aria-label", "停止录音");
        this.toast("开始录音");
      } catch {
        this.toast("无法开始录音");
      }
    }

    stopRecording() {
      if (this.mediaRecorder?.state === "recording") this.mediaRecorder.stop();
      $("#record-button").classList.remove("is-recording");
      $("#record-button").setAttribute("aria-label", "开始录音");
    }

    finishRecording() {
      if (!this.recordingChunks.length) {
        this.toast("没有录到声音");
        return;
      }
      if (this.recordingUrl) URL.revokeObjectURL(this.recordingUrl);
      const mime = this.mediaRecorder.mimeType || "audio/webm";
      const blob = new Blob(this.recordingChunks, { type: mime });
      this.recordingUrl = URL.createObjectURL(blob);
      this.elements.recordAudio.src = this.recordingUrl;
      this.elements.downloadRecording.href = this.recordingUrl;
      this.elements.downloadRecording.download = mime.includes("mp4") ? "拍点录音.m4a" : "拍点录音.webm";
      this.elements.recordingStrip.hidden = false;
      $("#recording-duration").textContent = `${Math.max(1, Math.round(blob.size / 16000))} 秒左右`;
      this.toast("录音已完成，可在练习面板回放");
    }

    renderStats() {
      if (!this.elements) return;
      const weekStart = startOfWeek();
      const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
      const values = days.map((date) => Number(this.stats.days[dateKey(date)]?.minutes || 0));
      const weekTotal = Math.round(values.reduce((sum, value) => sum + value, 0));
      const allSessions = Object.values(this.stats.days).flatMap((day) => day.sessions || []);
      const sessionCount = allSessions.length;
      const average = sessionCount ? Math.round(allSessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0) / sessionCount) : 0;
      const previous = Math.max(1, Number(this.stats.previousWeekMinutes || 1));
      const change = Math.round(((weekTotal - previous) / previous) * 100);

      $("#week-total").textContent = String(weekTotal);
      $("#week-change").textContent = `较上周 ${change >= 0 ? "+" : ""}${change}%`;
      $("#session-count").textContent = String(sessionCount);
      $("#average-session").textContent = String(average);
      $("#chart-total").textContent = `${weekTotal} 分钟`;
      $("#streak-count").textContent = String(this.calculateStreak());

      const maxValue = Math.max(60, ...values);
      $("#weekly-bars").innerHTML = values.map((value, index) => `
        <div class="chart-bar-wrap">
          <div class="chart-bar ${dateKey(days[index]) === dateKey() ? "is-today" : ""}" style="height:${clamp((value / maxValue) * 100, 2, 100)}%">
            <span>${value}</span>
          </div>
        </div>
      `).join("");
      $("#weekly-days").innerHTML = days.map((date) => `<span class="${dateKey(date) === dateKey() ? "is-today" : ""}">周${DAY_SHORT[date.getDay()]}</span>`).join("");

      const recent = allSessions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6);
      const history = $("#session-history");
      if (history) {
        history.innerHTML = recent.length ? recent.map((session) => {
          const date = new Date(session.date);
          return `
            <div class="history-item">
              <span class="history-item-icon"><svg class="icon"><use href="#i-metronome"/></svg></span>
              <span><strong>${escapeHTML(session.label || "节拍器练习")}</strong><small>${formatShortDate(date)} · ${session.bpm} BPM</small></span>
              <span>${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date)}</span>
              <b>${session.minutes} 分钟</b>
            </div>
          `;
        }).join("") : `<div class="empty-history">完成一次练习后，记录会显示在这里。</div>`;
      }
      const weeklyGoal = this.settings.goal * 5;
      const remaining = Math.max(0, weeklyGoal - weekTotal);
      const goalPercent = clamp(Math.round((weekTotal / weeklyGoal) * 100), 0, 100);
      $("#remaining-goal").textContent = String(remaining);
      $("#goal-percent").textContent = `${goalPercent}%`;
      $("#goal-ring").style.background = `conic-gradient(var(--lime) 0deg, var(--lime) ${goalPercent * 3.6}deg, #3b4036 ${goalPercent * 3.6}deg)`;
    }

    calculateStreak() {
      let streak = 0;
      const today = new Date();
      for (let offset = 0; offset < 365; offset += 1) {
        const key = dateKey(addDays(today, -offset));
        if ((this.stats.days[key]?.minutes || 0) > 0) streak += 1;
        else break;
      }
      return streak;
    }

    bindDialogs() {
      $("#clear-history").addEventListener("click", () => {
        if (!window.confirm("确定清除所有本地练习记录吗？")) return;
        this.stats = { days: {}, previousWeekMinutes: 0, seeded: false };
        saveJSON(STORAGE.stats, this.stats);
        this.updateTodayMinutes();
        this.renderStats();
        this.toast("练习记录已清除");
      });
      $("#export-stats").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), stats: this.stats }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `拍点练习记录-${dateKey()}.json`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast("练习数据已导出");
      });
      $$("dialog").forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
          if (event.target === dialog) dialog.close("cancel");
        });
      });
    }

    bindInstall() {
      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        this.installPrompt = event;
      });
      $("#install-button").addEventListener("click", () => this.showInstall());
      $("#sidebar-install").addEventListener("click", () => this.showInstall());
      $("#native-install").addEventListener("click", async () => {
        if (this.installPrompt) {
          this.installPrompt.prompt();
          await this.installPrompt.userChoice;
          this.installPrompt = null;
          this.elements.installDialog.close("cancel");
        } else {
          this.toast(this.isIos() ? "请使用 Safari 分享菜单添加到主屏幕" : "请使用浏览器菜单中的“安装应用”");
        }
      });
    }

    isIos() {
      return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    showInstall() {
      if (this.isStandalone) {
        this.toast("拍点已安装在你的设备上");
        return;
      }
      const instructions = $("#install-instructions");
      if (this.isIos()) {
        instructions.innerHTML = `<ol><li>在 Safari 中打开本页。</li><li>轻点底部工具栏的分享按钮。</li><li>向下滚动并选择“添加到主屏幕”。</li><li>确认添加后，从主屏幕打开拍点即可离线使用。</li></ol>`;
        $("#native-install").textContent = "知道了";
      } else {
        instructions.innerHTML = this.installPrompt
          ? `<p>安装后可从桌面直接打开，并支持离线使用。</p>`
          : `<ol><li>打开浏览器菜单。</li><li>选择“安装应用”或“添加到主屏幕”。</li><li>确认安装。</li></ol>`;
        $("#native-install").textContent = this.installPrompt ? "安装应用" : "知道了";
      }
      this.elements.installDialog.showModal();
    }

    bindKeyboard() {
      document.addEventListener("keydown", (event) => {
        const tag = event.target.tagName;
        if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || $$("dialog[open]").length) return;
        if (event.code === "Space") {
          event.preventDefault();
          this.toggleTransport(this.currentView);
        } else if (event.key.toLowerCase() === "t") {
          this.tapTempo($("#tap-tempo"));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          this.setBpm(this.state.bpm + 1, false);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          this.setBpm(this.state.bpm - 1, false);
        }
      });
    }

    toast(message) {
      if (!this.elements?.toastRegion) return;
      const element = document.createElement("div");
      element.className = "toast";
      element.innerHTML = `<svg class="icon"><use href="#i-check"/></svg><span>${escapeHTML(message)}</span>`;
      this.elements.toastRegion.appendChild(element);
      window.setTimeout(() => {
        element.classList.add("is-out");
        window.setTimeout(() => element.remove(), 220);
      }, 2600);
    }

    async registerServiceWorker() {
      if (!("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.register("./sw.js");
      } catch {
        // Offline installation will become available on a secure origin.
      }
    }
  }

  const app = new PracticeApp();
  window.paidian = app;
  app.init();
})();
