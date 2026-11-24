import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Scale, Ruler, Calendar } from 'lucide-react';
import { apiRequest } from '../services/api';

export const RecordWeightHeight: React.FC = () => {
  const navigate = useNavigate();

  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [isFasting, setIsFasting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(4);

  const days = [
    { label: 'M', date: 20 },
    { label: 'T', date: 21 },
    { label: 'W', date: 22 },
    { label: 'T', date: 23 },
    { label: 'F', date: 24, isToday: true },
    { label: 'S', date: 25 },
    { label: 'S', date: 26 },
  ];

  useEffect(() => {
    // Load last real saved biometrics
    apiRequest('/user/profile')
      .then(res => {
        if (res.biometrics?.weightKg) setWeightKg(res.biometrics.weightKg);
        if (res.biometrics?.heightCm) setHeightCm(res.biometrics.heightCm);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!weightKg) return;
    try {
      setIsSaving(true);
      await apiRequest('/biometrics/log', {
        method: 'POST',
        body: JSON.stringify({
          weightKg,
          heightCm: heightCm || undefined,
          isFasting
        })
      });
      navigate(-1);
    } catch (err: any) {
      alert(err.message || 'Failed to save biometrics');
    } finally {
      setIsSaving(false);
    }
  };

  const displayWeight = weightKg !== null
    ? (unit === 'kg' ? weightKg : Number((weightKg * 2.20462).toFixed(1)))
    : '--';

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-10 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-base font-bold text-white">Record Body Metrics</h1>
        <button
          onClick={handleSave}
          disabled={isSaving || weightKg === null}
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-glow-primary active:scale-95 transition-all ${
            weightKg !== null ? 'bg-[#4ade80] text-[#0c0f0e]' : 'bg-[#191c1b] text-[#5e6e66] cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>
      </header>

      {/* Date Carousel */}
      <div className="bg-[#141a18] p-3 rounded-2xl border border-white/5 my-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5 text-xs text-[#bccabb] font-semibold">
            <Calendar className="w-3.5 h-3.5 text-[#4ade80]" />
            <span>Measurement Date</span>
          </div>
          <button
            onClick={() => setIsFasting(!isFasting)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition-all ${
              isFasting ? 'bg-[#4ade80]/20 text-[#4ade80]' : 'bg-[#191c1b] text-[#869486]'
            }`}
          >
            {isFasting ? 'Fasting' : 'Non-fasting'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          {days.map((d, idx) => {
            const isSel = selectedDayIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDayIndex(idx)}
                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
                  isSel
                    ? 'bg-[#4ade80] text-[#0c0f0e] font-bold shadow-glow-primary'
                    : 'text-[#869486] hover:text-white'
                }`}
              >
                <span className="text-[10px] uppercase">{d.label}</span>
                <span className="text-xs">{d.date}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weight Dial Stepper Card */}
      <section className="glass-card p-6 rounded-[28px] my-4 border border-white/10 text-center relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#4ade80]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Body Weight</span>
          </div>
          {/* Unit Toggle */}
          <div className="flex rounded-full bg-[#141a18] p-0.5 border border-white/5">
            <button
              onClick={() => setUnit('kg')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${unit === 'kg' ? 'bg-white text-[#0c0f0e]' : 'text-[#869486]'}`}
            >
              kg
            </button>
            <button
              onClick={() => setUnit('lbs')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${unit === 'lbs' ? 'bg-white text-[#0c0f0e]' : 'text-[#869486]'}`}
            >
              lbs
            </button>
          </div>
        </div>

        {/* Big Weight Readout */}
        <div className="py-4">
          <span className="font-display text-6xl font-black text-white tabular-nums tracking-tight">
            {displayWeight}
          </span>
          {weightKg !== null && <span className="text-lg font-bold text-[#4ade80] ml-1">{unit}</span>}
          {weightKg === null && <span className="text-xs text-[#5e6e66] block mt-1">Tap + to calibrate weight</span>}
        </div>

        {/* Stepper Buttons (0.1 increments) */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <button
            onClick={() => setWeightKg(w => Math.max(30, Number(((w || 70) - 0.1).toFixed(1))))}
            className="w-12 h-12 rounded-full bg-[#191c1b] border border-white/10 text-white font-bold text-xl active:scale-95 flex items-center justify-center"
          >
            -
          </button>
          <span className="text-xs text-[#869486] font-medium">Calibrate 0.1</span>
          <button
            onClick={() => setWeightKg(w => Number(((w || 69) + 0.1).toFixed(1)))}
            className="w-12 h-12 rounded-full bg-[#191c1b] border border-white/10 text-white font-bold text-xl active:scale-95 flex items-center justify-center"
          >
            +
          </button>
        </div>
      </section>

      {/* Height Calibration Card */}
      <section className="glass-card p-6 rounded-[28px] my-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#86efac]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Height Calibration</span>
          </div>
          <span className="text-xs font-bold text-white tabular-nums">
            {heightCm ? `${heightCm} cm` : 'Not set'}
          </span>
        </div>

        <input
          type="range"
          min="130"
          max="220"
          value={heightCm || 170}
          onChange={(e) => setHeightCm(parseInt(e.target.value, 10))}
          className="w-full accent-[#4ade80] bg-[#191c1b] h-2 rounded-full cursor-pointer"
        />

        <div className="flex items-center justify-between text-[11px] text-[#869486] mt-2 font-medium">
          <span>130 cm</span>
          <span className="text-[#4ade80] font-bold">
            {weightKg && heightCm ? `BMI: ${(weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)}` : 'Enter height & weight'}
          </span>
          <span>220 cm</span>
        </div>
      </section>
    </div>
  );
};
