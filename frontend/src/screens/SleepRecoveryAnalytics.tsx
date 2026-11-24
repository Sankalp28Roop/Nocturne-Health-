import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Zap, Calendar, ChevronLeft, ChevronRight, Share2, Edit3, X } from 'lucide-react';
import { apiRequest } from '../services/api';

export const SleepRecoveryAnalytics: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [mood, setMood] = useState('Energized');
  const [durationInput, setDurationInput] = useState('');

  const fetchSleep = () => {
    apiRequest('/analytics/sleep')
      .then(res => setData(res))
      .catch(console.error);
  };

  useEffect(() => {
    fetchSleep();
  }, []);

  const handleSaveNote = async () => {
    try {
      await apiRequest('/analytics/sleep/note', {
        method: 'POST',
        body: JSON.stringify({
          notes: noteText,
          mood,
          durationMinutes: durationInput ? parseInt(durationInput, 10) : undefined
        })
      });
      setIsNoteModalOpen(false);
      fetchSleep();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    }
  };

  const sleepScore = data?.sleepScore;
  const durationMins = data?.durationMinutes ?? 0;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const efficiency = data?.efficiencyPercentage;
  const readiness = data?.readinessScore;
  const readinessMsg = data?.readinessMessage;

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-14 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-base font-bold text-white">Sleep & Recovery</h1>
        <button className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]">
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* Date Header */}
      <div className="flex items-center justify-between text-xs text-[#869486] px-1 my-3 font-semibold">
        <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-white" />
        <span className="flex items-center gap-1.5 text-white">
          <Calendar className="w-3.5 h-3.5 text-[#4ade80]" /> {data?.date || 'Today'}
        </span>
        <ChevronRight className="w-4 h-4 cursor-pointer hover:text-white" />
      </div>

      {/* Sleep Score Hero Dial */}
      <section className="glass-card p-6 rounded-[28px] my-3 border border-white/10 text-center relative overflow-hidden">
        <span className="text-[11px] text-[#4ade80] font-bold uppercase tracking-wider block">
          {sleepScore ? 'Recharge Density' : 'Awaiting Sleep Log'}
        </span>
        <div className="my-3">
          <span className="font-display text-6xl font-black text-white tabular-nums tracking-tight">
            {sleepScore !== null && sleepScore !== undefined ? sleepScore : '--'}
          </span>
          {sleepScore && <span className="text-xl text-[#bccabb] font-bold"> / 100</span>}
          <span className="text-xs text-[#869486] block font-semibold mt-1">Sleep Score</span>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5 text-center">
          <div className="bg-[#141a18] p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#869486] font-medium block">Duration</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {durationMins > 0 ? `${hours}h ${mins}m` : '--'}
            </span>
          </div>
          <div className="bg-[#141a18] p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#869486] font-medium block">Efficiency</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {efficiency !== null && efficiency !== undefined ? `${efficiency}%` : '--'}
            </span>
          </div>
          <div className="bg-[#141a18] p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#869486] font-medium block">Onset</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {data?.onsetLatencyMinutes ? `${data.onsetLatencyMinutes}m` : '--'}
            </span>
          </div>
        </div>
      </section>

      {/* Prime Readiness Narrative */}
      {readiness && (
        <section className="bg-gradient-to-r from-[#141a18] to-[#1c2420] p-4 rounded-2xl border border-[#4ade80]/20 flex items-start gap-3 my-4">
          <div className="w-8 h-8 rounded-full bg-[#4ade80]/20 flex items-center justify-center text-[#4ade80] shrink-0 mt-0.5">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#4ade80] block">Prime Readiness: {readiness}%</span>
            <p className="text-xs text-[#bccabb] mt-0.5 leading-relaxed">
              {readinessMsg}
            </p>
          </div>
        </section>
      )}

      {/* Sleep Stages / Empty state */}
      <section className="glass-card p-5 rounded-[28px] my-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display font-bold text-xs text-white">Sleep Architecture</span>
          <span className="text-[11px] text-[#86efac] font-semibold">
            {data?.stages ? 'Recorded Stages' : 'No stage data'}
          </span>
        </div>

        {data?.stages ? (
          <div className="space-y-2 py-2">
            {[
              { label: 'Deep Sleep', minutes: data.stages.deep?.minutes, pct: data.stages.deep?.percentage, color: '#4ade80' },
              { label: 'REM Sleep', minutes: data.stages.rem?.minutes, pct: data.stages.rem?.percentage, color: '#6bfb9a' },
              { label: 'Light Sleep', minutes: data.stages.light?.minutes, pct: data.stages.light?.percentage, color: '#869486' },
              { label: 'Awake', minutes: data.stages.awake?.minutes, pct: data.stages.awake?.percentage, color: '#ffb4ab' },
            ].map(stage => (
              <div key={stage.label} className="p-3 rounded-xl bg-[#141a18] border border-white/5 flex items-center justify-between">
                <span className="text-xs font-semibold text-white block">{stage.label}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: stage.color }}>
                  {stage.minutes}m ({stage.pct}%)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#5e6e66] border border-dashed border-white/10 rounded-2xl my-2">
            No sleep architecture logged for this date.
          </div>
        )}

        <button
          onClick={() => setIsNoteModalOpen(true)}
          className="w-full mt-3 py-3 rounded-full bg-[#191c1b] border border-white/10 hover:bg-[#282b29] text-xs font-bold text-white flex items-center justify-center gap-2 transition-all"
        >
          <Edit3 className="w-3.5 h-3.5 text-[#4ade80]" />
          <span>Log Sleep Session & Mood</span>
        </button>
      </section>

      {/* Sleep Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg glass-modal rounded-[32px] p-6 pb-8 border border-white/10 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white">Log Sleep Session</h3>
              <button onClick={() => setIsNoteModalOpen(false)}>
                <X className="w-4 h-4 text-[#869486]" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[#869486]">Total Duration (minutes)</span>
              <input
                type="number"
                placeholder="e.g. 480 (8 hours)"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="w-full bg-[#141a18] rounded-xl px-3 py-2 border border-white/10 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              {['Energized', 'Calm', 'Fatigued', 'Restless'].map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    mood === m ? 'bg-[#4ade80] text-black border-[#4ade80]' : 'bg-[#141a18] text-[#869486] border-white/5'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Notes on sleep quality or wake-up state..."
              className="w-full h-20 bg-[#141a18] rounded-2xl p-3 border border-white/10 text-xs text-white focus:outline-none"
            />

            <button
              onClick={handleSaveNote}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-bold text-sm tracking-wide shadow-glow-primary"
            >
              Save Sleep Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
