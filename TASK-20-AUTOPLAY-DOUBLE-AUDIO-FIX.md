# TASK-20: Fix Auto-Play on App Open + Double Audio Instance

## Two Problems — One Root

---

## Problem 1 — App open hone pe automatically song chalne lagta hai
User ne last time jo song sunа tha — app dobara open karne pe bina resume kiye
automatically play hone lagta hai. User chahta hai manually play kare tab chale.

## Problem 2 — Same song 2 baar overlap karke chalta hai
App open hone pe do audio instances ek saath play hone lagte hain —
ek jo already tha, ek naya jo startup mein ban gaya.

## Risk Level: LOW RISK
- Sirf startup useEffect + audioEngine mein guard add ho raha hai
- Queue, next, prev, manual play — sab untouched
- TASK-11 ke changes ke saath compatible hai

---

## Root Cause

`src/hooks/usePlayer.js` startup `useEffect` mein ye hai:

```js
useEffect(() => {
  const { currentSong, position, volume, isMuted } = usePlayerStore.getState();
  if (currentSong) {
    audio.setVolume(isMuted ? 0 : volume);
    audio.loadAndPlay(currentSong.url, position || 0); // ← auto-play + double instance
    updateMediaSession(currentSong);
  }
}, []);
```

`loadAndPlay` do kaam karta hai — load bhi, play bhi.
Isliye dono problems ek hi jagah se aa rahi hain.

---

## Fix 1 — `src/services/audioEngine.js` mein naya `loadOnly` function add karo

Existing `loadAndPlay` ke neeche ye add karo:

```js
// Sirf load karo — play mat karo (startup ke liye)
export function loadOnly(url, startPosition = 0) {
  if (howl) {
    howl.unload();
    howl = null;
  }
  currentUrl = url;
  howl = new Howl({
    src: [url],
    html5: true,
    volume: 0, // silently load
    onload: () => {
      howl.seek(startPosition);
      howl.volume(usePlayerStore.getState().isMuted ? 0 : usePlayerStore.getState().volume);
    },
    onloaderror: () => {
      // silent fail — user manually play karega
    },
  });
  // play() intentionally nahi hai
}
```

---

## Fix 2 — `src/hooks/usePlayer.js` startup `useEffect` update karo

### Current (galat):
```js
useEffect(() => {
  const { currentSong, position, volume, isMuted } = usePlayerStore.getState();
  if (currentSong) {
    audio.setVolume(isMuted ? 0 : volume);
    audio.loadAndPlay(currentSong.url, position || 0);
    updateMediaSession(currentSong);
  }
}, []);
```

### Replace with:
```js
useEffect(() => {
  const { currentSong, position, volume, isMuted } = usePlayerStore.getState();
  if (currentSong) {
    audio.setVolume(isMuted ? 0 : volume);
    audio.loadOnly(currentSong.url, position || 0); // sirf load, play nahi
    updateMediaSession(currentSong);
    // UI paused dikhaye
    usePlayerStore.getState().setIsPlaying(false);
  }
}, []);
```

---

## Fix 3 — `loadAndPlay` mein double-play guard (Problem 2 extra safety)

`src/services/audioEngine.js` mein existing `loadAndPlay` update karo:

```js
export function loadAndPlay(url, startPosition = 0) {
  // Agar same URL already play ho rahi hai — kuch mat karo
  if (howl && currentUrl === url && howl.playing()) {
    return;
  }

  // Agar same URL hai but paused hai — seek karke play karo
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
    // ... baaki existing options same rakho
  });
  howl.play();
}
```

---

## Expected Behavior After Fix

| Situation | Before | After |
|---|---|---|
| App open karo | Song automatically chalta hai | Song load hota hai, paused state mein |
| Play button dabao | Normal | Normal ✅ |
| Background se foreground | Double audio | Single audio ✅ |
| Next/prev | Normal | Normal ✅ |
| Manual pause/play | Normal | Normal ✅ |

---

## Test Karo

1. App band karo — koi song chal raha ho
2. App dobara open karo — song **automatically nahi chalna chahiye**
3. BottomPlayer mein song naam dikhna chahiye — paused state mein
4. Play button dabao — tab chalne chahiye ✅
5. Phone lock karo — app background mein — 2 songs queue mein — pehla khatam ho — doosra chale ✅
6. Background se foreground pe aao — **single audio stream** honi chahiye ✅

---

## Rollback
- `audioEngine.js` se `loadOnly` function delete karo
- `usePlayer.js` startup useEffect mein `loadOnly` → `loadAndPlay` wapas karo
- `usePlayerStore.getState().setIsPlaying(false)` line remove karo
- `loadAndPlay` mein jo guard add kiya — remove karo
