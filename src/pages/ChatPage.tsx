import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Send, Plus, Menu, Edit3, X, Sparkles, User, Image as ImageIcon, Copy, Check, ChevronRight, Camera, FileText as FileText, Phone, Pin, PinOff, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { getChatResponseStream } from '../services/gemini';
import { Message, ImageModal, GalaxyEarthBackground, MouseBrush, BackgroundText } from '../components/SharedUI';
import { chatService, ChatSession } from '../services/chatService';

const Header = ({ onNewChat, onToggleSidebar }: { onNewChat: () => void; onToggleSidebar?: () => void }) => {
  const navigate = useNavigate();
  
  return (
    <header className="flex items-center justify-between px-6 py-4 fixed top-0 w-full z-50 backdrop-blur-xl bg-black/80 border-b border-white/5">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
      >
        <Menu className="w-5 h-5 text-white/70" />
      </button>

      <div className="flex items-center gap-3 bg-white/5 px-5 py-2 rounded-full border border-white/10 shadow-inner group/pill cursor-pointer hover:bg-white/10 transition-all">
        <div className="w-3.5 h-3.5 rounded-full aura-logo-gradient shadow-lg" />
        <span className="text-xs font-black text-white/90 tracking-[0.2em] uppercase flex items-center gap-2">
          AS-ChatAI
          <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover/pill:translate-x-0.5 transition-transform" />
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate('/voice-call')}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          title="Voice Conversation"
        >
          <Phone className="w-5 h-5" />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          title="New Chat"
        >
          <Edit3 className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

const ClickableSentence = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      onClick={handleCopy}
      className={cn("clickable-highlight", copied && "copied")}
    >
      {children}
    </span>
  );
};

const getImpactfulSentences = (text: string) => {
  if (!text) return [];
  // Split by sentences or newlines, filter by length > 60, sort by length, take top 3
  return text.split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 60)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
};

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const flattenChildren = (children: React.ReactNode): string => {
  return React.Children.toArray(children).reduce<string>((acc, child) => {
    if (typeof child === 'string' || typeof child === 'number') return `${acc}${child}`;
    if (React.isValidElement(child) && (child.props as any).children) {
      return `${acc}${flattenChildren((child.props as any).children)}`;
    }
    return acc;
  }, '');
};

const ImpactfulWrapper = ({ children, impactfulSentences }: { children: React.ReactNode, impactfulSentences: string[] }) => {
  const content = flattenChildren(children);
  const normalizedContent = normalize(content);

  const isImpactful = impactfulSentences.some(imp => {
    const normalizedImp = normalize(imp);
    return normalizedImp.length > 50 && (normalizedContent.includes(normalizedImp) || normalizedImp.includes(normalizedContent));
  });

  const handleCopy = (e: React.MouseEvent) => {
    if (!isImpactful) return;
    e.stopPropagation();
    navigator.clipboard.writeText(content.trim());
    const target = e.currentTarget as HTMLElement;
    target.classList.add('copied');
    setTimeout(() => target.classList.remove('copied'), 2000);
  };

  return (
    <span 
      onClick={isImpactful ? handleCopy : undefined}
      className={cn(isImpactful && "clickable-highlight block w-fit")}
    >
      {children}
    </span>
  );
};

