import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Pause, 
  Play, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Radio 
} from 'lucide-react';
import { VoiceEngine } from '../../services/voice';
import { PermissionsService } from '../../services/permissions';
import { apiRequest } from '../../services/api';
import { useMusicStore } from '../../store/musicStore';
import { tryHandleFastPathVoiceMusic } from '../../services/voiceMusicHandler';

interface AiLiveVoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type VoiceState = 'listening' | 'thinking' | 'speaking' | 'paused';

export const AiLiveVoiceOverlay: React.FC<AiLiveVoiceOverlayProps> = ({ isOpen, onClose }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('listening');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiSpokenText, setAiSpokenText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const voiceEngineRef = useRef<VoiceEngine | null>(null);
  const transcriptTimeoutRef = useRef<any>(null);
  const isComponentActiveRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      isComponentActiveRef.current = true;
      initVoiceLoop();
    } else {
      isComponentActiveRef.current = false;
      cleanupVoice();
    }

    return () => {
      isComponentActiveRef.current = false;
      cleanupVoice();
    };
  }, [isOpen]);

  const cleanupVoice = () => {
    if (transcriptTimeoutRef.current) {
      clearTimeout(transcriptTimeoutRef.current);
    }
    voiceEngineRef.current?.stopListening();
    voiceEngineRef.current?.stopSpeaking();
    voiceEngineRef.current?.destroy();
    voiceEngineRef.current = null;
  };

  const initVoiceLoop = () => {
    cleanupVoice();

    voiceEngineRef.current = new VoiceEngine({
      onListeningStart: () => {
        if (!isPaused) setVoiceState('listening');
      },
      onTranscript: (text: string) => {
        setUserTranscript(text);

        // Reset debounce timer on ongoing speech
        if (transcriptTimeoutRef.current) {
          clearTimeout(transcriptTimeoutRef.current);
        }

        // Detect 1.2s pause after speaking to submit query
        transcriptTimeoutRef.current = setTimeout(() => {
          if (text.trim() && !isPaused) {
            submitVoiceQuery(text.trim());
          }
        }, 1200);
      },
      onListeningEnd: () => {
        // Handled dynamically
      },
      onSpeakingStart: () => {
        setVoiceState('speaking');
      },
      onSpeakingEnd: () => {
        if (!isComponentActiveRef.current || isPaused) return;
        // Resume listening automatically in continuous hands-free loop
        setUserTranscript('');
        setVoiceState('listening');
        setTimeout(() => {
          voiceEngineRef.current?.startListening();
        }, 300);
      },
      onError: (err) => {
        console.warn('Voice error:', err);
        setVoiceError(err);
      }
    });

    // Start initial listening
    voiceEngineRef.current.startListening();
  };

  const submitVoiceQuery = async (query: string) => {
    if (!query) return;
    voiceEngineRef.current?.stopListening();
    setVoiceState('thinking');
    await PermissionsService.hapticTap();

    // 1) Fast-Path: Test for immediate music control before Gemini network call
    const fastPath = await tryHandleFastPathVoiceMusic(query);
    if (fastPath.handled) {
      if (!isComponentActiveRef.current) return;
      const ack = fastPath.message || 'Got it.';
      setAiSpokenText(ack);
      if (!isMuted) {
        setVoiceState('speaking');
        await voiceEngineRef.current?.speak(ack);
      }
      // Minimize overlay smoothly after fast-path music command
      setTimeout(() => {
        if (isComponentActiveRef.current) {
          onClose();
        }
      }, 700);
      return;
    }

    try {
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          mode: 'voice'
        })
      });

      if (!isComponentActiveRef.current) return;

      const replyToSpeak = res.spokenSummary || res.reply?.content || 'Got it.';
      setAiSpokenText(replyToSpeak);

      // Execute music intent action if Friday returned one
      if (res.action) {
        const musicStore = useMusicStore.getState();
        if (res.action.type === 'PLAY_SONG' && res.action.query) {
          apiRequest(`/music/search?q=${encodeURIComponent(res.action.query)}`)
            .then(sRes => {
              if (sRes.tracks && sRes.tracks.length > 0) {
                musicStore.playTrack(sRes.tracks[0]);
              }
            })
            .catch(console.warn);
        } else if (res.action.type === 'PAUSE_MUSIC') {
          musicStore.pause();
        } else if (res.action.type === 'RESUME_MUSIC') {
          musicStore.resume();
        } else if (res.action.type === 'NEXT_TRACK') {
          musicStore.nextTrack();
        } else if (res.action.type === 'STOP_MUSIC') {
          musicStore.stop();
        }
      }

      // Speak reply aloud
      if (!isMuted) {
        setVoiceState('speaking');
        await voiceEngineRef.current?.speak(replyToSpeak);
      } else {
        // If muted, wait 2 seconds then resume listening
        setTimeout(() => {
          if (isComponentActiveRef.current && !isPaused) {
            setVoiceState('listening');
            voiceEngineRef.current?.startListening();
          }
        }, 2000);
      }
    } catch (err: any) {
      setAiSpokenText('I had trouble connecting to the network. Please try again.');
      setTimeout(() => {
        if (isComponentActiveRef.current && !isPaused) {
          setVoiceState('listening');
          voiceEngineRef.current?.startListening();
        }
      }, 2500);
    }
  };

  // Tap-to-interrupt (barge-in)
  const handleOrbClick = () => {
    PermissionsService.hapticTap();
    if (voiceState === 'speaking') {
      voiceEngineRef.current?.stopSpeaking();
      setUserTranscript('');
      setVoiceState('listening');
      voiceEngineRef.current?.startListening();
    } else if (voiceState === 'listening') {
      // Toggle pause/listen
      voiceEngineRef.current?.stopListening();
      setVoiceState('paused');
      setIsPaused(true);
    } else if (voiceState === 'paused') {
      setIsPaused(false);
      setVoiceState('listening');
      voiceEngineRef.current?.startListening();
    }
  };

  const togglePause = () => {
    PermissionsService.hapticTap();
    if (isPaused) {
      setIsPaused(false);
      setVoiceState('listening');
      voiceEngineRef.current?.startListening();
    } else {
      setIsPaused(true);
      setVoiceState('paused');
      voiceEngineRef.current?.stopSpeaking();
      voiceEngineRef.current?.stopListening();
    }
  };

  const toggleMute = () => {
    PermissionsService.hapticTap();
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (nextMute && voiceState === 'speaking') {
      voiceEngineRef.current?.stopSpeaking();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0f0e] text-[#e1e3e1] animate-fade-in safe-top safe-bottom">
      
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#0c0f0e]/80 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#191c1b] border border-[#6bfb9a]/30 flex items-center justify-center text-[#6bfb9a] shadow-glow-sm">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-extrabold text-white text-sm tracking-tight">
                Friday Live Voice
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#6bfb9a]/20 text-[#6bfb9a] text-[9px] font-bold uppercase tracking-wider">
                Live
              </span>
            </div>
            <span className="text-[11px] text-[#869486]">Gemini 2.5 • Health & Music Voice</span>
          </div>
        </div>

        <button
          onClick={() => {
            cleanupVoice();
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/10 flex items-center justify-center text-[#bccabb] hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Visible Error Banner */}
      {voiceError && (
        <div className="bg-[#93000a]/20 border-b border-[#93000a]/40 px-6 py-2.5 flex items-center justify-between text-xs text-[#ffb4ab] z-30">
          <span>{voiceError}</span>
          <button
            onClick={() => setVoiceError(null)}
            className="text-[#ffb4ab] underline text-[10px] ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Reactive Glowing Orb Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-6 text-center select-none">
        
        {/* Ambient atmospheric glows */}
        <div 
          className={`absolute w-80 h-80 rounded-full blur-[100px] transition-all duration-700 pointer-events-none ${
            voiceState === 'listening'
              ? 'bg-[#6bfb9a]/20 scale-100'
              : voiceState === 'speaking'
              ? 'bg-[#4ade80]/35 scale-125'
              : voiceState === 'thinking'
              ? 'bg-white/20 scale-90 animate-pulse'
              : 'bg-[#869486]/10 scale-75'
          }`}
        />

        {/* Central Reactive Orb (Tap to Interrupt / Resume) */}
        <button
          type="button"
          onClick={handleOrbClick}
          className="relative group cursor-pointer focus:outline-none transition-transform active:scale-95"
          title="Tap to Interrupt / Resume"
        >
          {/* Outer Ripple Rings */}
          <div 
            className={`absolute inset-0 -m-8 rounded-full border border-[#6bfb9a]/20 transition-all duration-1000 ${
              voiceState === 'speaking' || voiceState === 'listening' ? 'animate-ping opacity-30' : 'opacity-0'
            }`} 
          />
          <div 
            className={`absolute inset-0 -m-4 rounded-full border border-[#4ade80]/30 transition-all duration-700 ${
              voiceState === 'speaking' ? 'scale-110' : 'scale-100'
            }`} 
          />

          {/* Primary Gradient Orb Body */}
          <div 
            className={`w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 relative overflow-hidden ${
              voiceState === 'listening'
                ? 'bg-gradient-to-tr from-[#141A18] via-[#1C2420] to-[#6bfb9a] shadow-[#6bfb9a]/20'
                : voiceState === 'speaking'
                ? 'bg-gradient-to-tr from-white via-[#86efac] to-[#4ade80] shadow-[#4ade80]/40'
                : voiceState === 'thinking'
                ? 'bg-gradient-to-tr from-[#191c1b] via-[#282b29] to-white shadow-white/20 animate-spin'
                : 'bg-[#191c1b] border border-white/10 opacity-70'
            }`}
          >
            {/* Core Icon Indicator */}
            <div className={`p-4 rounded-full bg-[#0c0f0e]/60 backdrop-blur-sm ${
              voiceState === 'speaking' ? 'text-[#0c0f0e]' : 'text-white'
            }`}>
              {voiceState === 'listening' && <Mic className="w-8 h-8 text-[#6bfb9a] animate-pulse" />}
              {voiceState === 'thinking' && <Sparkles className="w-8 h-8 text-white" />}
              {voiceState === 'speaking' && <Volume2 className="w-8 h-8 text-[#4ade80] animate-bounce" />}
              {voiceState === 'paused' && <Pause className="w-8 h-8 text-[#869486]" />}
            </div>
          </div>
        </button>

        {/* Status Pill */}
        <div className="mt-8">
          <span className="px-4 py-1.5 rounded-full bg-[#191c1b] border border-white/10 text-xs font-bold text-white uppercase tracking-wider tabular-nums flex items-center gap-2 mx-auto">
            <span 
              className={`w-2 h-2 rounded-full ${
                voiceState === 'listening'
                  ? 'bg-[#6bfb9a] animate-ping'
                  : voiceState === 'speaking'
                  ? 'bg-[#4ade80]'
                  : voiceState === 'thinking'
                  ? 'bg-white animate-pulse'
                  : 'bg-[#869486]'
              }`} 
            />
            <span>
              {voiceState === 'listening' && 'Listening to you...'}
              {voiceState === 'thinking' && 'Nocturne is thinking...'}
              {voiceState === 'speaking' && 'Speaking (Tap orb to interrupt)'}
              {voiceState === 'paused' && 'Voice Session Paused'}
            </span>
          </span>
        </div>

        {/* Live Captions Display */}
        <div className="w-full max-w-sm mt-6 min-h-[90px] flex flex-col justify-center px-4">
          {userTranscript ? (
            <p className="text-sm font-semibold text-white/90 italic animate-fade-in">
              "{userTranscript}"
            </p>
          ) : aiSpokenText ? (
            <p className="text-xs text-[#bccabb] leading-relaxed animate-fade-in line-clamp-3">
              {aiSpokenText}
            </p>
          ) : (
            <p className="text-xs text-[#869486]">
              Speak naturally. Ask about your workouts, pace, or recovery.
            </p>
          )}
        </div>

      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="p-6 pb-8 border-t border-white/5 bg-[#141A18]/80 backdrop-blur z-20 flex items-center justify-around max-w-md mx-auto w-full">
        {/* Mute TTS Audio */}
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isMuted 
              ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40' 
              : 'bg-[#191c1b] text-[#bccabb] border border-white/10 hover:text-white'
          }`}
          title={isMuted ? 'Unmute Voice' : 'Mute Voice'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Central Pause/Resume Button */}
        <button
          onClick={togglePause}
          className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-sm shadow-xl transition-all active:scale-95 ${
            isPaused
              ? 'bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] shadow-[#4ade80]/20'
              : 'bg-[#191c1b] text-white border border-white/20'
          }`}
        >
          {isPaused ? <Play className="w-6 h-6 fill-current ml-0.5" /> : <Pause className="w-6 h-6 fill-current" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={() => {
            cleanupVoice();
            onClose();
          }}
          className="w-12 h-12 rounded-full bg-[#93000a]/20 border border-[#93000a]/40 text-[#ffb4ab] flex items-center justify-center hover:bg-[#93000a]/40 transition-all"
          title="End Live Voice Call"
        >
          <X className="w-5 h-5" />
        </button>
      </footer>

    </div>
  );
};
