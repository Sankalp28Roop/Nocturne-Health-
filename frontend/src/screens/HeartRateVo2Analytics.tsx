import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sliders } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useModalStore } from '../store/modalStore';
import { CalibrateZonesModal } from '../components/modals/CalibrateZonesModal';

export const HeartRateVo2Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { openCalibrate } = useModalStore();

  const [data, setData] = useState<any>(null);
  const [timeframe, setTimeframe] = useState('day');

  const fetchCardio = async () => {
    try {
      const res = await apiRequest(`/analytics/cardio?timeframe=${timeframe}`);
      setData(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCardio();
  }, [timeframe]);

  const vo2Max = data?.vo2Max;
  const fitnessAge = data?.fitnessAge;
  const restingHr = data?.restingHrBpm;
  const hrv = data?.nightlyHrvMs;
  const zones = data?.zones || [];

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
        <h1 className="font-display text-base font-bold text-white">Cardiovascular Telemetry</h1>
        <button
          onClick={openCalibrate}
          className="w-9 h-9 rounded-full bg-[#4ade80] text-[#0c0f0e] flex items-center justify-center shadow-glow-primary active:scale-95 transition-all"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </header>

      {/* Timeframe Tabs */}
      <div className="flex rounded-full bg-[#141a18] p-1 border border-white/5 my-3">
        {['Day', 'Week', 'Month', '6M'].map(t => {
          const isSel = timeframe === t.toLowerCase();
          return (
            <button
              key={t}
              onClick={() => setTimeframe(t.toLowerCase())}
              className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                isSel ? 'bg-white text-[#0c0f0e] shadow-md' : 'text-[#869486] hover:text-white'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Hero VO2 Max Card */}
      <section className="glass-card p-6 rounded-[28px] my-3 border border-white/10 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#4ade80] font-bold uppercase tracking-wider">
            Estimated VO2 Max
          </span>
          {data?.vo2MaxRank && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#4ade80]/15 text-[#4ade80] text-[10px] font-bold">
              {data.vo2MaxRank}
            </span>
          )}
        </div>

        <div className="my-3 flex items-baseline gap-2">
          <span className="font-display text-6xl font-black text-white tabular-nums tracking-tight">
            {vo2Max !== null && vo2Max !== undefined ? vo2Max : '--'}
          </span>
          <span className="text-sm font-bold text-[#bccabb]">mL/kg/min</span>
          {data?.vo2MaxTier && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-white text-black font-extrabold ml-auto">
              {data.vo2MaxTier}
            </span>
          )}
        </div>

        {!vo2Max && (
          <p className="text-xs text-[#5e6e66] mt-2">
            Calibrate your Max HR and complete a GPS workout to generate an estimated VO2 Max.
          </p>
        )}
      </section>

      {/* Fitness Age & HRV Trajectory */}
      <div className="grid grid-cols-2 gap-3 my-3">
        <div className="glass-card p-4 rounded-3xl border border-white/5">
          <span className="text-[11px] text-[#869486] font-medium block">Fitness Age</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-display text-3xl font-black text-white tabular-nums">
              {fitnessAge !== null && fitnessAge !== undefined ? fitnessAge : '--'}
            </span>
            <span className="text-xs font-bold text-[#4ade80]">yrs</span>
          </div>
          <span className="text-[10px] text-[#5e6e66] mt-1 block">Requires calibration</span>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-white/5">
          <span className="text-[11px] text-[#869486] font-medium block">Resting HR</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-display text-3xl font-black text-white tabular-nums">
              {restingHr !== null && restingHr !== undefined ? restingHr : '--'}
            </span>
            <span className="text-xs font-bold text-[#86efac]">bpm</span>
          </div>
          <span className="text-[10px] text-[#5e6e66] mt-1 block">Baseline resting</span>
        </div>
      </div>

      {/* 5-Zone Heart Rate Distribution */}
      <section className="glass-card p-5 rounded-[28px] my-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-xs text-white">5-Zone Heart Distribution</h3>
          <button
            onClick={openCalibrate}
            className="text-[11px] font-bold text-[#4ade80] hover:underline"
          >
            Calibrate Zones
          </button>
        </div>

        {zones.length > 0 ? (
          <div className="space-y-2 py-1">
            {zones.map((z: any) => (
              <div key={z.zone} className="p-3 rounded-2xl bg-[#141a18] border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Zone {z.zone} • {z.name}</span>
                  <span className="text-[10px] text-[#869486] font-medium">{z.minBpm} – {z.maxBpm} bpm</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-[#4ade80] tabular-nums block">{z.minutesSpent}m</span>
                  <span className="text-[9px] text-[#869486]">active</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#5e6e66] border border-dashed border-white/10 rounded-2xl my-2">
            No heart rate zones calibrated yet. Tap 'Calibrate Zones' to set up your zones.
          </div>
        )}
      </section>

      <CalibrateZonesModal onCalibrated={fetchCardio} />
    </div>
  );
};
