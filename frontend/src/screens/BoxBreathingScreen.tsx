import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Wind, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles,
  Heart
} from 'lucide-react';
import { hapticFeedback } from '../services/haptics';
import { offlineSyncEngine } from '../services/offlineSync';

type BreathingPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const TOTAL_SESSION_SECONDS = 120; // 2 minutes

export const BoxBreathingScreen: React.FC = () => {
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_SESSION_SECONDS);
  const [phase, setPhase] = useState<BreathingPhase>('inhale');
  const [phaseSeconds, setPhaseSeconds] = useState(4);
  const [isCompleted, setIsCompleted] = useState(false);

  const phaseTimerRef = useRef<any>(null);
  const sessionTimerRef = useRef<any>(null);

  // 4-4-4-4 Box Breathing Phases
  const phaseOrder: BreathingPhase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

  const getPhasePrompt = (p: BreathingPhase) => {
    switch (p) {
      case 'inhale': return 'Breathe In Slowly';
      case 'hold1': return 'Hold Breath';
      case 'exhale': return 'Release & Exhale';
      case 'hold2': return 'Hold Still';
    }
  };

  const getPhaseInstruction = (p: BreathingPhase) => {
    switch (p) {
      case 'inhale': return 'Expand your diaphragm fully through the nose';
      case 'hold1': return 'Keep your chest steady and relax your shoulders';
      case 'exhale': return 'Release air gently and smoothly through your mouth';
      case 'hold2': return 'Stay empty, grounded, and present';
    }
  };

  // Halo scale based on phase
  const getHaloTransform = () => {
    if (!isActive) return 'scale(0.85)';
    switch (phase) {
      case 'inhale': return 'scale(1.35)';
      case 'hold1': return 'scale(1.35)';
      case 'exhale': return 'scale(0.75)';
      case 'hold2': return 'scale(0.75)';
    }
  };

  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      sessionTimerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            handleCompleteSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      phaseTimerRef.current = setInterval(() => {
        setPhaseSeconds(prevSec => {
          if (prevSec <= 1) {
            // Transition to next phase
            setPhase(currPhase => {
              const nextIndex = (phaseOrder.indexOf(currPhase) + 1) % phaseOrder.length;
              const nextP = phaseOrder[nextIndex];
              // Trigger gentle haptic pulse on phase change
              hapticFeedback.light();
              return nextP;
            });
            return 4;
          }
          return prevSec - 1;
        });
      }, 1000);
    } else {
      clearInterval(sessionTimerRef.current);
      clearInterval(phaseTimerRef.current);
    }

    return () => {
      clearInterval(sessionTimerRef.current);
      clearInterval(phaseTimerRef.current);
    };
  }, [isActive, secondsRemaining]);

  const handleToggle = () => {
    hapticFeedback.medium();
    setIsActive(!isActive);
  };

  const handleReset = () => {
    hapticFeedback.light();
    setIsActive(false);
    setSecondsRemaining(TOTAL_SESSION_SECONDS);
    setPhase('inhale');
    setPhaseSeconds(4);
    setIsCompleted(false);
  };

  const handleCompleteSession = async () => {
    setIsActive(false);
    setIsCompleted(true);
    hapticFeedback.milestone();

    // Log to backend (offline-safe)
    await offlineSyncEngine.mutate('BREATHING_SESSION', '/stress/breathing', {
      protocol: 'box_4_4_4_4',
      durationSec: TOTAL_SESSION_SECONDS,
      completedAt: new Date().toISOString()
    }).catch(console.error);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-10 flex flex-col justify-between max-w-lg mx-auto relative overflow-hidden">
      
      {/* Top Header */}
      <header className="flex items-center justify-between py-2 z-10">
        <button
          onClick={() => {
            hapticFeedback.light();
            navigate(-1);
          }}
          className="w-10 h-10 rounded-full bg-[#141A18] border border-white/5 flex items-center justify-center text-[#bccabb] hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#869486]">Mindfulness & Vagal Tone</span>
          <h1 className="font-display text-base font-black text-white">4-4-4-4 Box Breathing</h1>
        </div>
        <button
          onClick={handleReset}
          className="w-10 h-10 rounded-full bg-[#141A18] border border-white/5 flex items-center justify-center text-[#bccabb] hover:text-white"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Main Breathing Halo Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center relative my-6">
        
        {/* Ambient Halo Glow Circles */}
        <div 
          className="w-64 h-64 rounded-full bg-gradient-to-tr from-[#6bfb9a]/20 via-white/10 to-[#4ade80]/30 filter blur-2xl absolute transition-transform duration-[4000ms] ease-in-out pointer-events-none"
          style={{ transform: getHaloTransform() }}
        />

        {/* Dynamic Expanding/Contracting Core Circle */}
        <div 
          className="relative w-56 h-56 rounded-full border border-white/20 flex flex-col items-center justify-center p-6 shadow-2xl transition-all duration-[4000ms] ease-in-out bg-gradient-to-br from-[#141A18] via-[#1a241f] to-[#0c0f0e]"
          style={{ transform: getHaloTransform() }}
        >
          {/* Phase Cue & Count */}
          <span className="font-display text-6xl font-black text-white tabular-nums drop-shadow-[0_2px_12px_rgba(74,222,128,0.3)]">
            {isActive ? phaseSeconds : '4'}
          </span>
          <span className="font-display text-xs font-black uppercase tracking-wider text-[#6bfb9a] mt-1 text-center">
            {getPhasePrompt(phase)}
          </span>
        </div>

        {/* Instruction Guidance Text */}
        <p className="text-xs text-[#bccabb] text-center max-w-xs mt-8 min-h-[32px] transition-opacity duration-300">
          {getPhaseInstruction(phase)}
        </p>

        {/* Total Session Timer Pill */}
        <div className="mt-4 px-4 py-1.5 rounded-full bg-[#141A18] border border-white/10 flex items-center gap-2 text-xs font-mono font-bold text-white">
          <Wind className="w-3.5 h-3.5 text-[#4ade80]" />
          <span>{formatTimer(secondsRemaining)} Remaining</span>
        </div>
      </div>

      {/* Completion Modal Overlay */}
      {isCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm glass-card rounded-[32px] p-6 border border-[#4ade80]/30 text-center space-y-4 bg-[#141A18] shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#4ade80]/20 border border-[#4ade80]/40 flex items-center justify-center mx-auto text-[#4ade80]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-black text-xl text-white">Mindfulness Complete</h3>
              <p className="text-xs text-[#bccabb]">
                2 minutes of Box Breathing logged. Your heart rate variability and nervous system recovery are now optimizing.
              </p>
            </div>
            <button
              onClick={() => {
                hapticFeedback.light();
                navigate(-1);
              }}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-bold text-xs shadow-glow-primary active:scale-95 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="pt-4 flex items-center justify-center gap-3">
        <button
          onClick={handleToggle}
          className={`flex-1 max-w-xs py-4 rounded-full font-display font-black text-sm tracking-wide shadow-glow-primary flex items-center justify-center gap-2 active:scale-95 transition-all ${
            isActive
              ? 'bg-[#1d201f] text-white border border-white/10'
              : 'bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e]'
          }`}
        >
          {isActive ? (
            <>
              <Pause className="w-5 h-5 fill-current" />
              <span>Pause Session</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current ml-0.5" />
              <span>{secondsRemaining < TOTAL_SESSION_SECONDS ? 'Resume Breathing' : 'Start 2-Min Reset'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
