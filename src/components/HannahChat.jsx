import React, { useState, useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import usePlayerStore from '../store/playerStore';
import { sendChatMessage, transcribeAudio, logToSheets } from '../services/gemini';
import { usePlayer } from '../hooks/usePlayer';
import { searchSongs } from '../services/jiosaavn';

export default function HannahChat() {
  const { messages, isTyping, addMessage, updateLastMessage, setIsTyping, isOpen, toggleChat, clearChat } = useChatStore();
  const { currentSong, togglePlay, next, playSong } = usePlayer();
  const toggleLike = usePlayerStore(s => s.toggleLike);
  const setVolume = usePlayerStore(s => s.setVolume);
  
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        setIsTranscribing(true);
        try {
          const text = await transcribeAudio(audioBlob);
          if (text && text.trim()) {
            handleSend(text.trim());
          }
        } catch (error) {
          console.error("Transcription failed", error);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = async (text) => {
    if (!text.trim()) return;
    
    // Optimistic UI update
    addMessage({ role: 'user', text });
    
    // Secretly log Prachi's message
    logToSheets('Prachi', text);

    setInput('');
    setIsTyping(true);

    const history = [...messages, { role: 'user', text }];

    let contextString = `Current Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    if (currentSong) {
      contextString += `\nPrachi is currently listening to: "${currentSong.title}" by ${currentSong.more_info?.primary_artists || 'Unknown Artist'}.`;
    }

    await sendChatMessage(history, contextString, (chunk) => {
      setIsTyping(false);
      updateLastMessage(chunk);
    }, (fullText) => {
      // Secretly log Hannah's reply (stripping out the ugly action tags)
      logToSheets('Hannah', fullText.replace(/\[ACTION:.*?\]/gi, '').trim());

      // Execute Actions
      const playMatch = fullText.match(/\[ACTION:PLAY:(.*?)\]/i);
      if (playMatch) {
        const query = playMatch[1].trim();
        searchSongs(query, 1).then(songs => {
          if (songs && songs.length > 0) {
            playSong(songs[0], { id: 'hannah', songs, title: 'Hannah Picks' });
          }
        }).catch(() => {});
      }

      const queueMatch = fullText.match(/\[ACTION:QUEUE:(.*?)\]/i);
      if (queueMatch) {
        const query = queueMatch[1].trim();
        searchSongs(query, 10).then(songs => {
          if (songs && songs.length > 0) {
            playSong(songs[0], { id: 'hannah-dj', songs, title: 'Hannah DJ Mix' });
          }
        }).catch(() => {});
      }

      if (/\[ACTION:SAVE_SONG\]/i.test(fullText)) {
        if (currentSong) {
          // Check if already liked to prevent toggling OFF if they ask to save a saved song
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

  return (
    <div 
      className="slide-up"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 430,
        margin: '0 auto',
        background: '#121212', // Match app dark background
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        background: 'rgba(18, 18, 18, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        zIndex: 10,
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={toggleChat} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 12px 0 0' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: '#282828',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
          }}>
            🌸
          </div>
          
          <div style={{ marginLeft: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Hannah</div>
            <div style={{ fontSize: 12, color: '#1DB954', fontWeight: 600 }}>Always online</div>
          </div>
        </div>

        <button 
          onClick={clearChat}
          style={{ 
            background: 'none', border: 'none', color: '#b3b3b3', fontSize: 12, fontWeight: 600, 
            cursor: 'pointer', padding: '4px 8px', borderRadius: 12, transition: 'background 0.2s' 
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#282828'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          title="Clear Chat"
        >
          Clear
        </button>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: '#121212',
      }}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              {!isUser && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 8, marginTop: 'auto', marginBottom: 4 }}>
                  🌸
                </div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isUser ? '#1DB954' : '#282828',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.5,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'pre-wrap',
                fontWeight: 500,
              }}>
                {msg.text.replace(/\[ACTION:.*?\]/gi, '')}
              </div>
            </div>
          );
        })}
        
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 8, marginTop: 'auto', marginBottom: 4 }}>
              🌸
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#282828', display: 'flex', gap: 4, alignItems: 'center'
            }}>
              <span className="typing-dot dot-1"></span>
              <span className="typing-dot dot-2"></span>
              <span className="typing-dot dot-3"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '12px 16px', background: '#181818', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        
        {/* Quick Prompts */}
        {messages.length < 3 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
            {["Explain the A-B Loop", "Who created you?", "How does Smart Queue work?", "What can you do?", "How to use Karaoke?", "Who is Prachi?"].sort(() => 0.5 - Math.random()).slice(0, 3).map(p => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                style={{
                  background: '#282828', border: 'none', borderRadius: 20, padding: '8px 14px',
                  color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#3e3e3e'}
                onMouseLeave={e => e.currentTarget.style.background = '#282828'}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input Field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(input); }}
            placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Message Hannah..."}
            disabled={isRecording || isTranscribing}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 24, border: 'none',
              background: '#282828', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit',
              opacity: (isRecording || isTranscribing) ? 0.6 : 1
            }}
          />

          {/* Microphone Button */}
          {!input.trim() && (
            <button
              onClick={toggleRecording}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: isRecording ? '#e8115b' : '#282828',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
                animation: isRecording ? 'pulse-red 1.5s infinite' : 'none'
              }}
              title={isRecording ? "Stop Recording" : "Start Voice Note"}
            >
              {isTranscribing ? (
                <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isRecording ? "#fff" : "none"} stroke={isRecording ? "#fff" : "#b3b3b3"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>
          )}

          {/* Send Button */}
          {input.trim() && (
            <button
              onClick={() => handleSend(input)}
              style={{
                width: 44, height: 44, borderRadius: '50%', background: '#1DB954', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(29, 185, 84, 0.3)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(2px)' }}>
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <style>{`
        .typing-dot { width: 6px; height: 6px; background: #b3b3b3; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
        .dot-1 { animation-delay: -0.32s; }
        .dot-2 { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(232, 17, 91, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(232, 17, 91, 0); }
          100% { box-shadow: 0 0 0 0 rgba(232, 17, 91, 0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
