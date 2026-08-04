import { Howl } from 'howler';

/**
 * Singleton audio engine — ONE Howl instance for the entire app lifetime.
 * Never create another Howl elsewhere.
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

  // Naya song — pehla unload karo
  if (howl) {
    howl.unload();
    howl = null;
  }

  currentUrl = url;

  howl = new Howl({
    src: [url],
    html5: true,
    preload: true,
    volume: 1.0,
    onplay: () => {
      callbacks.onPlay?.();
      const node = howl?._sounds?.[0]?._node;
      if (node) initEqFilters(node);
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
// Full callbacks wired karo — taaki user Play dabaye toh onPlay fire ho aur UI update ho
export function loadOnly(url, startPosition = 0) {
  if (howl) {
    howl.unload();
    howl = null;
  }
  currentUrl = url;
  howl = new Howl({
    src: [url],
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
  // play() intentionally nahi hai — startup pe paused rehna chahiye
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
  }
}

// ── 5-Band Web Audio Equalizer ──────────────────────────────────────────────
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
let eqFilters = [];
let currentEqPreset = 'Flat';

function initEqFilters(audioNode) {
  if (!audioNode || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (!sourceNode && audioNode) {
      // Create HTML5 media element source node
      audioNode.crossOrigin = 'anonymous';
      sourceNode = audioCtx.createMediaElementSource(audioNode);

      const FREQS = [60, 250, 1000, 4000, 12000];
      const TYPES = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

      eqFilters = FREQS.map((freq, idx) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = TYPES[idx];
        filter.frequency.value = freq;
        filter.gain.value = EQ_PRESETS[currentEqPreset]?.gains[idx] || 0;
        return filter;
      });

      // Connect source -> filter0 -> filter1 -> filter2 -> filter3 -> filter4 -> destination
      sourceNode.connect(eqFilters[0]);
      for (let i = 0; i < eqFilters.length - 1; i++) {
        eqFilters[i].connect(eqFilters[i + 1]);
      }
      eqFilters[eqFilters.length - 1].connect(audioCtx.destination);
    }
  } catch (err) {
    // If MediaElementSource already connected or unsupported, log quietly
    console.debug('[AudioEngine] EQ init notice:', err?.message || err);
  }
}

export function setEqPreset(presetName) {
  if (!EQ_PRESETS[presetName]) return;
  currentEqPreset = presetName;
  const gains = EQ_PRESETS[presetName].gains;

  if (eqFilters.length === 5) {
    gains.forEach((gain, i) => {
      if (eqFilters[i]) {
        eqFilters[i].gain.setValueAtTime(gain, audioCtx ? audioCtx.currentTime : 0);
      }
    });
  }
}

export function getCurrentEqPreset() {
  return currentEqPreset;
}

export function setPlaybackRate(rate) {
  if (!howl) return;
  // Howler HTML5 mode mein _sounds[0]._node = actual <audio> element
  const node = howl?._sounds?.[0]?._node;
  if (node) {
    node.playbackRate = rate;
    initEqFilters(node);
  }
}

export function getPlaybackRate() {
  const node = howl?._sounds?.[0]?._node;
  return node?.playbackRate ?? 1.0;
}
