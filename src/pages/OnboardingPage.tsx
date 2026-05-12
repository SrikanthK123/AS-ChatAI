import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MouseBrush, BackgroundText } from '../components/SharedUI';

const OnboardingPage = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden group/onboarding-root"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        window.dispatchEvent(new CustomEvent('bg-mouse-move', { detail: { x, y } }));
      }}
    >
      <div className="hidden md:block absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <MouseBrush />
        <BackgroundText />
        
        {/* Main Focus Light (Spotlight) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.06)_0%,transparent_60%)]"
          />
        </div>

        {/* Secondary Bottom Glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[50%] bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.02)_0%,transparent_70%)]" />

        {/* Vignette for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
      </div>

      <div className="max-w-md w-full bg-[#120D12]/60 backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] rounded-[48px] border border-white/5 h-[750px] max-h-[90vh] relative z-10">
        <div className="relative h-full flex flex-col justify-end p-8 pb-12 sm:p-10 sm:pb-16">
          <div className="absolute top-[25%] left-1/2 -translate-x-1/2 flex flex-col items-center">
            <motion.div 
              layoutId="aura-sphere-core"
              className="w-64 h-64 sm:w-80 sm:h-80 aura-logo-gradient rounded-full blur-[2px] shadow-[0_0_80px_rgba(255,138,101,0.3)] relative z-10 border border-white/10 overflow-hidden"
            >
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover opacity-90" />
            </motion.div>
            <motion.div 
              layoutId="aura-sphere-glow"
              className="absolute inset-[-40px] sm:inset-[-60px] aura-logo-gradient rounded-full blur-[80px] opacity-20 pointer-events-none" 
            />
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="relative z-20"
          >
            <div className="mb-10 flex flex-col items-start translate-y-[-35%]">
              <div className="inline-block bg-white/10 backdrop-blur-xl border border-white/10 px-4 py-1.5 rounded-full mb-8 shadow-sm">
                <span className="text-[10px] uppercase font-black tracking-widest text-white/90">Speak. Ask. Solve.</span>
              </div>
              
              <div className="relative mb-8">
                <h1 className="text-6xl sm:text-[84px] font-black tracking-tighter text-white leading-[0.8] mb-0">
                  Ask Smart
                </h1>
                <span className="text-white/20 text-6xl sm:text-7xl font-light italic tracking-tighter leading-[0.8] block mt-1">
                  AS-ChatAI
                </span>
              </div>
              
              <p className="text-white/40 text-lg sm:text-xl max-w-[320px] leading-relaxed font-medium">
                Talk naturally and get instant answers, help, and guidance.
              </p>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3 text-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">Next-Gen AI</span>
              </div>
              
              <button 
                onClick={() => navigate('/chats')}
                className="flex items-center gap-3 sm:gap-6 bg-white text-black py-2 pr-2 pl-6 sm:pl-8 sm:py-2.5 sm:pr-2.5 rounded-full font-black hover:scale-[1.02] active:scale-95 transition-all group shadow-2xl whitespace-nowrap"
              >
                <span className="text-lg tracking-tight">Get Started</span>
                <div className="w-12 h-12 rounded-full aura-logo-gradient flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform border border-black/5">
                  <ChevronRight className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingPage;
