import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/AS-ChatAI';

app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

mongoose.set('debug', true);
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  reasoning: String,
  reasoning_details: String,
  images: [String],
  timestamp: String
});

const ChatSchema = new mongoose.Schema({
  title: { type: String, default: 'New Chat' },
  isPinned: { type: Boolean, default: false },
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', ChatSchema);

// Get all chats
app.get('/api/chats', async (req, res) => {
  try {
    const chats = await Chat.find().sort({ isPinned: -1, updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get a specific chat
app.get('/api/chats/:id', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Create a new chat
app.post('/api/chats', async (req, res) => {
  try {
    let title = req.body.title || 'New Chat';
    const messages = req.body.messages || [];

    if (title === 'New Chat' && messages.length > 0 && messages[0].role === 'user') {
      const baseTitle = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '');
      let finalTitle = baseTitle;
      let counter = 1;
      while (await Chat.findOne({ title: finalTitle }) && counter < 100) {
        finalTitle = `${baseTitle} ${counter}`;
        counter++;
      }
      title = finalTitle;
    }

    const newChat = new Chat({
      title,
      messages
    });
    const savedChat = await newChat.save();
    console.log('New chat created:', savedChat._id, savedChat.title);
    res.status(201).json(savedChat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Update a chat (rename, pin, etc.)
app.patch('/api/chats/:id', async (req, res) => {
  try {
    const { title, isPinned } = req.body;
    console.log('PATCH request for ID:', req.params.id);
    const update: any = { updatedAt: new Date() };
    if (title !== undefined) update.title = title;
    if (isPinned !== undefined) update.isPinned = isPinned;
    
    const updatedChat = await Chat.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updatedChat) {
      console.log('Chat NOT found in DB. Searching all chats...');
      const allChats = await Chat.find({}, '_id');
      console.log('Available IDs in DB:', allChats.map(c => c._id.toString()));
      return res.status(404).json({ error: 'Chat not found' });
    }
    console.log('Chat updated:', updatedChat.title);
    res.json(updatedChat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Update a chat (add messages)
app.post('/api/chats/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    chat.messages.push(message);
    chat.updatedAt = new Date();
    
    // If it's the first user message and title is still default, update title
    if (chat.messages.length === 1 && message.role === 'user' && chat.title === 'New Chat') {
      const baseTitle = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
      let finalTitle = baseTitle;
      let counter = 1;
      
      while (await Chat.findOne({ title: finalTitle, _id: { $ne: chat._id } }) && counter < 100) {
        finalTitle = `${baseTitle} ${counter}`;
        counter++;
      }
      chat.title = finalTitle;
    }
    
    await chat.save();
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete a chat
app.delete('/api/chats/:id', async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chat deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
