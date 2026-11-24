import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  X, 
  Trash2, 
  ShieldAlert, 
  ArrowDown, 
  Check, 
  RotateCcw,
  Mic,
  MicOff,
  Radio
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { PermissionsService } from '../../services/permissions';
import { VoiceEngine } from '../../services/voice';
import { useModalStore } from '../../store/modalStore';
import { useMusicStore } from '../../store/musicStore';
import { tryHandleFastPathVoiceMusic } from '../../services/voiceMusicHandler';
import { hapticFeedback } from '../../services/haptics';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

interface AiCoachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  'Check my progress',
  'Suggest a workout',
  'How do HR zones work?',
  'Analyze my recovery'
];

export const AiCoachDrawer: React.FC<AiCoachDrawerProps> = ({ isOpen, onClose }) => {
  const { openLiveVoice } = useModalStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contextConsent, setContextConsent] = useState<boolean>(() => {
    return localStorage.getItem('nocturne_ai_context_consent') !== 'false';
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const dictationEngineRef = useRef<VoiceEngine | null>(null);

  useEffect(() => {
    // Sync context consent state from local storage or profile
    const stored = localStorage.getItem('nocturne_ai_context_consent');
    if (stored !== null) {
      setContextConsent(stored === 'true');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      dictationEngineRef.current?.destroy();
    };
  }, []);

  const toggleDictation = async () => {
    await PermissionsService.hapticTap();
    if (isDictating) {
      dictationEngineRef.current?.stopListening();
      setIsDictating(false);
      return;
    }

    dictationEngineRef.current = new VoiceEngine({
      onListeningStart: () => {
        setIsDictating(true);
        setErrorMessage(null);
      },
      onTranscript: (text) => setInputText(text),
      onListeningEnd: () => setIsDictating(false),
      onError: (err) => {
        setErrorMessage(err);
        setIsDictating(false);
      }
    });

    const started = await dictationEngineRef.current.startListening();
    if (!started) setIsDictating(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      setIsHistoryLoading(true);
      const res = await apiRequest('/ai/history');
      if (res.history) {
        setMessages(res.history);
      }
    } catch (err) {
      console.error('Failed to load AI history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    await PermissionsService.hapticTap();
    setInputText('');

    // Fast-path immediate music handling
    const fastPath = await tryHandleFastPathVoiceMusic(text);
    if (fastPath.handled) {
      const userMsg: Message = {
        id: 'msg-' + Date.now(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString()
      };
      const ackMsg: Message = {
        id: 'ack-' + Date.now(),
        role: 'model',
        content: fastPath.message || 'Executing command.',
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsg, ackMsg]);
      await PermissionsService.hapticSuccess();
      return;
    }

    // Optimistic user message
    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      setErrorMessage(null);
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });

      if (res.reply) {
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, res.reply]);
        await PermissionsService.hapticSuccess();
      }

      // Execute structured music intent action if returned
      if (res.action) {
        const musicStore = useMusicStore.getState();
        if (res.action.type === 'PLAY_SONG' && res.action.query) {
          try {
            const searchRes = await apiRequest(`/music/search?q=${encodeURIComponent(res.action.query)}`);
            if (searchRes.tracks && searchRes.tracks.length > 0) {
              musicStore.playTrack(searchRes.tracks[0]);
            }
          } catch (e) {
            console.warn('Action PLAY_SONG search failed:', e);
          }
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
    } catch (err: any) {
      const errTxt = err.message || 'AI Coach unavailable';
      setErrorMessage(errTxt);
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear AI Coach chat history?')) return;
    try {
      await apiRequest('/ai/history', { method: 'DELETE' });
      setMessages([]);
      await PermissionsService.hapticTap();
    } catch (err: any) {
      alert(err.message || 'Failed to clear history');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg h-[85vh] bg-[#141A18] border-t border-x border-white/10 rounded-t-[36px] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Glow ambient background accent */}
        <div className="absolute top-0 right-10 w-48 h-48 bg-[#6bfb9a]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#141A18]/90 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#191c1b] via-[#282b29] to-[#4ade80] p-0.5 flex items-center justify-center shadow-glow-sm">
              <div className="w-full h-full rounded-[14px] bg-[#0c0f0e] flex items-center justify-center text-[#6bfb9a]">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-extrabold text-white text-base tracking-tight">
                  Friday AI Coach
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#6bfb9a]/20 text-[#6bfb9a] text-[10px] font-bold">
                  Gemini 2.5
                </span>
                <span 
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                    contextConsent 
                      ? 'bg-[#4ade80]/15 text-[#4ade80] border-[#4ade80]/30' 
                      : 'bg-white/5 text-[#869486] border-white/10'
                  }`}
                  title={contextConsent ? 'Friday can read your logged workouts & sleep' : 'Health context access is off'}
                >
                  Context: {contextConsent ? 'ON' : 'OFF'}
                </span>
              </div>
              <span className="text-[11px] text-[#869486]">Personal Health & Music Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Live Voice Overlay Button */}
            <button
              onClick={() => {
                onClose();
                openLiveVoice();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] text-xs font-display font-extrabold shadow-md shadow-[#4ade80]/20 hover:opacity-95 active:scale-95 transition-all"
              title="Start Live Voice Conversation"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Live Voice</span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="w-9 h-9 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#869486] hover:text-[#ffb4ab] transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                hapticFeedback.light();
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-[#191c1b] border border-white/10 flex items-center justify-center text-[#bccabb] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Wellness Disclaimer Banner */}
        <div className="bg-[#191c1b]/70 px-4 py-2 border-b border-white/5 flex items-center gap-2 text-[11px] text-[#869486]">
          <ShieldAlert className="w-3.5 h-3.5 text-[#6bfb9a] shrink-0" />
          <span>Non-medical wellness guidance based strictly on your recorded metrics.</span>
        </div>

        {/* Visible Error Banner */}
        {errorMessage && (
          <div className="bg-[#93000a]/20 border-b border-[#93000a]/40 px-4 py-2.5 flex items-center justify-between text-xs text-[#ffb4ab]">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-[#ffb4ab] underline text-[10px] ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isHistoryLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-[#869486]">
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#191c1b] border border-[#6bfb9a]/20 flex items-center justify-center text-[#6bfb9a] shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-display font-bold text-white text-base mb-1">
                  Ready to optimize your training?
                </h4>
                <p className="text-xs text-[#bccabb] max-w-xs leading-relaxed">
                  Ask about your recent pace, calories, recovery readiness, or personalized zone training.
                </p>
              </div>

              {/* Starter Prompt Chips */}
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-3 py-1.5 rounded-full bg-[#191c1b] border border-white/10 hover:border-[#6bfb9a]/40 text-xs text-[#bccabb] hover:text-[#6bfb9a] transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-7 h-7 rounded-full bg-[#191c1b] border border-[#6bfb9a]/30 flex items-center justify-center text-[#6bfb9a] shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-semibold rounded-br-xs shadow-md'
                        : 'bg-[#191c1b] border border-white/10 text-[#e1e3e1] rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-[#191c1b] border border-[#6bfb9a]/30 flex items-center justify-center text-[#6bfb9a] shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-[#191c1b] border border-white/10 px-4 py-3 rounded-2xl text-xs text-[#869486] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6bfb9a] animate-ping" />
                    <span>Analyzing your metrics...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Bottom Input Field */}
        <div className="p-4 border-t border-white/10 bg-[#141A18]/95 safe-bottom">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isDictating ? 'Listening...' : 'Ask your coach anything...'}
              className="flex-1 bg-[#191c1b] border border-white/10 rounded-full px-4 py-3 text-xs text-white placeholder-[#869486] focus:outline-none focus:border-[#6bfb9a]/50 transition-colors"
            />
            {/* Quick Mic Speech-to-Text Button */}
            <button
              type="button"
              onClick={toggleDictation}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                isDictating 
                  ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab] animate-pulse'
                  : 'bg-[#191c1b] border border-white/10 text-[#bccabb] hover:text-[#6bfb9a]'
              }`}
              title="Voice Input"
            >
              {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                inputText.trim() && !isLoading
                  ? 'bg-gradient-to-r from-[#6bfb9a] to-[#4ade80] text-[#0c0f0e] shadow-lg shadow-[#4ade80]/20 active:scale-95'
                  : 'bg-[#191c1b] text-[#869486] opacity-50 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
