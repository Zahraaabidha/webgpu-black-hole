const FADE_IN_SECONDS = 2.5;

export class BackgroundMusic {
  constructor({ sources = [], volume = 0.5, loop = true } = {}) {
    this.targetVolume = volume;
    this.muted = false;
    this.started = false;

    this.audio = new Audio();
    this.audio.loop = loop;
    this.audio.volume = 0;
    this.audio.preload = 'auto';

    this.audio.addEventListener('error', () => {
      console.error('BackgroundMusic: failed to load audio file.', this.audio.error);
    });

    const playable = sources.find((src) => {
      const ext = src.split('.').pop().toLowerCase();
      const mime = ext === 'ogg' ? 'audio/ogg' : ext === 'mp3' ? 'audio/mpeg' : '';
      return mime ? this.audio.canPlayType(mime) !== '' : true;
    }) || sources[0];

    if (playable) {
      this.audio.src = playable;
    } else {
      console.warn('BackgroundMusic: no audio source provided');
    }

    this._fadeRAF = null;
    this._onFirstGesture = this._onFirstGesture.bind(this);
  }

  armAutoplayUnlock() {
    // Try immediate autoplay first; fall back to gesture if blocked.
    this.start();
  }

  _onFirstGesture() {
    this.start();
  }

  _armGestureListeners() {
    const opts = { once: true, passive: true };
    window.addEventListener('pointerdown', this._onFirstGesture, opts);
    window.addEventListener('keydown', this._onFirstGesture, opts);
    window.addEventListener('touchstart', this._onFirstGesture, opts);
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.audio.volume = 0;
    const playPromise = this.audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        // Play succeeded — now fade in.
        this._fadeTo(this.muted ? 0 : this.targetVolume, FADE_IN_SECONDS);
      }).catch((err) => {
        console.warn('BackgroundMusic: autoplay blocked, will start on first interaction', err);
        this.started = false;
        this._armGestureListeners();
      });
    } else {
      this._fadeTo(this.muted ? 0 : this.targetVolume, FADE_IN_SECONDS);
    }
  }

  _fadeTo(target, seconds) {
    if (this._fadeRAF) cancelAnimationFrame(this._fadeRAF);
    const startVol = this.audio.volume;
    const startTime = performance.now();
    const durationMs = seconds * 1000;

    const step = (now) => {
      const t = Math.min((now - startTime) / durationMs, 1);
      this.audio.volume = startVol + (target - startVol) * t;
      if (t < 1) {
        this._fadeRAF = requestAnimationFrame(step);
      } else {
        this._fadeRAF = null;
      }
    };
    this._fadeRAF = requestAnimationFrame(step);
  }

  setVolume(value) {
    this.targetVolume = value;
    if (!this.muted) {
      this.audio.volume = value;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this._fadeTo(this.muted ? 0 : this.targetVolume, 0.4);
    return this.muted;
  }

  get isMuted() {
    return this.muted;
  }
}
