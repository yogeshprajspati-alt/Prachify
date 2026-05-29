import { create } from 'zustand';

const useChatStore = create((set) => ({
  isOpen: false,
  messages: [
    { role: 'model', text: 'Hi! I am Hannah ✨ How can I help you with Prachify today? 💖' }
  ],
  isTyping: false,

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (isOpen) => set({ isOpen }),
  
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  
  updateLastMessage: (chunk) => set((state) => {
    const newMessages = [...state.messages];
    const last = newMessages[newMessages.length - 1];
    if (last && last.role === 'model') {
      last.text += chunk;
    } else {
      newMessages.push({ role: 'model', text: chunk });
    }
    return { messages: newMessages };
  }),

  setIsTyping: (isTyping) => set({ isTyping }),
  
  clearChat: () => set({ 
    messages: [{ role: 'model', text: 'Hi! I am Hannah ✨ How can I help you with Prachify today? 💖' }],
    isTyping: false 
  }),
}));

export default useChatStore;
