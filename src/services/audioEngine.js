import { Howl, Howler } from 'howler';
import { showToast } from '../utils/toast.js';

/**
 * Singleton audio engine — ONE Howl instance for the entire app lifetime.
 * Desktop-Only Web Audio Equalizer + Direct Native Audio on Mobile.
 */

let howl = null;
let currentUrl = null;

const callbacks = {
  onPlay: null,
  onPause: null,
  onEnd: null,
  onLoad: null,
  onSeek: null,
  onError: null,
};

export function setCallbacks(cbs) {
  Object.assign(callbacks, cbs);
}

// Check if current device is a mobile phone / tablet
const isMobileDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  return /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) || (window.innerWidth <= 768 && 'ontouchstart' in window);
};

export function loadAndPlay(url, startPosition = 0) {
  // Same URL already playing — double-play guard
  if (howl && currentUrl === url && howl.playing()) {
    return;
  }

  // Same URL but paused — seek aur play karo, naya instance mat banao
  if (howl && currentUrl === url && !howl.playing()) {
    howl.seek(startPosition);
    howl.play();
    return;
  }

  // Naya song — pehla instance unload karo
  if (howl) {
    howl.unload();
    howl = null;
    resetEqEngine();
  }

  currentUrl = url;

  // Cache-busting for Desktop: force a fresh CORS fetch so tainted cache doesn't mute audio
  const secureUrl = isMobileDevice() ? url : `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;

  // PRE-FILL HOWLER'S POOL: 
  // We must set crossOrigin = 'anonymous' BEFORE Howler sets node.src.
  // Setting it after new Howl() aborts the fetch in Chromium, freezing playback at 0:00.
  if (!isMobileDevice() && typeof Audio !== 'undefined') {
    const preConfiguredNode = new Audio();
    preConfiguredNode.crossOrigin = 'anonymous';
    Howler._html5AudioPool.push(preConfiguredNode);
  }

  howl = new Howl({
    src: [secureUrl],
    html5: true,
    preload: true,
    volume: 1.0,
    onplay: () => {
      callbacks.onPlay?.();
      // On Desktop: apply active EQ filter chain
      if (!isMobileDevice()) {
        const node = howl?._sounds?.[0]?._node;
        if (node && currentEqPreset !== 'Flat') {
          initEqFilters(node);
        }
      }
    },
    onpause: () => callbacks.onPause?.(),
    onend: () => callbacks.onEnd?.(),
    onload: () => {
      if (startPosition > 0) howl.seek(startPosition);
      callbacks.onLoad?.(howl.duration());
    },
    onloaderror: (id, err) => callbacks.onError?.(err),
    onplayerror: (id, err) => {
      howl.once('unlock', () => howl.play());
      callbacks.onError?.(err);
    },
    onseek: () => callbacks.onSeek?.(),
  });

  howl.play();
}

// Sirf load karo — play mat karo (startup ke liye)
export function loadOnly(url, startPosition = 0) {
  if (howl) {
    howl.unload();
    howl = null;
    resetEqEngine();
  }
  currentUrl = url;
  // Cache-busting for Desktop
  const secureUrl = isMobileDevice() ? url : `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;

  if (!isMobileDevice() && typeof Audio !== 'undefined') {
    const preConfiguredNode = new Audio();
    preConfiguredNode.crossOrigin = 'anonymous';
    Howler._html5AudioPool.push(preConfiguredNode);
  }

  howl = new Howl({
    src: [secureUrl],
    html5: true,
    preload: true,
    volume: 1.0,
    onplay: () => callbacks.onPlay?.(),
    onpause: () => callbacks.onPause?.(),
    onend: () => callbacks.onEnd?.(),
    onload: () => {
      howl.seek(startPosition);
      callbacks.onLoad?.(howl.duration());
    },
    onloaderror: (id, err) => callbacks.onError?.(err),
    onplayerror: (id, err) => {
      howl.once('unlock', () => howl.play());
      callbacks.onError?.(err);
    },
    onseek: () => callbacks.onSeek?.(),
  });
}

export function play() { howl?.play(); }
export function pause() { howl?.pause(); }
export function hasHowl() { return howl !== null; }

export function seek(seconds) {
  if (howl) howl.seek(seconds);
}

export function setVolume(vol) {
  if (howl) howl.volume(vol);
  if (typeof window !== 'undefined' && window.Howler) {
    window.Howler.volume(vol);
  }
}

export function getPosition() {
  if (!howl) return 0;
  const pos = howl.seek();
  return typeof pos === 'number' ? pos : 0;
}