const ChatMessage = ({
  message,
  onEdit,
  onRegenerate,
  onImageClick,
  isStreaming = false
}: {
  message: Message;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
  onImageClick?: (url: string) => void;
  isStreaming?: boolean;
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const impactfulSentences = React.useMemo(() => 
    isUser ? [] : getImpactfulSentences(message.content), 
    [message.content, isUser]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 sm:gap-4 w-full mb-8 relative group max-w-4xl mx-auto px-1",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className="flex-shrink-0 relative">
        {isUser ? (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shadow-xl flex items-center justify-center transition-transform group-hover:scale-105">
            <User className="w-5 h-5 text-white/50" />
          </div>
        ) : (
          <div className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-full aura-logo-gradient shadow-lg border border-white/20 flex items-center justify-center transition-all group-hover:scale-105",
            isStreaming && "animate-pulse scale-110 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
          )}>
            <Sparkles className={cn("w-5 h-5 text-white", isStreaming && "animate-spin-slow")} />
          </div>
        )}
      </div>

      <div className={cn(
        "flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]",
        isUser ? "items-end" : "items-start"
      )}>
        {isStreaming && !message.content && !isUser && (
          <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-aura-purple/10 border border-aura-purple/20 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-aura-purple animate-pulse">Thinking</span>
          </div>
        )}
        {message.content && (
          <div
            className={cn(
              "relative py-2.5 px-4 sm:py-3.5 sm:px-6 rounded-[22px] sm:rounded-[26px] shadow-lg border group/bubble",
              isUser
                ? "bg-white text-zinc-950 rounded-tr-none border-zinc-100"
                : "bg-gradient-to-br from-white/10 via-white/[0.08] to-transparent text-white/95 rounded-tl-none border-white/10 backdrop-blur-md"
            )}
          >
            {message.reasoning && (
              <div className="mb-3 pb-3 border-b border-white/5">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center justify-between w-full mb-2 group/reasoning"
                >
                  <div className="flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
                    <Sparkles className="w-3 h-3" />
                    Thinking Process
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="p-1 rounded-full bg-white/5 text-white/20 group-hover/reasoning:text-white transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 rotate-90" />
                  </motion.div>
                </button>
                <div className={cn(
                  "text-white/40 text-[13px] italic leading-relaxed overflow-hidden transition-all duration-500",
                  isExpanded ? "max-h-[1000px] opacity-100" : "max-h-16 opacity-50"
                )}>
                  <ReactMarkdown>{message.reasoning}</ReactMarkdown>
                </div>
              </div>
            )}

            <div className={cn(
              "markdown-body text-[14px] sm:text-[15px] leading-relaxed",
              isUser ? "text-zinc-950 font-medium" : "text-white/90",
              isStreaming && "text-streaming"
            )}>
              {(!message.content && isStreaming) ? (
                <div className="space-y-2 py-2">
                  <div className="h-4 w-[90%] rounded-full bg-white/5 animate-shimmer" />
                  <div className="h-4 w-[75%] rounded-full bg-white/5 animate-shimmer [animation-delay:200ms]" />
                  <div className="h-4 w-[85%] rounded-full bg-white/5 animate-shimmer [animation-delay:400ms]" />
                </div>
              ) : (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-4 last:mb-0">
                        <ImpactfulWrapper impactfulSentences={impactfulSentences}>
                          {children}
                        </ImpactfulWrapper>
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc ml-6 mb-4 space-y-2">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal ml-6 mb-4 space-y-2">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="pl-1">
                        <ImpactfulWrapper impactfulSentences={impactfulSentences}>
                          {children}
                        </ImpactfulWrapper>
                      </li>
                    )
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        )}

        {message.images && message.images.length > 0 && (
          <div className={cn("flex flex-wrap gap-3 mt-1", isUser ? "justify-end" : "justify-start")}>
            <div className={isUser ? "grid grid-cols-2 gap-2 max-w-sm" : "relative mt-2"}>
              {message.images.map((img, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "rounded-2xl overflow-hidden border border-white/10 shadow-xl group/img relative cursor-pointer",
                    isUser ? "aspect-square w-32 sm:w-40" : "w-48 h-48 sm:w-64 sm:h-64 rounded-3xl border-4 shadow-2xl bg-zinc-900 transition-transform hover:scale-[1.02]"
                  )}
                  onClick={() => onImageClick?.(img)}
                >
                  <img src={img} alt={`Img ${i}`} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white scale-75 group-hover/img:scale-100 transition-transform duration-300" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-2 mt-2 px-1 w-full", isUser ? "justify-end" : "justify-start")}>
          {!isStreaming && message.content && (
            <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 opacity-100">
              <button onClick={handleCopy} title="Copy" className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
                {copied ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
              </button>
              {!isUser && (
                <>
                  <button onClick={onRegenerate} title="Regenerate" className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
                    <Sparkles className="w-4 h-4" />
                  </button>
                </>
              )}
              {isUser && (
                <button onClick={() => onEdit?.(message.content)} title="Edit" className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          {(!isStreaming || isUser) && (
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest leading-none whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-500">{message.timestamp}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [chatToDelete, setChatToDelete] = useState<ChatSession | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isBackendDown, setIsBackendDown] = useState(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        stopListening();
      };

      recognitionRef.current.onend = () => {
        stopListening();
      };
    }

    fetchChats();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const fetchChats = async () => {
    const data = await chatService.getChats();
    setChats(data.sort((a, b) => (Number(!!b.isPinned) - Number(!!a.isPinned)) || (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())));
    setIsBackendDown(chatService.getMode() === 'Local' && !localStorage.getItem('as_chatai_local_chats'));
  };

  const loadChat = async (chatId: string) => {
    const data = await chatService.getChat(chatId);
    if (data) {
      setMessages(data.messages);
      setCurrentChatId(chatId);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const createChat = async (initialMessages: Message[] = []) => {
    const data = await chatService.createChat(initialMessages);
    setChats(prev => [data, ...prev]);
    setCurrentChatId(data._id);
    return data._id;
  };

  const saveMessage = async (chatId: string, message: Message) => {
    await chatService.saveMessage(chatId, message);
    fetchChats();
  };

  const deleteChat = async (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setChatToDelete(chat);
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;
    await chatService.deleteChat(chatToDelete._id);
    setChats(prev => prev.filter(c => c._id !== chatToDelete._id));
    if (currentChatId === chatToDelete._id) {
      setMessages([]);
      setCurrentChatId(null);
    }
    setChatToDelete(null);
  };

  const togglePin = async (e: React.MouseEvent, chatId: string, isPinned: boolean) => {
    e.stopPropagation();
    const updated = await chatService.updateChat(chatId, { isPinned: !isPinned });
    if (updated) {
      setChats(prev => prev.map(c => c._id === chatId ? updated : c).sort((a, b) => (Number(!!b.isPinned) - Number(!!a.isPinned)) || (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())));
    }
  };

  const handleRename = async (chatId: string) => {
    if (!renamingValue.trim()) {
      setRenamingChatId(null);
      return;
    }
    const updated = await chatService.updateChat(chatId, { title: renamingValue });
    if (updated) {
      setChats(prev => 
        prev.map(c => c._id === chatId ? updated : c)
        .sort((a, b) => (Number(!!b.isPinned) - Number(!!a.isPinned)) || (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
      );
    }
    setRenamingChatId(null);
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setAudioLevel(average);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      recognitionRef.current?.start();
      setIsListening(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setAudioLevel(0);
    setIsListening(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) stopListening();
    else startListening();
  };

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() && attachments.length === 0) return;
    if (isTyping) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    if (editingMessageId) setEditingMessageId(null);
    setIsPlusMenuOpen(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      images: attachments.map(a => a.url),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let chatId = currentChatId;
    if (!chatId) {
      chatId = await createChat([userMessage]);
    } else {
      await saveMessage(chatId, userMessage);
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsTyping(true);

    const modelMessageId = (Date.now() + 1).toString();
    const modelMessage: Message = {
      id: modelMessageId, role: 'model', content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, modelMessage]);

    let fullContent = '';
    let reasoning = '';
    let reasoning_details = '';

    try {
      const history: any[] = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content,
        reasoning_details: m.reasoning_details
      }));
      history.push({ role: 'user', content: textToSend });

      const stream = getChatResponseStream(history);

      for await (const chunk of stream) {
        if (chunk.type === 'content') fullContent += chunk.value;
        else if (chunk.type === 'reasoning') reasoning += chunk.value;
        else if (chunk.type === 'reasoning_details') reasoning_details = chunk.value;

        setMessages(prev => prev.map(m =>
          m.id === modelMessageId ? { ...m, content: fullContent, reasoning: reasoning || undefined, reasoning_details: reasoning_details || undefined } : m
        ));
      }

      // Save the final model message to DB
      if (chatId) {
        await saveMessage(chatId, {
          ...modelMessage,
          content: fullContent,
          reasoning: reasoning || undefined,
          reasoning_details: reasoning_details || undefined
        });
      }
    } catch (err) { console.error(err); }
    finally { setIsTyping(false); }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentChatId(null);
  };

  return (
    <div 
      className="h-full flex flex-col md:flex-row w-full max-w-[1600px] mx-auto md:p-4 lg:p-6 relative overflow-hidden group/chat-root"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        window.dispatchEvent(new CustomEvent('bg-mouse-move', { detail: { x, y } }));
      }}
    >
      <GalaxyEarthBackground />
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <MouseBrush />
        <BackgroundText />
      </div>
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? (window.innerWidth < 768 ? '100%' : 300) : 0, opacity: isSidebarOpen ? 1 : 0, x: isSidebarOpen ? 0 : -20 }}
        className={cn("flex flex-col h-full glass-dark overflow-hidden border-white/10 z-[100] fixed inset-0 md:relative md:inset-auto md:rounded-[32px] md:mr-4 md:border", !isSidebarOpen && "pointer-events-none")}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full aura-logo-gradient" />
              <span className="font-bold text-lg text-white">AS-ChatAI</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Plus className="w-6 h-6 rotate-45 text-white/50" />
            </button>
          </div>
          <button 
            onClick={clearChat} 
            className="w-full py-4 px-5 rounded-2xl border bg-white/5 border-white/10 hover:bg-white/10 text-white transition-all flex items-center gap-3 mb-8 font-bold text-base sm:text-sm shadow-lg group/newchat"
          >
            <Plus className="w-5 h-5 transition-transform group-hover/newchat:rotate-90" />
            New Chat
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4 px-2">History</div>
            <div className="space-y-1">
              {chats.map((chat) => (
                <div key={chat._id} className="relative group/item">
                  <div
                    onClick={() => loadChat(chat._id)}
                    className={cn(
                      "w-full text-left p-4 sm:p-3.5 rounded-2xl transition-all group flex items-center justify-between min-h-[56px] sm:min-h-0 relative overflow-hidden border border-transparent cursor-pointer",
                      currentChatId === chat._id ? "bg-white/10 border-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "text-white/50 hover:bg-white/[0.08] hover:border-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      {chat.isPinned ? (
                        <Pin className="w-4 h-4 text-aura-orange flex-shrink-0 fill-aura-orange" />
                      ) : (
                        <FileText className="w-4.5 h-4.5 flex-shrink-0" />
                      )}
                      
                      {renamingChatId === chat._id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            autoFocus
                            value={renamingValue}
                            onChange={(e) => setRenamingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(chat._id);
                              if (e.key === 'Escape') setRenamingChatId(null);
                            }}
                            className="bg-zinc-800 border border-white/20 rounded px-1.5 py-0.5 text-xs w-full text-white outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRename(chat._id);
                              }}
                              className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingChatId(null);
                              }}
                              className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-base sm:text-sm truncate font-semibold flex-1">{chat.title}</span>
                          <div className="flex items-center gap-3 lg:gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all ml-4 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingChatId(chat._id);
                                setRenamingValue(chat.title);
                              }}
                              className="p-1.5 lg:p-1 hover:bg-white/10 rounded-md text-white/30 hover:text-white transition-colors"
                              title="Rename"
                            >
                              <Edit3 className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                            </button>
                            <button
                              onClick={(e) => togglePin(e, chat._id, !!chat.isPinned)}
                              className={cn(
                                "p-1.5 lg:p-1 hover:bg-white/10 rounded-md transition-colors",
                                chat.isPinned ? "text-aura-orange" : "text-white/30 hover:text-white"
                              )}
                              title={chat.isPinned ? "Unpin" : "Pin"}
                            >
                              {chat.isPinned ? <PinOff className="w-4 h-4 lg:w-3.5 lg:h-3.5" /> : <Pin className="w-4 h-4 lg:w-3.5 lg:h-3.5" />}
                            </button>
                            <button
                              onClick={(e) => deleteChat(e, chat)}
                              className="p-1.5 lg:p-1 hover:bg-white/10 rounded-md text-white/30 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <X className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {chats.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-xs text-white/20 font-medium">No recent chats</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col glass-dark md:rounded-[32px] border-white/10 relative overflow-hidden h-full">
        <div className="h-full flex flex-col relative overflow-hidden">
          <Header onNewChat={clearChat} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

          <AnimatePresence>
            {isTyping && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 1 }}
                  className="absolute top-[-10%] right-[-10%] w-[60%] h-[120%] bg-aura-orange/15 rounded-full blur-[120px] pointer-events-none z-0"
                />
                {/* Loading Line - Fixed below header */}
                <div className="fixed top-[72px] left-0 w-full h-[1px] z-[60] overflow-hidden">
                  <div className="w-full h-full aura-logo-gradient animate-shimmer opacity-80" />
                </div>
              </>
            )}
          </AnimatePresence>


          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-32 custom-scrollbar relative">
            <div className="absolute top-[-20%] right-[-10%] w-96 h-96 aura-logo-gradient rounded-full blur-[120px] opacity-[0.03] pointer-events-none" />

            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 flex flex-col items-center justify-start text-center px-4 sm:px-8 pb-20 pt-8 sm:pt-12 relative"
                >
                  {/* Scattered Prompt Cards (Desktop) */}
                  <div className="hidden lg:contents">
                    {[
                      { icon: <Sparkles className="w-4 h-4" />, text: "Explain Quantum Physics simply", rot: -12, x: "6%", y: "12%" },
                      { icon: <Edit3 className="w-4 h-4" />, text: "Write a short sci-fi story", rot: 8, x: "18%", y: "52%" },
                      { icon: <Plus className="w-4 h-4" />, text: "Solve a complex math equation", rot: 10, x: "80%", y: "15%" },
                      { icon: <ChevronRight className="w-4 h-4" />, text: "Plan a 3-day trip to Tokyo", rot: -8, x: "70%", y: "48%" }
                    ].map((p, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, scale: 0.8, rotate: p.rot }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          top: p.y,
                          left: p.x,
                          rotate: p.rot,
                          backgroundColor: "rgba(255,255,255,0.08)"
                        }}
                        whileHover={{
                          rotate: 0,
                          scale: 1.08,
                          zIndex: 50,
                          backgroundColor: "rgba(255,255,255,0.08)"
                        }}
                        transition={{
                          opacity: { delay: 0.5 + i * 0.1 },
                          scale: { delay: 0.5 + i * 0.1 },
                          y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut" }
                        }}
                        onClick={() => handleSend(p.text)}
                        className="absolute w-56 glass-dark border-white/5 hover:border-white/20 p-5 rounded-[28px] text-left group transition-colors shadow-2xl z-10"
                      >
                        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:aura-logo-gradient transition-all group-hover:rotate-12">
                          {p.icon}
                        </div>
                        <p className="text-[12px] font-semibold text-white/40 group-hover:text-white transition-colors leading-relaxed">{p.text}</p>
                      </motion.button>
                    ))}
                  </div>


                  <div className="relative mb-12 sm:mb-16 mt-4 sm:mt-8 group/sphere">
                    <motion.div 
                      layoutId="aura-sphere-core" 
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-40 h-40 sm:w-64 sm:h-64 rounded-full aura-logo-gradient shadow-[0_0_100px_rgba(255,138,101,0.3)] relative z-10 border border-white/10 opacity-100 overflow-hidden"
                    >
                      {/* Rotating 3D Earth Texture */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        whileHover={{ 
                          opacity: 1,
                          backgroundPosition: ["0% 50%", "100% 50%"]
                        }}
                        transition={{ 
                          opacity: { duration: 0.8 },
                          backgroundPosition: { duration: 20, repeat: Infinity, ease: "linear" }
                        }}
                        className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Earth_map_light.jpg/1200px-Earth_map_light.jpg')] bg-[length:200%_100%] bg-no-repeat"
                        style={{ backgroundSize: 'cover' }}
                      />

                      {/* 3D Sphere Shading (Inner Shadow & Highlight) */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 pointer-events-none z-20 shadow-[inset_-20px_-20px_50px_rgba(0,0,0,0.8),inset_20px_20px_50px_rgba(255,255,255,0.2)] rounded-full"
                      />

                      {/* Atmospheric Blue Tint */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 0.4 }}
                        className="absolute inset-0 bg-blue-500/20 mix-blend-overlay z-10 pointer-events-none"
                      />
                    </motion.div>

                    {/* Sphere Glow */}
                    <motion.div 
                      layoutId="aura-sphere-glow" 
                      className="absolute inset-[-40px] sm:inset-[-60px] aura-logo-gradient rounded-full blur-[80px] opacity-30 animate-pulse pointer-events-none" 
                    />
                    <motion.div 
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 0.6 }}
                      className="absolute inset-[-40px] sm:inset-[-60px] bg-blue-500 rounded-full blur-[100px] pointer-events-none transition-opacity duration-700" 
                    />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight text-white uppercase">AS-ChatAI</h2>
                  <p className="text-white/40 text-sm sm:text-base mb-12 font-medium max-w-xs mx-auto">Ask Smart ChatAI — How can I help you today?</p>

                  {/* Mobile Prompt Cards */}
                  <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                    {[
                      "Explain Quantum Physics",
                      "Write a sci-fi story",
                      "Plan a Tokyo trip",
                      "Solve a math problem"
                    ].map((text, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(text)}
                        className="glass-dark hover:bg-white/10 text-white/50 text-[13px] py-4 px-5 rounded-2xl text-left border border-white/5 transition-all active:scale-95 flex items-center justify-between group"
                      >
                        <span>{text}</span>
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (

                messages.map((m, index) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    onEdit={(content) => { setEditingMessageId(m.id); setInput(content); }}
                    onRegenerate={() => handleSend(messages[messages.indexOf(m) - 1]?.content)}
                    onImageClick={setSelectedImage}
                    isStreaming={isTyping && index === messages.length - 1 && m.role === 'model'}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-black via-black/80 to-transparent pt-12">
            <div className="max-w-4xl mx-auto relative">
              {/* Plus Menu Selection - ChatGPT style compact popover */}
              <AnimatePresence>
                {isPlusMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-[100%] left-0 mb-4 flex flex-col gap-1.5 z-50 min-w-[180px]"
                  >
                    {[
                      { icon: <Camera className="w-4 h-4" />, label: "Camera" },
                      { icon: <ImageIcon className="w-4 h-4" />, label: "Gallery" },
                      { icon: <FileText className="w-4 h-4" />, label: "File" }
                    ].map((item, i) => (
                      <button key={i} className="flex items-center gap-3 p-2.5 bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-xl text-white/90 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl group w-full">
                        <div className="w-9 h-9 rounded-lg aura-logo-gradient flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform text-white">
                          {item.icon}
                        </div>
                        <span className="text-[12px] font-black uppercase tracking-[0.15em]">{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="glass-dark border-white/10 rounded-[28px] p-2 flex items-end gap-2 shadow-2xl relative z-10">
                <button onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)} className={cn("p-3 rounded-2xl transition-all", isPlusMenuOpen ? "bg-white text-black" : "text-[#8B5CF6] hover:text-purple-400")}><Plus className={cn("w-5 h-5 transition-transform", isPlusMenuOpen && "rotate-45")} /></button>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Ask anything..." className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-white/20 py-3 px-2 resize-none max-h-40 min-h-[44px] text-sm" />
                <button 
                  onClick={toggleListening}
                  className={cn(
                    "p-3 transition-all relative group flex items-center justify-center",
                    isListening ? "text-[#dd3c58]" : "text-[#dd3c58]/60 hover:text-[#dd3c58]"
                  )}
                >
                  <AnimatePresence>
                    {isListening && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        {/* Advanced Aura Rings */}
                        {[1.2, 1.6, 2.0].map((s, i) => (
                          <motion.div
                            key={`ring-${i}`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ 
                              scale: [s, s + (audioLevel / 100) * 0.8, s],
                              opacity: [0.15, 0.3, 0.15]
                            }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ 
                              duration: 0.5, 
                              repeat: isListening ? Infinity : 0,
                              ease: "easeInOut",
                              delay: i * 0.1
                            }}
                            className="absolute inset-0 rounded-full border border-[#dd3c58] bg-[#dd3c58]/5 shadow-[0_0_15px_rgba(221,60,88,0.2)]"
                          />
                        ))}
                        
                        {/* High-Density Frequency Bars */}
                        <motion.div 
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center gap-[1.5px] px-2"
                        >
                          {[0.3, 0.5, 0.8, 0.4, 0.9, 0.6, 0.4, 0.7].map((scale, i) => (
                            <motion.div
                              key={`bar-${i}`}
                              animate={{ 
                                height: [4, Math.max(4, (audioLevel / 100) * 32 * scale), 4],
                                backgroundColor: audioLevel > 50 ? "#ff4d6d" : "#dd3c58"
                              }}
                              transition={{ 
                                duration: 0.15, 
                                repeat: Infinity,
                                ease: "linear"
                              }}
                              className="w-[1.5px] rounded-full shadow-[0_0_8px_rgba(221,60,88,0.3)]"
                            />
                          ))}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Mic className={cn("w-5 h-5 relative z-10 transition-all duration-300", isListening ? "scale-150 opacity-0" : "scale-100 opacity-100")} />
                </button>
                <button onClick={() => handleSend()} disabled={!input.trim() || isTyping} className={cn("p-3 rounded-full transition-all active:scale-90", input.trim() ? "aura-logo-gradient text-white shadow-lg scale-110" : "bg-white/5 text-white/10")}><Send className="w-4 h-4 sm:w-5 sm:h-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <ImageModal url={selectedImage} onClose={() => setSelectedImage(null)} />
      
      <AnimatePresence>
        {chatToDelete && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-dark border border-white/10 rounded-[32px] p-8 overflow-hidden shadow-2xl"
            >
              {/* Modal Aura Background */}
              <div className="absolute inset-0 pointer-events-none">
                <motion.div 
                  layoutId="aura-sphere-core"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 aura-logo-gradient rounded-full blur-[100px] opacity-20"
                />
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-aura-pink/10 border border-aura-pink/20 flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-aura-pink" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Delete Chat?</h3>
                <p className="text-white/40 text-sm mb-8">
                  Are you sure you want to delete <span className="text-white/80 font-semibold">"{chatToDelete.title}"</span>? This action cannot be undone.
                </p>

                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => setChatToDelete(null)}
                    className="flex-1 py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-bold hover:bg-white/10 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-4 px-6 rounded-2xl bg-aura-pink text-white font-bold shadow-lg shadow-aura-pink/20 hover:bg-aura-pink/80 hover:scale-[1.02] transition-all active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
};

export default ChatPage;
