import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Settings, 
  Flame, 
  Footprints, 
  Timer, 
  ChevronRight, 
  Radio, 
  Bike,
  Activity,
  Plus
} from 'lucide-react';
import { apiRequest } from '../services/api';

export const WorkoutsHub: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    apiRequest('/workouts/config')
      .then(res => setConfig(res))
      .catch(console.error);
  }, []);

  const activities = [
    {
      id: 'running',
      title: 'Outdoor Running',
      icon: Activity,
      color: '#4ade80'
    },
    {
      id: 'cycling',
      title: 'Outdoor Cycling',
      icon: Bike,
      color: '#6bfb9a'
    },
    {
      id: 'walking',
      title: 'Outdoor Walking',
      icon: Footprints,
      color: '#86efac'
    }
  ];

  const sessionCount = config?.weeklyStats?.sessionCount ?? 0;
  const duration = config?.weeklyStats?.formattedDuration ?? '0m';

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top safe-nav-space max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-[#869486] font-semibold">Training</span>
          <h1 className="font-display text-2xl font-black text-white">Workouts</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/workout-settings')}
            className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb] hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Weekly Training Stats Banner */}
      <div className="bg-[#141a18] p-3 rounded-2xl border border-white/5 flex items-center justify-between my-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
          <span className="text-xs text-[#bccabb] font-medium">
            {sessionCount} sessions this week • {duration}
          </span>
        </div>
        <span className="text-xs font-semibold text-[#4ade80]">Live</span>
      </div>

      {/* Featured Protocol */}
      <div className="glass-card rounded-[28px] p-5 my-4 border border-[#4ade80]/20 shadow-glow-subtle relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="px-3 py-1 rounded-full bg-[#4ade80]/15 text-[#4ade80] text-[10px] font-bold tracking-wider uppercase">
            Protocol Mode
          </span>
        </div>

        <h3 className="font-display text-xl font-black text-white mt-2">Active GPS Tracking</h3>
        <p className="text-xs text-[#bccabb] mt-1">Real-time GPS telemetry, split pace, and distance tracking via device sensors.</p>

        <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/5">
          <span className="text-xs text-[#869486]">
            {config?.goal ? `${config.goal.type}: ${config.goal.value} ${config.goal.unit}` : 'Open Goal'}
          </span>
          <button
            onClick={() => navigate('/live-workout')}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-white to-[#4ade80] text-[#0c0f0e] font-display font-bold text-xs flex items-center gap-1.5 shadow-glow-primary active:scale-95 transition-all"
          >
            <span>Start Session</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* GPS Activities List */}
      <div className="space-y-3 my-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-white">Activities</h2>
          <span className="text-[11px] text-[#4ade80] flex items-center gap-1">
            <Radio className="w-3 h-3" /> Ready
          </span>
        </div>

        {activities.map((act) => {
          const Icon = act.icon;
          return (
            <div
              key={act.id}
              className="glass-card p-4 rounded-2xl flex items-center justify-between hover:border-white/20 transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div 
                  className="w-12 h-12 rounded-2xl bg-[#1d201f] border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform"
                  style={{ color: act.color }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-white">{act.title}</h4>
                  <span className="text-xs text-[#869486] block">
                    {config?.selectedActivity === act.id && config?.goal ? `${config.goal.type} ${config.goal.value} ${config.goal.unit}` : 'Open goal'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/workout-settings')}
                  className="w-9 h-9 rounded-full bg-[#141a18] border border-white/5 flex items-center justify-center text-[#869486] hover:text-white"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/live-workout')}
                  className="w-10 h-10 rounded-full bg-[#4ade80] text-[#0c0f0e] flex items-center justify-center shadow-glow-primary hover:scale-105 active:scale-95 transition-all"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
