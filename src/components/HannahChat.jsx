import React, { useState, useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import usePlayerStore from '../store/playerStore';
import useProfileStore from '../store/profileStore';
import { sendChatMessage, logToSheets } from '../services/gemini';
import { transcribeBest } from '../services/whisper';
import { usePlayer } from '../hooks/usePlayer';
import { searchSongs } from '../services/jiosaavn';

export default function HannahChat() {
  const { messages, isTyping, addMessage, updateLastMessage, setIsTyping, isOpen, toggleChat, clearChat } = useChatStore();
  const { currentSong, isPlaying, togglePlay, next, playSong } = usePlayer();
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const setVolume = usePlayerStore(s => s.setVolume);
  const activeProfile = useProfileStore(s => s.getActiveProfile());
  const profileName = activeProfile?.name || 'User';

  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playedSongMap, setPlayedSongMap] = useState({});
  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleRecordStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        '',
      ].find(type => type === '' || MediaRecorder.isTypeSupported(type));

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = { recorder: mediaRecorder, stream };
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      setIsRecording(false);
    }
  };

  const handleRecordStop = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    setIsRecording(false);

    const { recorder, stream } = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    recorder.stop();
    stream.getTracks().forEach(t => t.stop());

    await new Promise(r => { recorder.onstop = r; });
    const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

    if (audioBlob.size < 1000) return;
    setIsTranscribing(true);

    try {
      const transcript = await transcribeBest(audioBlob);
      if (transcript && transcript.trim()) {
        handleSend(transcript.trim());
      }
    } catch (error) {
      console.error("Transcription failed", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSend = async (text) => {
    if (!text.trim()) return;

    addMessage({ role: 'user', text });
    logToSheets(profileName, text);

    setInput('');
    setIsTyping(true);

    const history = [...messages, { role: 'user', text }];

    let contextString = `Current Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    if (currentSong) {
      contextString += `\n${profileName} is currently listening to: "${currentSong.title}" by ${currentSong.more_info?.primary_artists || currentSong.artist || 'Unknown Artist'}.`;
    }

    await sendChatMessage(history, contextString, (chunk) => {
      setIsTyping(false);
      updateLastMessage(chunk);
    }, (fullText) => {
      logToSheets('Hannah', fullText.replace(/\[ACTION:.*?\]/gi, '').trim());

      const msgIndex = useChatStore.getState().messages.length - 1;

      const playMatch = fullText.match(/\[ACTION:PLAY:(.*?)\]/i);
      if (playMatch) {
        const query = playMatch[1].trim();
        searchSongs(query, 1).then(songs => {
          if (songs && songs.length > 0) {
            playSong(songs[0], { id: 'hannah', songs, title: 'Hannah Picks' });
            setPlayedSongMap(prev => ({ ...prev, [msgIndex]: songs[0] }));
          }
        }).catch(() => {});
      }

      const queueMatch = fullText.match(/\[ACTION:QUEUE:(.*?)\]/i);
      if (queueMatch) {
        const query = queueMatch[1].trim();
        searchSongs(query, 10).then(songs => {
          if (songs && songs.length > 0) {
            playSong(songs[0], { id: 'hannah-dj', songs, title: 'Hannah DJ Mix' });
            setPlayedSongMap(prev => ({ ...prev, [msgIndex]: songs[0] }));
          }
        }).catch(() => {});
      }

      if (/\[ACTION:SAVE_SONG\]/i.test(fullText)) {
        if (currentSong) {
          const isLiked = usePlayerStore.getState().likedSongs.includes(currentSong.id);
          if (!isLiked) toggleLike(currentSong);
        }
      }

      const volMatch = fullText.match(/\[ACTION:VOLUME:(.*?)\]/i);
      if (volMatch) {
        const cmd = volMatch[1].trim().toUpperCase();
        const currentVol = usePlayerStore.getState().volume;
        if (cmd === 'UP') setVolume(Math.min(1, currentVol + 0.2));
        else if (cmd === 'DOWN') setVolume(Math.max(0, currentVol - 0.2));
        else if (cmd === 'MAX') setVolume(1);
        else if (cmd === 'MUTE') setVolume(0);
      }
      if (/\[ACTION:PAUSE\]/i.test(fullText)) {
        togglePlay();
      }
      if (/\[ACTION:NEXT\]/i.test(fullText)) {
        next();
      }
    });
  };

  const getPromptChips = () => {
    if (currentSong) {
      const songTitle = (currentSong.title || 'Song').replace(/&quot;/g, '"');
      return [
        { label: `🎵 Similar to ${songTitle.slice(0, 14)}...`, query: `Play songs similar to "${songTitle}"` },
        { label: `📜 Story of this song`, query: `Tell me the story and meaning behind "${songTitle}"` },
        { label: `⚡ Mix with this vibe`, query: `Create a playlist with the vibe of "${songTitle}"` },
        { label: `❤️ Save to Liked`, query: `Save this song to my liked songs` },
      ];
    }
    return [
      { label: "🎵 Play Romantic Hits", query: "Play romantic hindi songs" },
      { label: "🔥 Party Mix", query: "Play upbeat party songs" },
      { label: "🌧️ Chill Acoustic", query: "Play peaceful acoustic instrumental songs" },
      { label: "⚡ Workout Punjabi", query: "Play high energy gym Punjabi hits" },
    ];
  };

  return (
    <div className="hannah-drawer-overlay">
      {/* Backdrop overlay */}
      <div className="hannah-drawer-backdrop" onClick={toggleChat} />

      {/* Right Sidebar Drawer Panel */}
      <aside className="hannah-drawer-panel">
        {/* Ambient Glow Orbs */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 79, 163, 0.18) 0%, transparent 70%)',
          filter: 'blur(35px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 60, left: -40, width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
          filter: 'blur(35px)', pointerEvents: 'none',
        }} />

        {/* ── Modern Header ── */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(20, 16, 34, 0.8)',
          backdropFilter: 'blur(16px)',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff4fa3 0%, #a855f7 50%, #3b82f6 100%)',
                padding: 2.5, boxShadow: '0 0 16px rgba(255, 79, 163, 0.4)',
              }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#0e0b18' }}>
                  <img
                    src="/hannah-avatar.png"
                    alt="Hannah"
                    onError={e => e.currentTarget.style.display = 'none'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
              <span style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 11, height: 11, borderRadius: '50%',
                background: '#10b981', border: '2px solid #0e0b18',
                boxShadow: '0 0 8px #10b981',
              }} />
            </div>

            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 6 }}>
                Hannah <span style={{ fontSize: 11, background: 'linear-gradient(135deg, #ff4fa3, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>AI</span>
                {/* Keyboard hint badge */}
                <span style={{
                  fontSize: 10, background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '1px 6px', borderRadius: 6, color: '#cbd5e1', fontWeight: 600,
                  marginLeft: 4,
                }}>
                  Alt+H
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'hannahPulse 2s infinite' }} />
                Smart Music Copilot
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={clearChat}
              style={{
                background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                padding: '6px 12px', borderRadius: 20, transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
            >
              Clear
            </button>
            <button
              onClick={toggleChat}
              style={{
                background: 'rgba(255, 255, 255, 0.08)', border: 'none',
                color: '#fff', fontSize: 16, cursor: 'pointer',
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Active Track Context Strip ── */}
        {currentSong && (
          <div style={{
            padding: '10px 18px',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            position: 'relative', zIndex: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                <img src={currentSong.cover} alt="" style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }} onError={e => e.target.style.background = '#333'} />
                {isPlaying && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}>
                    <span className="eq-bar eq-1" />
                    <span className="eq-bar eq-2" />
                    <span className="eq-bar eq-3" />
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentSong.title}
                </div>
                <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500 }}>
                  {currentSong.more_info?.primary_artists || currentSong.artist || 'Artist'}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSend(`Save "${currentSong.title}" to my liked songs`)}
              style={{
                background: 'linear-gradient(135deg, rgba(255,79,163,0.2) 0%, rgba(168,85,247,0.2) 100%)',
                border: '1px solid rgba(255,79,163,0.3)', borderRadius: 12,
                padding: '4px 11px', color: '#ff77be', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'transform 0.15s ease',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              + Save
            </button>
          </div>
        )}

        {/* ── Messages Feed ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          position: 'relative', zIndex: 2,
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center', margin: 'auto 0', padding: '24px 18px',
              background: 'rgba(255, 255, 255, 0.03)', borderRadius: 24,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{
                fontSize: 32, marginBottom: 10, display: 'inline-block',
                filter: 'drop-shadow(0 0 12px rgba(255,79,163,0.5))',
              }}>✨</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                What are we listening to, {profileName}?
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>
                Ask me to play any track, generate smart queues, or manage your library.
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const cleanText = msg.text.replace(/\[ACTION:.*?\]/gi, '').trim();
            const songCardData = playedSongMap[i];

            if (!cleanText && !songCardData) return null;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  animation: 'hannahMsgPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
                  {!isUser && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff4fa3, #a855f7)',
                      padding: 1.5, marginRight: 8, marginTop: 'auto', marginBottom: 2, flexShrink: 0,
                    }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#0e0b18' }}>
                        <img src="/hannah-avatar.png" alt="" onError={e => e.currentTarget.style.display = 'none'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    </div>
                  )}

                  <div style={{
                    maxWidth: '82%',
                    padding: '12px 16px',
                    borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    background: isUser
                      ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                      : 'rgba(255, 255, 255, 0.07)',
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: 14,
                    lineHeight: 1.55,
                    boxShadow: isUser
                      ? '0 4px 18px rgba(168, 85, 247, 0.35)'
                      : '0 4px 14px rgba(0, 0, 0, 0.3)',
                    whiteSpace: 'pre-wrap',
                    fontWeight: 500,
                  }}>
                    {cleanText}
                  </div>
                </div>

                {/* Interactive Hannah Song Card */}
                {songCardData && (
                  <div style={{
                    marginLeft: isUser ? 0 : 38,
                    maxWidth: 280,
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, rgba(30, 24, 52, 0.9) 0%, rgba(18, 14, 32, 0.95) 100%)',
                    border: '1px solid rgba(255, 79, 163, 0.3)',
                    borderRadius: 16,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 79, 163, 0.15)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={songCardData.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.background = '#333'} />
                      {currentSong?.id === songCardData.id && isPlaying && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                        }}>
                          <span className="eq-bar eq-1" />
                          <span className="eq-bar eq-2" />
                          <span className="eq-bar eq-3" />
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {songCardData.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {songCardData.more_info?.primary_artists || songCardData.artist || 'Artist'}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (currentSong?.id === songCardData.id) togglePlay();
                        else playSong(songCardData, { id: 'hannah-card', songs: [songCardData], title: 'Hannah Pick' });
                      }}
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ff4fa3, #a855f7)',
                        border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 0 12px rgba(255, 79, 163, 0.4)',
                        flexShrink: 0, transition: 'transform 0.15s ease',
                      }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {currentSong?.id === songCardData.id && isPlaying ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" style={{ transform: 'translateX(1px)' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'hannahMsgPop 0.2s ease' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff4fa3, #a855f7)',
                padding: 1.5, marginRight: 8, marginTop: 'auto', marginBottom: 2, flexShrink: 0,
              }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#0e0b18' }}>
                  <img src="/hannah-avatar.png" alt="" onError={e => e.currentTarget.style.display = 'none'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>

              <div style={{
                padding: '12px 18px', borderRadius: '20px 20px 20px 4px',
                background: 'rgba(255, 255, 255, 0.07)', border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                <span className="hannah-dot dot-1" />
                <span className="hannah-dot dot-2" />
                <span className="hannah-dot dot-3" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ── Input Controls & Chips ── */}
        <div style={{
          padding: '14px 18px max(env(safe-area-inset-bottom), 16px)',
          background: 'rgba(12, 10, 22, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative', zIndex: 2,
        }}>
          {/* Quick Prompts */}
          {messages.length < 4 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
              {getPromptChips().map(p => (
                <button
                  key={p.label}
                  onClick={() => handleSend(p.query)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 20, padding: '7px 14px',
                    color: '#e2e8f0', fontSize: 12, fontWeight: 600,
                    whiteSpace: 'nowrap', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Voice Mic Active Equalizer Bar */}
          {isRecording && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 0 10px', color: '#ef4444', fontSize: 12, fontWeight: 700,
            }}>
              <span className="rec-wave rw-1" />
              <span className="rec-wave rw-2" />
              <span className="rec-wave rw-3" />
              <span className="rec-wave rw-4" />
              <span className="rec-wave rw-5" />
              <span style={{ marginLeft: 6 }}>Listening to your voice...</span>
            </div>
          )}

          {/* Futuristic Input Bar */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.07)',
            border: isRecording ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 30, padding: '4px 6px 4px 16px',
            boxShadow: isRecording ? '0 0 24px rgba(239, 68, 68, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.25s ease',
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(input); }}
              placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing voice..." : "Ask Hannah..."}
              disabled={isRecording || isTranscribing}
              style={{
                flex: 1, background: 'none', border: 'none',
                color: '#fff', fontSize: 14, outline: 'none',
                fontFamily: 'inherit', padding: '8px 0',
                opacity: (isRecording || isTranscribing) ? 0.6 : 1,
              }}
            />

            {/* Voice Mic Button */}
            {!input.trim() && (
              <button
                onClick={isRecording ? handleRecordStop : handleRecordStart}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none',
                  background: isRecording ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'transparent',
                  color: isRecording ? '#fff' : '#94a3b8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.7)' : 'none',
                }}
                title={isRecording ? "Tap to stop" : "Voice message"}
              >
                {isTranscribing ? (
                  <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'hannahSpin 0.8s linear infinite' }} />
                ) : isRecording ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                  </svg>
                )}
              </button>
            )}

            {/* Gradient Send Button */}
            {input.trim() && (
              <button
                onClick={() => handleSend(input)}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  border: 'none', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(168, 85, 247, 0.45)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1px)' }}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>

      </aside>

      <style>{`
        /* Right Sidebar Drawer Styling */
        .hannah-drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 9900;
          pointer-events: none;
        }

        .hannah-drawer-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(6px);
          WebkitBackdropFilter: blur(6px);
          pointer-events: auto;
          animation: hannahOverlayFade 0.25s ease;
        }

        .hannah-drawer-panel {
          pointer-events: auto;
          position: fixed;
          top: 0;
          bottom: 90px;
          right: 0;
          width: 400px;
          max-width: 100vw;
          background: linear-gradient(180deg, rgba(24, 20, 40, 0.96) 0%, rgba(12, 10, 22, 0.98) 100%);
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: hannahDrawerSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 9910;
        }

        @media (max-width: 768px) {
          .hannah-drawer-panel {
            width: 100vw;
            bottom: 0;
            border-left: none;
          }
        }

        @keyframes hannahOverlayFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes hannahDrawerSlide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes hannahMsgPop {
          from { transform: scale(0.96) translateY(6px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes hannahPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        @keyframes hannahSpin {
          to { transform: rotate(360deg); }
        }
        .hannah-dot {
          width: 6.5px; height: 6.5px; background: #a78bfa; border-radius: 50%;
          animation: hannahBounce 1.4s infinite ease-in-out both;
        }
        .dot-1 { animation-delay: -0.32s; }
        .dot-2 { animation-delay: -0.16s; }
        @keyframes hannahBounce {
          0%, 80%, 100% { transform: scale(0.3); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .eq-bar {
          width: 2.5px; height: 12px; background: #10b981; border-radius: 1px;
          animation: eqPulse 0.6s infinite ease-in-out alternate;
        }
        .eq-1 { animation-delay: 0s; }
        .eq-2 { animation-delay: 0.2s; }
        .eq-3 { animation-delay: 0.4s; }
        @keyframes eqPulse {
          from { height: 4px; }
          to   { height: 14px; }
        }
        .rec-wave {
          width: 3px; height: 14px; background: #ef4444; border-radius: 2px;
          animation: recPulse 0.5s infinite ease-in-out alternate;
        }
        .rw-1 { animation-delay: 0s; }
        .rw-2 { animation-delay: 0.1s; }
        .rw-3 { animation-delay: 0.2s; }
        .rw-4 { animation-delay: 0.3s; }
        .rw-5 { animation-delay: 0.4s; }
        @keyframes recPulse {
          from { height: 4px; }
          to   { height: 18px; }
        }
      `}</style>
    </div>
  );
}
