import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useChatStore = create(
  persist(
    (set) => ({
      isOpen: false,
  messages: [
    { role: 'model', text: 'Hi! I am Hannah ✨ How can I help you with Prachify today? 💖' }
  ],
  isTyping: false,

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen) => set({ isOpen }),
  
  addMessage: (msg) => set((state) => {
    const next = [...state.messages, msg];
    // Agar 50 se zyada ho jaye, to purane hata do (lekin pehla welcome message bachao)
    if (next.length > 50) next.splice(1, next.length - 50);
    return { messages: next };
  }),
  
  updateLastMessage: (chunk) => set((state) => {
    const newMessages = [...state.messages];
    const last = newMessages[newMessages.length - 1];
    if (last && last.role === 'model') {
      last.text += chunk;
    } else {
      newMessages.push({ role: 'model', text: chunk });
      if (newMessages.length > 50) newMessages.splice(1, newMessages.length - 50);
    }
    return { messages: newMessages };
  }),

  setIsTyping: (isTyping) => set({ isTyping }),
  
  clearChat: () => set({ 
    messages: [{ role: 'model', text: 'Hi! I am Hannah ✨ How can I help you with Prachify today? 💖' }],
    isTyping: false 
  }),
    }),
    {
      name: 'hannah-chat-storage',
      partialize: (state) => ({ messages: state.messages }), // Only save messages, not isOpen or isTyping
    }
  )
);

export default useChatStore;
