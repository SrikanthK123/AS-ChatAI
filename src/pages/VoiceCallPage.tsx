import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneOff, Mic, MicOff, Volume2, Power, MessageSquare, MessageSquareOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getChatResponse } from '../services/gemini';

// Types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

const VoiceCallPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string, id: number }[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [callLanguage, setCallLanguage] = useState<'en-US' | 'te-IN' | 'hi-IN'>('en-US');
  const [showTranscript, setShowTranscript] = useState(true);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const messageIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInterruptedRef = useRef(false);
  const shouldListenRef = useRef(false);
  const isAuraSpeakingRef = useRef(false);
  const lastAuraSpeechEndTime = useRef(0);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Visualizer Animation
  useEffect(() => {
    let animationFrameId: number;
    const updateVolume = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average * 1.5); // Boost for visibility
      } else if (!isSpeaking) {
        setAudioLevel(0);
      }
      animationFrameId = requestAnimationFrame(updateVolume);
    };
    updateVolume();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSpeaking]);

  const addMessage = (role: 'user' | 'ai', text: string) => {
    setMessages(prev => {
      const newMsg = { role, text, id: messageIdRef.current++ };
      const next = [...prev, newMsg];
      return next.slice(-4); 
    });
  };

  const stopAISpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    isAuraSpeakingRef.current = false;
  };

  const playAIAudio = async (text: string) => {
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Detect language based on character ranges
      const isTelugu = /[\u0C00-\u0C7F]/.test(text);
      const isHindi = /[\u0900-\u097F]/.test(text);
      
      let targetLang = 'en-US';
      if (isTelugu) targetLang = 'te-IN';
      else if (isHindi) targetLang = 'hi-IN';

      const preferredVoice = voices.find(v => v.lang === targetLang && v.name.includes('Google')) || 
                             voices.find(v => v.lang === targetLang) ||
                             voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                             voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
      }
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        isAuraSpeakingRef.current = true;
        const interval = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            setAudioLevel(30 + Math.random() * 40);
          } else {
            clearInterval(interval);
          }
        }, 50);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        lastAuraSpeechEndTime.current = Date.now();
        
        // Add a 1.5-second delay before allowing listening again to ensure ALL echo is gone
        setTimeout(() => {
          isAuraSpeakingRef.current = false;
          console.log("Aura speech finished, cooldown over. Restarting listener.");
          if (shouldListenRef.current && !isInterruptedRef.current) {
            startListening();
          }
          isInterruptedRef.current = false;
        }, 1500);
      };

      utterance.onerror = (err) => {
        console.error("SpeechSynthesis Error:", err);
        setIsSpeaking(false);
        if (shouldListenRef.current) startListening();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Audio Playback Error:", err);
      setIsSpeaking(false);
      if (shouldListenRef.current) startListening();
    }
  };

  const processUserSpeech = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    // Safety check: Ignore if Aura just finished speaking less than 1.5s ago
    if (Date.now() - lastAuraSpeechEndTime.current < 1500) {
      console.log("Discarding late speech result to prevent feedback loop.");
      return;
    }

    addMessage('user', transcript);
    setInterimTranscript('');
    stopListening();
    setStatus('connected'); 
    
    try {
      const langNames = { 'en-US': 'English', 'te-IN': 'Telugu', 'hi-IN': 'Hindi' };
      const response = await getChatResponse([
        ...messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.text }) as any),
        { role: 'user', content: transcript }
      ], `You are Aura, a helpful AI assistant in a voice call. 
      The current language is ${langNames[callLanguage]}. 
      RULES:
      1. Keep your responses extremely concise (1-2 sentences maximum).
      2. If and only if the user explicitly asks for a 'detailed explanation' or 'deep explanation', then you may provide a longer, detailed response.
      3. Speak naturally in ${langNames[callLanguage]}.`);
      
      const aiText = response.content || "I'm sorry, I couldn't process that.";
      addMessage('ai', aiText);
      await playAIAudio(aiText);
    } catch (err) {
      console.error("Gemini Error:", err);
      startListening();
    }
  };

  const startListening = () => {
    if (isMuted || !shouldListenRef.current || isAuraSpeakingRef.current || window.speechSynthesis.speaking) return;
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = callLanguage;

      recognition.onstart = () => {
        setIsListening(true);
        console.log("New Recognition Instance Started");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // MULTI-LAYER GUARD: Ignore if AI is speaking or just finished
        if (isAuraSpeakingRef.current || window.speechSynthesis.speaking || (Date.now() - lastAuraSpeechEndTime.current < 2000)) {
          return;
        }

        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }

        if (finalTranscript) {
          if (isAuraSpeakingRef.current || window.speechSynthesis.speaking || (Date.now() - lastAuraSpeechEndTime.current < 2000)) return;
          setInterimTranscript('');
          processUserSpeech(finalTranscript);
        } else if (interimTranscript) {
          setInterimTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (event.error === 'network' || event.error === 'no-speech') {
          setTimeout(() => {
            if (shouldListenRef.current && !isAuraSpeakingRef.current && !isMuted) startListening();
          }, 1000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Restart only if we should be listening and AI is silent
        if (shouldListenRef.current && !isAuraSpeakingRef.current && !isMuted && !window.speechSynthesis.speaking) {
          setTimeout(startListening, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Start Listening Error:", err);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent auto-restart
        recognitionRef.current.abort();
      } catch (err) {}
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  const handleStartCall = async () => {
    setStatus('connecting');
    setErrorMsg(null);
    shouldListenRef.current = true;

    try {
      setStatus('connected');
      
      // Start microphone visualizer
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
        
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      } catch (micErr) {
        console.warn("Mic visualizer failed:", micErr);
      }

      const greeting = "Hello! I'm Aura. How can I help you today?";
      addMessage('ai', greeting);
      playAIAudio(greeting);

    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize voice system.");
      setStatus('idle');
    }
  };

  const handleEndCall = () => {
    shouldListenRef.current = false;
    stopListening();
    stopAISpeaking();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    navigate('/chats');
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (!isSpeaking) startListening();
    } else {
      setIsMuted(true);
      stopListening();
    }
  };

  let visualStatus = 'Ready to Connect';
  if (status === 'connecting') visualStatus = 'Establishing Link...';
  else if (status === 'connected') {
    if (isSpeaking) visualStatus = 'Aura is speaking';
    else if (isListening) {
      if (isMuted) visualStatus = 'Line Muted';
      else visualStatus = interimTranscript ? `Listening: "${interimTranscript}..."` : 'Aura is listening';
    }
    else visualStatus = 'Processing...';
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden font-sans text-white"
    >
      {/* Premium Dark Aura Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08)_0%,transparent_70%)]" />
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-aura-purple/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-aura-orange/5 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="absolute top-12 flex flex-col items-center gap-1 z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status === 'connected' ? "bg-teal-500 animate-pulse" : status === 'connecting' ? "bg-yellow-500 animate-pulse" : "bg-red-500"
          )} />
          <span className="text-white/40 text-[11px] font-black uppercase tracking-[0.3em]">
            {status}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase">Aura Voice</h1>
      </div>

      {/* Center Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto py-10 relative z-10">
        <AnimatePresence mode="wait">
          {status === 'idle' ? (
            <motion.div
              key="start-screen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-8"
            >
              <button
                onClick={handleStartCall}
                className="relative group flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white/5 border border-white/10 shadow-[0_0_80px_rgba(139,92,246,0.2)] hover:shadow-[0_0_100px_rgba(139,92,246,0.4)] hover:bg-white/10 transition-all duration-500"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-aura-purple to-aura-orange opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
                <Power className="w-12 h-12 text-white/80 group-hover:text-white transition-colors" />
              </button>
              <div className="text-center">
                <p className="text-xl font-medium text-white/90">Initialize Connection</p>
                <p className="text-sm text-white/50 mt-2">Tap to start voice protocol</p>
              </div>
              {errorMsg && (
                <p className="text-red-400 text-sm mt-4 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                  {errorMsg}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="active-call"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-full mb-12">
                <motion.div
                  animate={{
                    scale: isSpeaking ? [1, 1.15, 1] : isListening ? [1, 1.05, 1] : 1,
                    opacity: [0.8, 1, 0.8],
                    filter: ["hue-rotate(0deg)", "hue-rotate(30deg)", "hue-rotate(0deg)"]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-40 h-40 sm:w-60 sm:h-60 rounded-full aura-logo-gradient relative z-10 flex flex-col items-center justify-center shadow-[0_0_80px_rgba(139,92,246,0.4)] border border-white/20"
                />

                {/* Pulse Rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[1.3, 1.6, 1.9].map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{
                        scale: s + (audioLevel / 100),
                        opacity: [0, 0.12, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.7 }}
                      className="absolute w-40 h-40 sm:w-60 sm:h-60 rounded-full border border-white/10"
                    />
                  ))}
                </div>
              </div>

              {/* Transcript Area - YouTube Live Stream Style (Left Side) */}
              <AnimatePresence>
                {showTranscript && (
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="absolute left-0 top-[15%] bottom-[25%] w-full max-w-[360px] flex flex-col justify-end overflow-hidden z-10 pointer-events-none px-6 md:px-12"
                  >
                    <div className="w-full flex flex-col gap-3 overflow-y-auto no-scrollbar scroll-smooth pointer-events-auto pb-4">
                      <AnimatePresence mode="popLayout">
                        {messages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={cn(
                              "flex flex-col gap-1 max-w-full px-5 py-3 rounded-2xl backdrop-blur-3xl border shadow-2xl transition-all duration-500",
                              msg.role === 'ai'
                                ? "bg-gradient-to-br from-black via-black/95 to-orange-500/10 border-orange-500/20 shadow-orange-500/10"
                                : "bg-gradient-to-br from-black via-black/95 to-cyan-500/10 border-cyan-500/20 shadow-cyan-500/10"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-[0.2em]",
                                msg.role === 'ai' ? "text-orange-400" : "text-cyan-400"
                              )}>
                                {msg.role === 'ai' ? 'AURA' : 'YOU'}
                              </span>
                            </div>
                            <p className="text-[13px] leading-relaxed text-white/80 font-medium">
                              {msg.text}
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Text (Below Sphere) */}
              <motion.span
                key={visualStatus}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em] text-center mt-8"
              >
                {visualStatus}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar */}
      <AnimatePresence>
        {status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-12 w-full max-w-sm flex items-center justify-around z-10"
          >
            <button
              onClick={() => {
                if (isSpeaking) {
                  stopAISpeaking();
                  startListening();
                } else {
                  toggleMute();
                }
              }}
              className={cn(
                "p-6 rounded-full transition-all duration-300 border relative overflow-hidden",
                isSpeaking 
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-500" 
                  : isMuted 
                    ? "bg-red-500/10 border-red-500/20 text-red-500" 
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
              )}
            >
              <AnimatePresence mode="wait">
                {isSpeaking ? (
                  <motion.div
                    key="stop"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Power className="w-7 h-7 rotate-45" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mic"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                  </motion.div>
                )}
              </AnimatePresence>
              {isSpeaking && (
                <span className="absolute bottom-1 text-[8px] font-bold uppercase tracking-tighter w-full text-center left-0">STOP AI</span>
              )}
            </button>

            <button
              onClick={handleEndCall}
              className="p-8 rounded-full bg-red-600 text-white shadow-[0_0_50px_rgba(239,68,68,0.5)] hover:scale-110 active:scale-95 transition-all"
            >
              <PhoneOff className="w-8 h-8" />
            </button>

            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={cn(
                "p-6 rounded-full transition-all duration-300 border",
                showTranscript ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
              )}
            >
              {showTranscript ? <MessageSquare className="w-7 h-7" /> : <MessageSquareOff className="w-7 h-7" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language Selector & Back button */}
      <div className="absolute top-12 left-6 sm:left-12 flex flex-col items-start gap-3 z-20">
        {status === 'idle' && (
          <button
            onClick={() => navigate('/chats')}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Back to Chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        
        {status === 'idle' && (
          <div className="flex gap-2">
            {[
              { id: 'en-US', label: 'English' },
              { id: 'hi-IN', label: 'Hindi' },
              { id: 'te-IN', label: 'Telugu' }
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setCallLanguage(lang.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                  callLanguage === lang.id 
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" 
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VoiceCallPage;
