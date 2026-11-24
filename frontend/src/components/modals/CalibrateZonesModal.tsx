import React, { useState } from 'react';
import { X, Check, Sliders } from 'lucide-react';
import { useModalStore } from '../../store/modalStore';
import { apiRequest } from '../../services/api';

export const CalibrateZonesModal: React.FC<{ onCalibrated?: () => void }> = ({ onCalibrated }) => {
  const { isCalibrateOpen, closeCalibrate } = useModalStore();

  const [age, setAge] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [method, setMethod] = useState<'tanaka' | 'gulati' | 'custom'>('tanaka');
  const [customMaxHr, setCustomMaxHr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isCalibrateOpen) return null;

  const numAge = parseInt(age, 10);
  const numResting = parseInt(restingHr, 10);
  const numCustomMax = parseInt(customMaxHr, 10);

  const hasValidInputs = !isNaN(numAge) && numAge > 10 && !isNaN(numResting) && numResting > 30;

  const calculatePreview = () => {
    if (!hasValidInputs) return [];
    let max = 0;
    if (method === 'tanaka') max = Math.round(208 - 0.7 * numAge);
    else if (method === 'gulati') max = Math.round(206 - 0.88 * numAge);
    else max = numCustomMax || 0;

    if (max <= numResting) return [];

    const hrr = Math.max(0, max - numResting);
    return [
      { zone: 1, name: 'Recovery', min: Math.round(numResting + hrr * 0.5), max: Math.round(numResting + hrr * 0.6) - 1 },
      { zone: 2, name: 'Aerobic Base', min: Math.round(numResting + hrr * 0.6), max: Math.round(numResting + hrr * 0.7) - 1 },
      { zone: 3, name: 'Tempo', min: Math.round(numResting + hrr * 0.7), max: Math.round(numResting + hrr * 0.8) - 1 },
      { zone: 4, name: 'Threshold', min: Math.round(numResting + hrr * 0.8), max: Math.round(numResting + hrr * 0.9) - 1 },
      { zone: 5, name: 'Peak', min: Math.round(numResting + hrr * 0.9), max: max },
    ];
  };

  const currentPreview = calculatePreview();

  const handleSave = async () => {
    if (!hasValidInputs) return;
    try {
      setIsSaving(true);
      await apiRequest('/analytics/cardio/zones', {
        method: 'PUT',
        body: JSON.stringify({
          age: numAge,
          restingHr: numResting,
          method,
          customMaxHr: method === 'custom' ? numCustomMax : undefined
        })
      });
      closeCalibrate();
      onCalibrated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to save calibration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="zone-modal-sheet"
        className="w-full max-w-lg glass-modal rounded-t-[32px] sm:rounded-[32px] p-6 pb-10 flex flex-col gap-5 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#4ade80]" />
            <h3 className="font-display text-lg font-bold text-white">Calibrate Max HR & Zones</h3>
          </div>
          <button 
            onClick={closeCalibrate}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#bccabb]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formula Selection Tabs */}
        <div className="flex rounded-full bg-[#141a18] p-1 border border-white/5">
          {[
            { id: 'tanaka', label: 'Tanaka' },
            { id: 'gulati', label: 'Gulati' },
            { id: 'custom', label: 'Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMethod(tab.id as any)}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                method === tab.id
                  ? 'bg-white text-[#0c0f0e] shadow-md'
                  : 'text-[#869486] hover:text-[#bccabb]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#141a18] p-3 rounded-2xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Age</span>
            <input 
              type="number" 
              placeholder="e.g. 28"
              value={age} 
              onChange={(e) => setAge(e.target.value)}
              className="bg-transparent text-xl font-bold text-white w-full focus:outline-none tabular-nums mt-1"
            />
          </div>

          <div className="bg-[#141a18] p-3 rounded-2xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Resting HR (bpm)</span>
            <input 
              type="number" 
              placeholder="e.g. 60"
              value={restingHr} 
              onChange={(e) => setRestingHr(e.target.value)}
              className="bg-transparent text-xl font-bold text-[#4ade80] w-full focus:outline-none tabular-nums mt-1"
            />
          </div>
        </div>

        {method === 'custom' && (
          <div className="bg-[#141a18] p-3 rounded-2xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Custom Max HR (bpm)</span>
            <input 
              type="number" 
              placeholder="e.g. 190"
              value={customMaxHr} 
              onChange={(e) => setCustomMaxHr(e.target.value)}
              className="bg-transparent text-xl font-bold text-white w-full focus:outline-none tabular-nums mt-1"
            />
          </div>
        )}

        {/* Live Zones Preview */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-[#bccabb]">Calculated Zone Ranges</span>
          {currentPreview.length > 0 ? (
            <div className="space-y-1.5">
              {currentPreview.map((z) => (
                <div key={z.zone} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#1d201f] border border-white/5 text-xs">
                  <span className="text-[#869486] font-medium">Zone {z.zone} • {z.name}</span>
                  <span className="font-semibold text-white tabular-nums">{z.min} – {z.max} bpm</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#141a18] border border-white/5 text-center text-xs text-[#5e6e66]">
              Enter age and resting HR to preview your 5 target zones.
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !hasValidInputs}
          className={`w-full py-3.5 rounded-full font-display font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 mt-2 ${
            !hasValidInputs
              ? 'bg-[#191c1b] text-[#5e6e66] cursor-not-allowed'
              : 'bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] shadow-glow-primary active:scale-[0.98]'
          }`}
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Save Calibrated Zones</span>
        </button>
      </div>
    </div>
  );
};
