import { Message } from '../components/SharedUI';

export interface ChatSession {
  _id: string;
  title: string;
  isPinned?: boolean;
  messages: Message[];
  updatedAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const STORAGE_KEY = 'as_chatai_local_chats';

class ChatService {
  private isOnline = true;

  constructor() {
    this.checkHealth();
  }

  private async checkHealth() {
    try {
      const res = await fetch(`${API_URL}/api/chats`, { method: 'HEAD' });
      this.isOnline = res.ok;
    } catch {
      this.isOnline = false;
    }
    console.log(`ChatService initialized in ${this.isOnline ? 'ONLINE' : 'OFFLINE'} mode`);
  }

  async getChats(): Promise<ChatSession[]> {
    if (this.isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/chats`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API Fetch failed, falling back to local storage', err);
        this.isOnline = false;
      }
    }

    const localData = localStorage.getItem(STORAGE_KEY);
    return localData ? JSON.parse(localData) : [];
  }

  async getChat(id: string): Promise<ChatSession | null> {
    if (this.isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/chats/${id}`);
        if (res.ok) return await res.json();
      } catch (err) {
        this.isOnline = false;
      }
    }

    const chats = await this.getChats();
    return chats.find(c => c._id === id) || null;
  }

  async createChat(messages: Message[] = []): Promise<ChatSession> {
    const title = messages.length > 0 && messages[0].role === 'user' 
      ? messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '')
      : 'New Chat';

    if (this.isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/chats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, title })
        });
        if (res.ok) return await res.json();
      } catch (err) {
        this.isOnline = false;
      }
    }

    const newChat: ChatSession = {
      _id: Date.now().toString(),
      title,
      messages,
      isPinned: false,
      updatedAt: new Date().toISOString()
    };

    const chats = await this.getChats();
    const updatedChats = [newChat, ...chats];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedChats));
    return newChat;
  }

  async saveMessage(chatId: string, message: Message): Promise<ChatSession | null> {
    if (this.isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        if (res.ok) return await res.json();
      } catch (err) {
        this.isOnline = false;
      }
    }

    const chats = await this.getChats();
    const chatIndex = chats.findIndex(c => c._id === chatId);
    if (chatIndex === -1) return null;

    const chat = chats[chatIndex];
    chat.messages.push(message);
    chat.updatedAt = new Date().toISOString();

    // Update title if it's the first message
    if (chat.messages.length === 1 && message.role === 'user' && chat.title === 'New Chat') {
      chat.title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    return chat;
  }

  async updateChat(chatId: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
    if (this.isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        this.isOnline = false;
      }
    }

    const chats = await this.getChats();
    const chatIndex = chats.findIndex(c => c._id === chatId);
    if (chatIndex === -1) return null;

    const updatedChat = { ...chats[chatIndex], ...updates, updatedAt: new Date().toISOString() };
    chats[chatIndex] = updatedChat;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    return updatedChat;
  }

  async deleteChat(chatId: string): Promise<boolean> {
    if (this.isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/chats/${chatId}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        this.isOnline = false;
      }
    }

    const chats = await this.getChats();
    const filteredChats = chats.filter(c => c._id !== chatId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredChats));
    return true;
  }

  getMode() {
    return this.isOnline ? 'Online' : 'Local';
  }
}

export const chatService = new ChatService();
