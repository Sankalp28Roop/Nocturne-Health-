import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Scale, Droplet, Play, Footprints, Check, Utensils } from 'lucide-react';
import { useModalStore } from '../../store/modalStore';
import { apiRequest } from '../../services/api';
import { stepService } from '../../services/stepService';
import { hapticFeedback } from '../../services/haptics';

export const QuickAddModal: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { isQuickAddOpen, closeQuickAdd, openMealScanner } = useModalStore();
  const navigate = useNavigate();

  const [weight, setWeight] = useState('');
  const [hydration, setHydration] = useState('');
  const [steps, setSteps] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isQuickAddOpen) return null;

  const handleRecordWeightRedirect = () => {
    closeQuickAdd();
    navigate('/record-weight');
  };

  const handleStartWorkout = () => {
    closeQuickAdd();
    navigate('/live-workout');
  };

  const handleQuickSave = async () => {
    if (!weight && !hydration && !steps) return;
    try {
      setIsSubmitting(true);
      if (weight) {
        await apiRequest('/biometrics/log', {
          method: 'POST',
          body: JSON.stringify({ weightKg: parseFloat(weight), isFasting: true })
        });
      }
      if (hydration) {
        await apiRequest('/biometrics/hydration', {
          method: 'POST',
          body: JSON.stringify({ amountMl: parseInt(hydration, 10) })
        });
      }
      if (steps) {
        const addedSteps = parseInt(steps, 10);
        if (!isNaN(addedSteps) && addedSteps > 0) {
          stepService.addManualSteps(addedSteps);
        }
      }
      hapticFeedback.success();
      setSuccessMsg('Metrics saved!');
      setTimeout(() => {
        setSuccessMsg(null);
        setWeight('');
        setHydration('');
        setSteps('');
        closeQuickAdd();
        onRefresh?.();
      }, 700);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg glass-modal rounded-t-[32px] sm:rounded-[32px] p-6 pb-10 flex flex-col gap-5 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />
            <h3 className="font-display text-lg font-bold text-white">Log Telemetry</h3>
          </div>
          <button 
            onClick={() => {
              hapticFeedback.light();
              closeQuickAdd();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#bccabb]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            id="open-record-weight-btn"
            onClick={handleRecordWeightRedirect}
            className="p-3 rounded-2xl bg-[#1d201f] hover:bg-[#282b29] border border-white/5 flex flex-col items-start gap-1.5 text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] group-hover:scale-105 transition-transform">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-[#869486] font-medium block">Scale</span>
              <span className="text-xs font-semibold text-white">Record Weight</span>
            </div>
          </button>

          <button
            onClick={handleStartWorkout}
            className="p-3 rounded-2xl bg-[#1d201f] hover:bg-[#282b29] border border-white/5 flex flex-col items-start gap-1.5 text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-[#6bfb9a]/10 flex items-center justify-center text-[#6bfb9a] group-hover:scale-105 transition-transform">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <span className="text-[10px] text-[#869486] font-medium block">GPS</span>
              <span className="text-xs font-semibold text-white">Live Workout</span>
            </div>
          </button>

          <button
            onClick={() => {
              closeQuickAdd();
              openMealScanner();
            }}
            className="p-3 rounded-2xl bg-[#1d201f] hover:bg-[#282b29] border border-[#4ade80]/20 flex flex-col items-start gap-1.5 text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-[#4ade80]/20 flex items-center justify-center text-[#4ade80] group-hover:scale-105 transition-transform">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-[#869486] font-medium block">AI Scanner</span>
              <span className="text-xs font-semibold text-white">Log Meal</span>
            </div>
          </button>
        </div>

        <div className="space-y-3 pt-2">
          <label className="text-xs text-[#bccabb] font-medium flex items-center justify-between">
            <span>Body Weight (kg)</span>
            <span className="text-[10px] text-[#869486]">Enter current scale reading</span>
          </label>
          <div className="flex items-center gap-2 bg-[#141a18] rounded-xl px-4 py-2.5 border border-white/10 focus-within:border-[#4ade80]">
            <Scale className="w-4 h-4 text-[#869486]" />
            <input 
              type="number" 
              step="0.1" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="bg-transparent w-full text-white font-medium focus:outline-none tabular-nums"
              placeholder="e.g. 70.0"
            />
            <span className="text-xs text-[#869486] font-medium">kg</span>
          </div>

          <label className="text-xs text-[#bccabb] font-medium flex items-center justify-between pt-1">
            <span>Log Hydration</span>
            <span className="text-[10px] text-[#4ade80]">Milliliters (ml)</span>
          </label>
          <div className="flex items-center gap-2 bg-[#141a18] rounded-xl px-4 py-2.5 border border-white/10 focus-within:border-[#4ade80]">
            <Droplet className="w-4 h-4 text-[#73db9a]" />
            <input 
              type="number" 
              step="50" 
              value={hydration}
              onChange={(e) => setHydration(e.target.value)}
              className="bg-transparent w-full text-white font-medium focus:outline-none tabular-nums"
              placeholder="e.g. 250"
            />
            <span className="text-xs text-[#869486] font-medium">ml</span>
          </div>

          <label className="text-xs text-[#bccabb] font-medium flex items-center justify-between pt-1">
            <span>Log Walking Steps / Calibration</span>
            <span className="text-[10px] text-[#4ade80]">Steps</span>
          </label>
          <div className="flex items-center gap-2 bg-[#141a18] rounded-xl px-4 py-2.5 border border-white/10 focus-within:border-[#4ade80]">
            <Footprints className="w-4 h-4 text-[#4ade80]" />
            <input 
              type="number" 
              step="100" 
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="bg-transparent w-full text-white font-medium focus:outline-none tabular-nums"
              placeholder="e.g. 4500"
            />
            <span className="text-xs text-[#869486] font-medium">steps</span>
          </div>
        </div>

        <button
          onClick={handleQuickSave}
          disabled={isSubmitting || (!weight && !hydration && !steps)}
          className={`w-full mt-2 py-3.5 rounded-full font-display font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
            !weight && !hydration && !steps
              ? 'bg-[#191c1b] text-[#5e6e66] cursor-not-allowed'
              : 'bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] shadow-glow-primary active:scale-[0.98]'
          }`}
        >
          {successMsg ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{successMsg}</span>
            </>
          ) : (
            <span>Save Metrics</span>
          )}
        </button>
      </div>
    </div>
  );
};
