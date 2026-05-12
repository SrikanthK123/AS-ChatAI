import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Sparkles, Image as ImageIcon, Copy, Edit3, Check, X, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  reasoning?: string;
  reasoning_details?: string;
  timestamp: string;
  images?: string[];
}

export const VisualAura = () => (
  <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
    <motion.div 
      animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -30, 0] }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-aura-purple/10 blur-[100px]"
    />
    <motion.div 
      animate={{ scale: [1.2, 1, 1.2], x: [0, -40, 0], y: [0, 40, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-aura-orange/10 blur-[120px]"
    />
  </div>
);

export const GalaxyEarthBackground = () => {
  const [pos, setPos] = React.useState({ x: -1000, y: -1000 });
  React.useEffect(() => {
    const handleMove = (e: any) => setPos(e.detail);
    window.addEventListener('bg-mouse-move', handleMove);
    return () => window.removeEventListener('bg-mouse-move', handleMove);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[#020203]" style={{ zIndex: -1 }}>
      {/* Base Galaxy Layer (Very Faint) */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(150)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() * 2 + 'px',
              height: Math.random() * 2 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
            }}
          />
        ))}
      </div>

      {/* Interactive Reveal Layer (The "Flashlight" effect) */}
      <motion.div 
        animate={{ 
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.08) 40%, transparent 100%)` 
        }}
        className="absolute inset-0 z-10"
      />

      {/* Massive Earth Surface Arc (Bottom) */}
      <div className="absolute bottom-[-75%] left-[-25%] w-[150%] h-[130%] rounded-[100%] border-t-[8px] border-cyan-500/10 shadow-[0_-30px_150px_rgba(37,99,235,0.2)] bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.9)_0%,rgba(37,99,235,0.15)_15%,rgba(16,185,129,0.08)_35%,transparent_65%)] blur-[10px]">
        {/* Advanced Detail: City Lights / Grid effect */}
        <div className="absolute top-[2%] left-[15%] right-[15%] h-64 opacity-30 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0%,transparent_1.5px)] bg-[length:32px_32px] mask-image-gradient-to-b" />
      </div>
      
      {/* Intense Horizon Atmosphere Glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-cyan-400/30 blur-[2px] shadow-[0_0_20px_rgba(34,211,238,0.5)]" />
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-cyan-900/10 to-transparent" />
    </div>
  );
};

export const MouseBrush = () => {
  const [pos, setPos] = React.useState({ x: -1000, y: -1000 });
  React.useEffect(() => {
    const handleMove = (e: any) => setPos(e.detail);
    window.addEventListener('bg-mouse-move', handleMove);
    return () => window.removeEventListener('bg-mouse-move', handleMove);
  }, []);

  return (
    <motion.div
      animate={{ x: pos.x - 400, y: pos.y - 400 }}
      transition={{ type: "spring", damping: 35, stiffness: 180, mass: 0.2 }}
      className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.3)_0%,rgba(16,185,129,0.2)_30%,rgba(139,92,246,0.15)_50%,transparent_70%)] blur-[100px] pointer-events-none z-[1] mix-blend-screen"
    />
  );
};

export const BackgroundText = () => {
  const [pos, setPos] = React.useState({ x: -1000, y: -1000 });
  React.useEffect(() => {
    const handleMove = (e: any) => setPos(e.detail);
    window.addEventListener('bg-mouse-move', handleMove);
    return () => window.removeEventListener('bg-mouse-move', handleMove);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center select-none overflow-hidden">
      <h1 
        className="text-[250px] md:text-[380px] font-black text-transparent tracking-tighter leading-none uppercase filter blur-[1.5px] absolute"
        style={{ WebkitTextStroke: '1px rgba(255, 255, 255, 0.04)' }}
      >
        AS-ChatAI
      </h1>
      <h1 
        className="text-[250px] md:text-[380px] font-black text-cyan-600/30 tracking-tighter leading-none uppercase filter blur-[1px] absolute"
        style={{
          maskImage: `radial-gradient(circle 350px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(circle 350px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`
        }}
      >
        AS-ChatAI
      </h1>
    </div>
  );
};

export const ImageModal = ({ url, onClose }: { url: string | null; onClose: () => void }) => (
  <AnimatePresence>
    {url && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-20 bg-black/90 backdrop-blur-sm cursor-zoom-out"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-full max-h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors">
            <X className="w-8 h-8" />
          </button>
          <img src={url} alt="Enlarged" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" referrerPolicy="no-referrer" />
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
