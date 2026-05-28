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
  if (howl && currentUrl === url) {
    if (startPosition > 0) howl.seek(startPosition);
    howl.play();
    return;
  }

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
      if (startPosition > 0) howl.seek(startPosition);
      callbacks.onLoad?.(howl.duration());
    },
    onloaderror: (id, err) => callbacks.onError?.(err),
    onseek: () => callbacks.onSeek?.(),
  });

  howl.play();
}

export function play() { howl?.play(); }
export function pause() { howl?.pause(); }

export function seek(seconds) {
  if (howl) howl.seek(seconds);
}

export function setVolume(vol) {
  if (howl) howl.volume(vol);
  // Also set Howler global for future instances
  Howler.volume(vol);
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

export function stop() { howl?.stop(); }

export function unload() {
  if (howl) {
    howl.unload();
    howl = null;
    currentUrl = null;
  }
}