export function getDuration() {
  if (!howl) return 0;
  const dur = howl.duration();
  return typeof dur === 'number' ? dur : 0;
}

export function isPlaying() {
  return howl ? howl.playing() : false;
}

export function unload() {
  if (howl) {
    howl.unload();
    howl = null;
    currentUrl = null;
    resetEqEngine();
  }
}

export function setPlaybackRate(rate) {
  if (!howl) return;
  const node = howl?._sounds?.[0]?._node;
  if (node) node.playbackRate = rate;
}

export function getPlaybackRate() {
  const node = howl?._sounds?.[0]?._node;
  return node?.playbackRate ?? 1.0;
}

// ── 5-Band Web Audio Equalizer (Desktop-Optimized) ─────────────────────────
export const EQ_PRESETS = {
  'Flat':           { name: 'Flat (Default)', gains: [0, 0, 0, 0, 0], icon: '🎵', desc: 'Natural balanced sound' },
  'Bass Boost':     { name: 'Bass Boost',     gains: [8, 5, 1, 0, 2], icon: '🔊', desc: 'Deep punchy bass response' },
  'Vocal Enhancer': { name: 'Vocal Enhancer', gains: [-2, 0, 6, 4, 2], icon: '🎤', desc: 'Crisp clear vocals & podcasts' },
  'Party':          { name: 'Party / Club',   gains: [7, 4, 1, 3, 6], icon: '🎉', desc: 'High energy bass & treble' },
  'Acoustic':       { name: 'Acoustic',       gains: [4, 2, 3, 4, 3], icon: '🎸', desc: 'Guitars, piano & acoustics' },
  'Treble Boost':   { name: 'Treble Boost',   gains: [-3, 0, 2, 5, 8], icon: '⚡', desc: 'Bright sparkling highs' },
};

let audioCtx = null;
let sourceNode = null;
let currentAudioNode = null;
let eqFilters = [];
let currentEqPreset = 'Flat';

function resetEqEngine() {
  // Disconnect and clear EQ filter chain
  eqFilters.forEach(f => { try { f.disconnect(); } catch (e) {} });
  eqFilters = [];
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (e) {}
    sourceNode = null;
  }
  currentAudioNode = null;
}

function initEqFilters(audioNode) {
  // Only run on Desktop — Mobile uses native HTML5 audio directly
  if (!audioNode || typeof window === 'undefined' || isMobileDevice()) return;
  // If same node already connected, just update gains (don't re-init)
  if (currentAudioNode === audioNode && sourceNode && eqFilters.length === 5) {
    const gains = EQ_PRESETS[currentEqPreset]?.gains || [0,0,0,0,0];
    gains.forEach((gain, i) => {
      try { eqFilters[i].gain.setValueAtTime(gain, audioCtx.currentTime); } catch(e) {}
    });
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = Howler.ctx || new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // Full teardown before rebuilding
    resetEqEngine();
    currentAudioNode = audioNode;

    sourceNode = audioCtx.createMediaElementSource(audioNode);

    const FREQS = [60, 250, 1000, 4000, 12000];
    const TYPES = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
    const gains = EQ_PRESETS[currentEqPreset]?.gains || [0,0,0,0,0];

    eqFilters = FREQS.map((freq, idx) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = TYPES[idx];
      filter.frequency.value = freq;
      filter.gain.value = gains[idx];
      return filter;
    });

    // Connect: source -> filter0 -> ... -> filter4 -> destination
    sourceNode.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(audioCtx.destination);
  } catch (err) {
    console.debug('[AudioEngine] Web Audio EQ bypass fallback:', err?.message || err);
  }
}

export function setEqPreset(presetName) {
  if (!EQ_PRESETS[presetName]) return;

  if (isMobileDevice() && presetName !== 'Flat') {
    showToast('Equalizer is available on Desktop browsers', { type: 'warn' });
    currentEqPreset = 'Flat';
    return;
  }

  currentEqPreset = presetName;
  const gains = EQ_PRESETS[presetName].gains;

  const node = howl?._sounds?.[0]?._node;
  if (node && !isMobileDevice()) {
    initEqFilters(node);
  }

  if (eqFilters.length === 5) {
    gains.forEach((gain, i) => {
      if (eqFilters[i]) {
        try {
          eqFilters[i].gain.setValueAtTime(gain, audioCtx ? audioCtx.currentTime : 0);
        } catch (e) {}
      }
    });
  }
}

export function getCurrentEqPreset() {
  return currentEqPreset;
}
