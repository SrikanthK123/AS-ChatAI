import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Make sure to npm install node-fetch@2

dotenv.config(); // Loads .env in production, fallback to .env.local handled by developer

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// CORS configuration - Allow your GitHub Pages domain
app.use(cors({
  origin: '*', // For production, replace with your GitHub Pages URL
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// MongoDB Connection
if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in environment variables!');
} else {
  mongoose.set('debug', process.env.NODE_ENV !== 'production');
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
}

// Schemas
const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  reasoning: String,
  reasoning_details: String,
  images: [String],
  timestamp: { type: String, default: () => new Date().toISOString() }
});

const ChatSchema = new mongoose.Schema({
  title: { type: String, default: 'New Chat' },
  isPinned: { type: Boolean, default: false },
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Chat = mongoose.model('Chat', ChatSchema);

// --- AI PROXY ENDPOINTS ---
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, model, systemInstruction } = req.body;
    if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'API key not configured' });

    const finalMessages = [...messages];
    if (systemInstruction) finalMessages.unshift({ role: 'system', content: systemInstruction });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://srikanthk123.github.io/AS-ChatAI/",
        "X-Title": "AS-ChatAI",
      },
      body: JSON.stringify({
        model: model || "google/gemma-2-9b-it:free",
        messages: finalMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to process AI chat' });
  }
});

app.post('/api/ai/stream', async (req, res) => {
  try {
    const { messages, model } = req.body;

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key not configured on server' });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://srikanthk123.github.io/AS-ChatAI/",
        "X-Title": "AS-ChatAI",
      },
      body: JSON.stringify({
        model: model || "google/gemma-2-9b-it:free",
        messages: messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter Error:', errorData);
      return res.status(response.status).json(errorData);
    }

    // Proxy the stream back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    response.body.on('data', (chunk) => {
      res.write(chunk);
    });

    response.body.on('end', () => {
      res.end();
    });

    req.on('close', () => {
      // Handle client disconnect if needed
    });

  } catch (err) {
    console.error('AI Stream Error:', err);
    res.status(500).json({ error: 'Failed to process AI stream' });
  }
});

// --- CHAT ENDPOINTS ---
app.get('/api/chats', async (req, res) => {
  try {
    const chats = await Chat.find().sort({ isPinned: -1, updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/api/chats/:id', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    let title = req.body.title || 'New Chat';
    const messages = req.body.messages || [];

    if (title === 'New Chat' && messages.length > 0 && messages[0].role === 'user') {
      title = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '');
    }

    const newChat = new Chat({ title, messages });
    const savedChat = await newChat.save();
    res.status(201).json(savedChat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

app.patch('/api/chats/:id', async (req, res) => {
  try {
    const { title, isPinned } = req.body;
    const update: any = {};
    if (title !== undefined) update.title = title;
    if (isPinned !== undefined) update.isPinned = isPinned;
    
    const updatedChat = await Chat.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updatedChat) return res.status(404).json({ error: 'Chat not found' });
    res.json(updatedChat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

app.post('/api/chats/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    chat.messages.push(message);
    
    if (chat.messages.length === 1 && message.role === 'user' && chat.title === 'New Chat') {
      chat.title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
    }
    
    await chat.save();
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

app.delete('/api/chats/:id', async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chat deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
