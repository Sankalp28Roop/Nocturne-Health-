import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Volume2, Activity, Footprints, Bike } from 'lucide-react';
import { apiRequest } from '../services/api';

export const WorkoutSettings: React.FC = () => {
  const navigate = useNavigate();

  const [activity, setActivity] = useState('running');
  const [goalType, setGoalType] = useState('open');
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [voiceCoach, setVoiceCoach] = useState(false);
  const [distanceReminder, setDistanceReminder] = useState<number | null>(null);
  const [durationReminder, setDurationReminder] = useState<number | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiRequest('/workouts/config')
      .then(res => {
        if (res.selectedActivity) setActivity(res.selectedActivity);
        if (res.goal) {
          setGoalType(res.goal.type);
          setGoalValue(res.goal.value);
        }
        if (res.coaching) {
          setVoiceCoach(res.coaching.voiceCoachEnabled || false);
          setDistanceReminder(res.coaching.distanceReminderKm);
          setDurationReminder(res.coaching.durationReminderMin);
          setAutoPause(res.coaching.autoPauseEnabled || false);
        }
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await apiRequest('/workouts/config', {
        method: 'PUT',
        body: JSON.stringify({
          selectedActivity: activity,
          goalType,
          goalValue: goalType !== 'open' ? goalValue : null,
          goalUnit: goalType === 'distance' ? 'km' : goalType === 'duration' ? 'min' : goalType === 'calories' ? 'kcal' : null,
          voiceCoachEnabled: voiceCoach,
          distanceReminderKm: distanceReminder,
          durationReminderMin: durationReminder,
          autoPauseEnabled: autoPause
        })
      });
      navigate(-1);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-10 max-w-lg mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between py-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-base font-bold text-white">Workout Protocol Config</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-9 h-9 rounded-full bg-[#4ade80] text-[#0c0f0e] flex items-center justify-center shadow-glow-primary"
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>
      </header>

      {/* Activity Selector */}
      <div className="flex gap-2 my-4">
        {[
          { id: 'running', label: 'Running', icon: Activity },
          { id: 'cycling', label: 'Cycling', icon: Bike },
          { id: 'walking', label: 'Walking', icon: Footprints },
        ].map(act => {
          const Icon = act.icon;
          const isSel = activity === act.id;
          return (
            <button
              key={act.id}
              onClick={() => {
                setActivity(act.id);
                if (act.id === 'cycling' && goalType === 'steps') setGoalType('open');
              }}
              className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1.5 border transition-all ${
                isSel
                  ? 'bg-white text-[#0c0f0e] border-white shadow-md'
                  : 'bg-[#141a18] text-[#869486] border-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-bold">{act.label}</span>
            </button>
          );
        })}
      </div>

      {/* Target Goal Stepper */}
      <section className="glass-card p-5 rounded-[28px] my-4 border border-white/10">
        <span className="text-xs text-[#869486] font-medium block">Target Session Goal</span>
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            {['open', 'distance', 'duration', 'calories'].map(g => (
              <button
                key={g}
                onClick={() => {
                  setGoalType(g);
                  if (g !== 'open' && !goalValue) setGoalValue(1.0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                  goalType === g
                    ? 'bg-[#4ade80] text-[#0c0f0e]'
                    : 'bg-[#191c1b] text-[#869486] hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {goalType !== 'open' ? (
          <div className="flex items-center justify-center py-6 gap-6">
            <button
              onClick={() => setGoalValue(v => Math.max(0.5, Number(((v || 1) - 0.5).toFixed(1))))}
              className="w-12 h-12 rounded-full bg-[#191c1b] border border-white/10 text-white font-bold text-xl active:scale-95 flex items-center justify-center"
            >
              -
            </button>
            <div className="text-center">
              <span className="font-display text-5xl font-black text-white tabular-nums tracking-tight">
                {goalValue !== null ? goalValue.toFixed(1) : '1.0'}
              </span>
              <span className="text-xs text-[#4ade80] font-bold block uppercase tracking-wider mt-1">
                {goalType === 'distance' ? 'km' : goalType === 'duration' ? 'min' : 'kcal'}
              </span>
            </div>
            <button
              onClick={() => setGoalValue(v => Number(((v || 0) + 0.5).toFixed(1)))}
              className="w-12 h-12 rounded-full bg-[#191c1b] border border-white/10 text-white font-bold text-xl active:scale-95 flex items-center justify-center"
            >
              +
            </button>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#5e6e66]">
            Free tracking session without predefined distance or time targets.
          </div>
        )}
      </section>

      {/* Audio Coaching & Reminders */}
      <section className="glass-card p-5 rounded-[28px] space-y-4 border border-white/10">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-[#4ade80]" />
          Audio & Haptic Feedback
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <span className="text-xs font-semibold text-white block">Auto-Pause Telemetry</span>
            <span className="text-[10px] text-[#869486]">Pause timer when stopped</span>
          </div>
          <button
            onClick={() => setAutoPause(!autoPause)}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${autoPause ? 'bg-[#4ade80]' : 'bg-[#191c1b]'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${autoPause ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>
    </div>
  );
};
