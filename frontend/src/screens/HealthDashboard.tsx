import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  MoreHorizontal, 
  Plus, 
  Zap, 
  ChevronRight, 
  Scale, 
  Moon, 
  Heart, 
  Check, 
  Bot, 
  Sparkles, 
  Music, 
  Mic, 
  Activity, 
  Flame, 
  Navigation, 
  Target,
  Utensils,
  Wind
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useModalStore } from '../store/modalStore';
import { useMusicStore } from '../store/musicStore';
import { wakeWordService } from '../services/wakeWord';
import { stepService, StepTrackerResult } from '../services/stepService';
import { QuickAddModal } from '../components/modals/QuickAddModal';
import { hapticFeedback } from '../services/haptics';

export const HealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { openQuickAdd, openAiCoach, openMealScanner } = useModalStore();
  const { toggleDrawer } = useMusicStore();
  const [isWakeWordActive, setIsWakeWordActive] = useState(wakeWordService.isWakeWordListening());
  const [livePedometer, setLivePedometer] = useState<StepTrackerResult | null>(null);
  const [weeklyStats, setWeeklyStats] = useState(stepService.getWeeklyMetrics());
  const [data, setData] = useState<any>(null);
  const [todayNutrition, setTodayNutrition] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasCelebratedMilestone, setHasCelebratedMilestone] = useState(false);

  useEffect(() => {
    // Initial fetch from pedometer hardware sensor
    stepService.getRealDailyMetrics().then((metrics) => {
      setLivePedometer(metrics);
      setWeeklyStats(stepService.getWeeklyMetrics());
      if (metrics.steps >= 10000 && !hasCelebratedMilestone) {
        hapticFeedback.milestone();
        setHasCelebratedMilestone(true);
      }
    });

    // Listen to real-time step increments
    const unsub = stepService.addListener((metrics) => {
      setLivePedometer(metrics);
      setWeeklyStats(stepService.getWeeklyMetrics());
      if (metrics.steps >= 10000 && !hasCelebratedMilestone) {
        hapticFeedback.milestone();
        setHasCelebratedMilestone(true);
      }
    });

    const unsubWake = wakeWordService.addStatusListener((active) => {
      setIsWakeWordActive(active);
    });

    return () => {
      unsub();
      unsubWake();
    };
  }, [hasCelebratedMilestone]);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const [summaryRes, nutritionRes] = await Promise.all([
        apiRequest('/dashboard/summary'),
        apiRequest('/nutrition/today').catch(() => null)
      ]);
      setData(summaryRes);
      setTodayNutrition(nutritionRes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const kineticScore = data?.kineticScore ?? (livePedometer ? Math.min(100, Math.round((livePedometer.steps / 10000) * 100)) : 0);
  const activeCurrent = livePedometer?.moveMinutes || data?.activeMinutes?.current || 0;
  const activeTarget = data?.activeMinutes?.target || 45;
  const stepsCurrent = livePedometer?.steps || data?.steps?.current || 0;
  const stepsTarget = data?.steps?.target || 10000;
  const burnCurrent = livePedometer?.calories || data?.caloriesBurned?.current || 0;
  const burnTarget = data?.caloriesBurned?.target || 600;
  const distanceKmCurrent = livePedometer?.distanceKm || (stepsCurrent ? Math.round(((stepsCurrent * 0.762) / 1000) * 10) / 10 : 0);
  const heartPointsCurrent = livePedometer?.heartPoints || Math.round(stepsCurrent / 100);

  const weight = data?.recentVitals?.weightKg;
  const sleepFormatted = data?.recentVitals?.sleepHoursFormatted;
  const sleepScore = data?.recentVitals?.sleepScore;
  const restingHr = data?.recentVitals?.restingHeartRateBpm;

  // Contextual Dynamic Greeting
  const getContextualGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      if (sleepScore) {
        return `Good Morning • Sleep score ${sleepScore} • Ready for a fresh start?`;
      }
      return 'Good Morning • Fresh day to crush your fitness goals';
    } else if (hour < 17) {
      const remainingSteps = Math.max(0, stepsTarget - stepsCurrent);
      if (remainingSteps > 0) {
        return `Good Afternoon • ${remainingSteps.toLocaleString()} steps to reach your daily goal`;
      }
      return 'Good Afternoon • Daily step target already completed! 🔥';
    } else {
      const remainingSteps = Math.max(0, stepsTarget - stepsCurrent);
      if (remainingSteps > 0) {
        return `Good Evening • ${remainingSteps.toLocaleString()} steps left for today`;
      }
      return 'Good Evening • Perfect time for recovery & relaxation';
    }
  };

  // Dynamic Friday AI Insight
  const getFridayInsight = () => {
    if (kineticScore >= 80) {
      return 'Recovery looks optimal today. High intensity workout recommended.';
    } else if (kineticScore >= 50) {
      return 'Moderate readiness. Great condition for steady cardio or cycling.';
    } else if (stepsCurrent > 0) {
      return 'Light recovery suggested today. Keep moving with relaxed walking.';
    }
    return 'Log your first workout or sleep session to get personalized AI coaching.';
  };

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top safe-nav-space max-w-lg mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between py-2">
        <div className="min-w-0 pr-2">
          <p className="text-[11px] font-semibold text-[#869486] truncate">
            {getContextualGreeting()}
          </p>
          <h1 className="font-display text-2xl font-black text-white flex items-center gap-2">
            Nocturne Health
            <span className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]" />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isWakeWordActive && (
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4ade80]/15 border border-[#4ade80]/40 text-[#4ade80] text-[10px] font-semibold animate-pulse"
              title="Hands-free 'Hey Friday' listening active"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-ping" />
              <span>Friday Ready</span>
            </div>
          )}
          <button 
            onClick={() => {
              hapticFeedback.light();
              openAiCoach();
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#191c1b] via-[#202923] to-[#4ade80]/30 border border-[#4ade80]/40 flex items-center justify-center text-[#4ade80] hover:scale-105 active:scale-95 transition-all shadow-glow-primary group"
            title="Open Friday AI Coach"
          >
            <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => {
              hapticFeedback.light();
              toggleDrawer();
            }}
            className="w-10 h-10 rounded-full bg-[#191c1b] border border-[#4ade80]/40 flex items-center justify-center text-[#4ade80] hover:scale-105 active:scale-95 transition-all shadow-glow-primary"
            title="Open Music Player"
          >
            <Music className="w-4 h-4" />
          </button>
          <button 
            onClick={() => hapticFeedback.light()}
            className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb] hover:text-white active:scale-95 transition-all"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              hapticFeedback.light();
              navigate('/my-page');
            }}
            className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb] hover:text-white active:scale-95 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Friday AI Mini-Insight Pill */}
      <div 
        onClick={() => {
          hapticFeedback.light();
          openAiCoach();
        }}
        className="my-2 p-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-[#141a18] via-[#1b2620] to-[#141a18] border border-[#4ade80]/30 shadow-glow-subtle flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#4ade80]/20 flex items-center justify-center text-[#4ade80] flex-shrink-0 group-hover:rotate-12 transition-transform">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="text-[11px] text-[#bccabb] truncate font-medium">
            <strong className="text-white font-semibold">Friday:</strong> {getFridayInsight()}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-[#869486] group-hover:text-white transition-colors flex-shrink-0 ml-1" />
      </div>

      {/* Hero Kinetic Score */}
      <section className="glass-card rounded-[28px] p-5 my-4 shadow-glow-subtle relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#4ade80]/20 flex items-center justify-center text-[#4ade80]">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-display font-bold text-sm tracking-wide text-white">Kinetic Readiness</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#141a18] border border-white/10 text-[#869486] text-[11px] font-semibold">
            {kineticScore > 0 ? 'Active' : 'Awaiting data'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-black text-white tracking-tight tabular-nums">
                {kineticScore > 0 ? kineticScore : 0}
              </span>
              <span className="text-[#4ade80] font-bold text-xl">%</span>
            </div>
            <p className="text-xs text-[#bccabb]">
              {kineticScore > 0 
                ? 'Calculated from your real workouts and sleep.'
                : 'Record your first workout or sleep session to compute readiness.'}
            </p>
          </div>

          {/* SVG Progress Arc */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-[#191c1b]"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="url(#neonGradient)"
                strokeWidth="10"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (1 - (kineticScore > 0 ? kineticScore : 0) / 100)}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
              <defs>
                <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#86efac" />
                  <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-xs font-bold text-white tabular-nums">
                {kineticScore > 0 ? kineticScore : 0}%
              </span>
              <span className="text-[9px] text-[#869486] uppercase font-semibold">Target</span>
            </div>
          </div>
        </div>

        {/* Google Fit Style: 4-Metric Grid (Heart Points, Steps, Calories, Distance) */}
        <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-white/5 text-center">
          <div className="bg-[#141a18] p-2 rounded-2xl border border-white/5 flex flex-col items-center">
            <span className="text-[10px] text-[#4ade80] font-bold flex items-center gap-0.5">
              <Heart className="w-2.5 h-2.5 fill-current" />
              <span>Heart Pts</span>
            </span>
            <span className="text-sm font-black text-white tabular-nums mt-0.5">{heartPointsCurrent}</span>
            <span className="text-[9px] text-[#869486] block mt-0.5">WHO Goal</span>
          </div>

          <div className="bg-[#141a18] p-2 rounded-2xl border border-white/5 flex flex-col items-center">
            <span className="text-[10px] text-[#869486] font-medium flex items-center gap-0.5">
              <Activity className="w-2.5 h-2.5 text-[#86efac]" />
              <span>Steps</span>
            </span>
            <span className="text-sm font-black text-white tabular-nums mt-0.5">{stepsCurrent.toLocaleString()}</span>
            <span className="text-[9px] text-[#5e6e66] block mt-0.5">{stepsTarget ? `/ ${(stepsTarget/1000).toFixed(0)}k` : ''}</span>
          </div>

          <div className="bg-[#141a18] p-2 rounded-2xl border border-white/5 flex flex-col items-center">
            <span className="text-[10px] text-[#869486] font-medium flex items-center gap-0.5">
              <Flame className="w-2.5 h-2.5 text-orange-400" />
              <span>Calories</span>
            </span>
            <span className="text-sm font-black text-white tabular-nums mt-0.5">{burnCurrent}</span>
            <span className="text-[9px] text-[#5e6e66] block mt-0.5">kcal</span>
          </div>

          <div className="bg-[#141a18] p-2 rounded-2xl border border-white/5 flex flex-col items-center">
            <span className="text-[10px] text-[#869486] font-medium flex items-center gap-0.5">
              <Navigation className="w-2.5 h-2.5 text-cyan-400" />
              <span>Distance</span>
            </span>
            <span className="text-sm font-black text-white tabular-nums mt-0.5">{distanceKmCurrent}</span>
            <span className="text-[9px] text-[#5e6e66] block mt-0.5">km</span>
          </div>
        </div>
      </section>

      {/* WHO Heart Points Card: Scoring 150 Heart Points a Week */}
      <section className="bg-gradient-to-r from-[#141a18] to-[#1a231f] rounded-3xl p-4 border border-[#4ade80]/30 shadow-glow-subtle my-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#4ade80]/20 flex items-center justify-center text-[#4ade80]">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-display font-black text-xs text-white">WHO Heart Points</h3>
              <p className="text-[10px] text-[#869486]">150 pts/week for longevity & sleep</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-[#4ade80] tabular-nums">
              {weeklyStats.totalHeartPoints}
            </span>
            <span className="text-[10px] text-[#869486] font-bold"> / 150 pts</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden my-2 border border-white/5">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((weeklyStats.totalHeartPoints / 150) * 100))}%` }}
          />
        </div>

        <p className="text-[10px] text-[#bccabb] mt-1 italic">
          "Scoring 150 Heart Points a week can help you live longer, sleep better, and boost your mind." — World Health Organization (WHO)
        </p>
      </section>

      {/* Google Fit Style: Monday to Sunday Weekly Goals Tracker */}
      <section className="bg-[#141a18] rounded-3xl p-4 border border-white/5 my-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-bold text-white tracking-wide block">Monday to Sunday Activity</span>
            <span className="text-[10px] text-[#869486]">Daily goals & heart points achieved</span>
          </div>
          <span className="text-xs font-semibold text-[#4ade80] bg-[#4ade80]/15 px-2.5 py-0.5 rounded-full">
            {weeklyStats.days.filter(d => d.completed).length} / 7 Days
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weeklyStats.days.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1 p-1 rounded-xl bg-black/20 border border-white/5">
              <span className="text-[10px] font-bold text-[#869486]">{d.day}</span>
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  d.completed 
                    ? 'bg-gradient-to-br from-white to-[#4ade80] text-black shadow-glow-primary' 
                    : d.steps > 0
                    ? 'bg-[#1e2723] text-[#4ade80] border border-[#4ade80]/40'
                    : 'bg-[#141a18] text-[#5e6e66] border border-white/5'
                }`}
              >
                {d.completed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : d.steps > 0 ? `${Math.round(d.steps / 1000)}k` : '-'}
              </div>
              <span className="text-[8px] text-[#869486] font-medium tabular-nums">
                {d.steps > 0 ? `${d.steps}` : '0'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Biometric Deep-Dive Cards */}
      <div className="space-y-3 my-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-white">Continuous Telemetry</h2>
          <button 
            id="quick-add-btn"
            onClick={openQuickAdd}
            className="flex items-center gap-1 text-xs font-bold text-[#4ade80] bg-[#4ade80]/10 px-3 py-1.5 rounded-full hover:bg-[#4ade80]/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Record</span>
          </button>
        </div>

        {/* Weight Card */}
        <div 
          onClick={() => {
            hapticFeedback.light();
            navigate('/weight-analytics');
          }}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 active:scale-[0.98] transition-transform duration-150 ease-out group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1d201f] border border-white/5 flex items-center justify-center text-[#4ade80] group-hover:scale-105 transition-transform">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#869486] font-medium block">Body Weight</span>
              <div className="flex items-baseline gap-1.5">
                {isLoading ? (
                  <div className="h-5 w-16 rounded skeleton-shimmer mt-0.5" />
                ) : weight !== null && weight !== undefined ? (
                  <>
                    <span className="text-xl font-bold text-white tabular-nums">{weight}</span>
                    <span className="text-xs text-[#bccabb]">kg</span>
                  </>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">No weight logged</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#869486] group-hover:text-white transition-colors" />
        </div>

        {/* Sleep Card */}
        <div 
          onClick={() => {
            hapticFeedback.light();
            navigate('/sleep-analytics');
          }}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 active:scale-[0.98] transition-transform duration-150 ease-out group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1d201f] border border-white/5 flex items-center justify-center text-[#86efac] group-hover:scale-105 transition-transform">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#869486] font-medium block">Sleep Architecture</span>
              <div className="flex items-baseline gap-1.5">
                {isLoading ? (
                  <div className="h-5 w-20 rounded skeleton-shimmer mt-0.5" />
                ) : sleepFormatted ? (
                  <>
                    <span className="text-xl font-bold text-white tabular-nums">{sleepFormatted}</span>
                    {sleepScore && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#4ade80]/10 text-[#4ade80] font-semibold ml-2">
                        Score {sleepScore}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">No sleep logged</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#869486] group-hover:text-white transition-colors" />
        </div>

        {/* Cardio / HR Card */}
        <div 
          onClick={() => {
            hapticFeedback.light();
            navigate('/cardio-analytics');
          }}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 active:scale-[0.98] transition-transform duration-150 ease-out group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1d201f] border border-white/5 flex items-center justify-center text-[#6bfb9a] group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="text-[11px] text-[#869486] font-medium block">Cardio Fitness & Zones</span>
              <div className="flex items-baseline gap-1.5">
                {isLoading ? (
                  <div className="h-5 w-16 rounded skeleton-shimmer mt-0.5" />
                ) : restingHr !== null && restingHr !== undefined ? (
                  <>
                    <span className="text-xl font-bold text-white tabular-nums">{restingHr}</span>
                    <span className="text-xs text-[#bccabb]">bpm (Resting)</span>
                  </>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">Not calibrated</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#869486] group-hover:text-white transition-colors" />
        </div>

        {/* Daily Nutrition & Calorie Card */}
        <div 
          onClick={() => {
            hapticFeedback.light();
            openMealScanner();
          }}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 active:scale-[0.98] transition-transform duration-150 ease-out group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1d201f] border border-white/5 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#869486] font-medium block">Daily Nutrition & Macros</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-400/10 text-cyan-400 font-bold">Food Scanner</span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                {todayNutrition?.totals && todayNutrition.totals.loggedMealCount > 0 ? (
                  <>
                    <span className="text-xl font-bold text-white tabular-nums">
                      {todayNutrition.totals.calories}
                    </span>
                    <span className="text-xs text-[#bccabb]">/ {todayNutrition.totals.targetCalories} kcal</span>
                    <span className="text-[10px] text-[#869486] ml-1">
                      ({todayNutrition.totals.proteinG}g P • {todayNutrition.totals.carbsG}g C)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">No meals logged today • Tap to scan</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#869486] group-hover:text-white transition-colors" />
        </div>

        {/* Stress & Box Breathing Card */}
        <div 
          onClick={() => {
            hapticFeedback.light();
            navigate('/breathing');
          }}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 active:scale-[0.98] transition-transform duration-150 ease-out group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1d201f] border border-white/5 flex items-center justify-center text-[#6bfb9a] group-hover:scale-105 transition-transform">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#869486] font-medium block">Stress Relief & Vagus Nerve</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-white">4-4-4-4 Box Breathing</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4ade80]/10 text-[#4ade80] font-bold">
                  2 Min Reset
                </span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#869486] group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Floating Nocturne AI Coach FAB / Pill */}
      <div className="fixed bottom-24 right-4 z-40">
        <button
          onClick={openAiCoach}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-extrabold text-xs shadow-xl shadow-[#4ade80]/25 hover:opacity-95 active:scale-95 transition-all border border-white/40"
        >
          <div className="w-5 h-5 rounded-full bg-[#0c0f0e] flex items-center justify-center text-[#6bfb9a] group-hover:rotate-12 transition-transform">
            <Sparkles className="w-3 h-3 fill-current" />
          </div>
          <span>AI Coach</span>
        </button>
      </div>

      <QuickAddModal onRefresh={fetchSummary} />
    </div>
  );
};
