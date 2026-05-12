import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { VisualAura } from './components/SharedUI';
import OnboardingPage from './pages/OnboardingPage';
import ChatPage from './pages/ChatPage';
import VoiceCallPage from './pages/VoiceCallPage';

import { ConversationProvider } from '@elevenlabs/react';

export default function App() {
  return (
    <Router>
      <main className="h-screen w-full mesh-gradient relative font-sans overflow-hidden">
        <VisualAura />
        
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<OnboardingPage />} />
            <Route path="/chats" element={<ChatPage />} />
            <Route path="/voice-call" element={<VoiceCallPage />} />
          </Routes>
        </AnimatePresence>
      </main>
    </Router>
  );
}
