import React, { useState, useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import { sendChatMessage } from '../services/gemini';

export default function HannahChat() {
  const { messages, isTyping, addMessage, updateLastMessage, setIsTyping, isOpen, toggleChat } = useChatStore();
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = async (text) => {
    if (!text.trim()) return;
    
    // Optimistic UI update
    addMessage({ role: 'user', text });
    setInput('');
    setIsTyping(true);

    const history = [...messages, { role: 'user', text }];

    await sendChatMessage(history, (chunk) => {
      setIsTyping(false);
      updateLastMessage(chunk);
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
      }}>
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
                {msg.text}
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
            placeholder="Message Hannah..."
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 24, border: 'none',
              background: '#282828', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit'
            }}
          />
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
      `}</style>
    </div>
  );
}
