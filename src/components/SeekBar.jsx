import React, { useRef, useState } from 'react';

export default function SeekBar({ position, duration, onSeek }) {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getPct = (clientX) => {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleClick = (e) => {
    const pct = getPct(e.clientX);
    onSeek(pct * duration);
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    const pct = getPct(e.touches[0].clientX);
    setDragPos(pct);

    const move = (ev) => {
      const p = getPct(ev.touches[0].clientX);
      setDragPos(p);
    };
    const end = (ev) => {
      const p = getPct(ev.changedTouches[0].clientX);
      onSeek(p * duration);
      setIsDragging(false);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
  };

  const pct = isDragging ? dragPos * 100 : duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="w-full flex flex-col gap-1.5 select-none">
      <div
        ref={ref}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer group py-2"
        style={{ touchAction: 'none' }}
      >
        <div className="absolute inset-x-0 h-1 top-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Thumb */}
        <div
          className="absolute top-2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/50 font-medium px-0.5">
        <span>{formatTime(position)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
