import React, { useState, useEffect, useRef } from 'react';
import { getLyrics } from '../services/jiosaavn';

export default function MiniLyrics({ song, position }) {
  const [lines, setLines] = useState([]);
  const [currentLine, setCurrentLine] = useState('');
  const [visible, setVisible] = useState(false);
  const lastSongId = useRef(null);

  // Song change hone par lyrics fetch karo
  useEffect(() => {
    if (!song?.id || song.source !== 'jiosaavn') {
      setLines([]);
      setCurrentLine('');
      setVisible(false);
      return;
    }
    if (song.id === lastSongId.current) return;
    lastSongId.current = song.id;

    setLines([]);
    setVisible(false);

    getLyrics(song.id).then(fetchedLines => {
      if (fetchedLines && fetchedLines.length > 0) {
        setLines(fetchedLines);
        setVisible(true);
      }
    });
  }, [song?.id]);

  // Position se current line estimate karo
  useEffect(() => {
    if (!lines.length || !song?.duration) return;
    const totalLines = lines.length;
    const progress = position / (song.duration || 1);
    const idx = Math.min(
      Math.floor(progress * totalLines),
      totalLines - 1
    );
    setCurrentLine(lines[idx] || '');
  }, [position, lines, song?.duration]);

  if (!visible || !currentLine) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 116, // BottomPlayer (56px navbar + ~60px player) ke upar
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 382,
      zIndex: 44,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 10,
        padding: '8px 14px',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p key={currentLine} style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.85)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          animation: 'lyricFadeIn 0.3s ease',
        }}>
          {currentLine}
        </p>
      </div>
    </div>
  );
}
