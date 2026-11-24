import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Swords, 
  Plus, 
  Timer, 
  Search,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { hapticFeedback } from '../services/haptics';

export const CommunityChallenges: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'leaderboards' | 'clubs'>('active');
  const [data, setData] = useState<any>(null);
  const [cheerCount, setCheerCount] = useState(0);
  const [hasCheered, setHasCheered] = useState(false);
  const [isLoggingRide, setIsLoggingRide] = useState(false);

  const fetchChallenges = async () => {
    try {
      const res = await apiRequest(`/community/challenges?tab=${tab}`);
      setData(res);
      if (res.rivalries?.[0]) {
        setCheerCount(res.rivalries[0].cheersCount ?? 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, [tab]);

  const handleHighFive = async () => {
    if (hasCheered) return;
    hapticFeedback.light();
    // Optimistic UI update
    setHasCheered(true);
    setCheerCount(c => c + 1);

    const rivalryId = data?.rivalries?.[0]?.id;
    if (rivalryId) {
      await apiRequest(`/community/rivalries/${rivalryId}/cheer`, { method: 'POST' }).catch(console.error);
    }
  };

  const handleLogRide = async () => {
    if (!challenge?.id) return;
    try {
      hapticFeedback.medium();
      setIsLoggingRide(true);
      // Optimistic update of challenge progress
      if (challenge?.userProgress) {
        const nextCompleted = (challenge.userProgress.completedKm || 0) + 5.0;
        const nextPct = Math.min(100, Math.round((nextCompleted / challenge.userProgress.targetKm) * 100));
        setData((prev: any) => ({
          ...prev,
          featuredChallenge: {
            ...prev?.featuredChallenge,
            userProgress: {
              ...prev?.featuredChallenge?.userProgress,
              completedKm: nextCompleted,
              percentage: nextPct
            }
          }
        }));
      }

      await apiRequest(`/community/challenges/${challenge.id}/log`, {
        method: 'POST',
        body: JSON.stringify({ amount: 5.0 })
      });
      hapticFeedback.success();
      fetchChallenges();
    } catch (err: any) {
      alert(err.message || 'Failed to log progress');
      fetchChallenges();
    } finally {
      setIsLoggingRide(false);
    }
  };

  const challenge = data?.featuredChallenge;
  const rivalries = data?.rivalries || [];
  const leaderboards = data?.leaderboards || [];

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top safe-nav-space max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-[#869486] font-semibold">Social & Rivalries</span>
          <h1 className="font-display text-2xl font-black text-white">Community</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]">
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex rounded-full bg-[#141a18] p-1 border border-white/5 my-3">
        {[
          { id: 'active', label: 'Active' },
          { id: 'leaderboards', label: 'Leaderboards' },
          { id: 'clubs', label: 'Clubs & Squads' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
              tab === t.id ? 'bg-white text-[#0c0f0e] shadow-md' : 'text-[#869486] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div className="space-y-4 my-3">
          {challenge ? (
            <section className="glass-card p-5 rounded-[28px] border border-[#4ade80]/20 shadow-glow-subtle relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-[#4ade80]/15 text-[#4ade80] text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                  <Trophy className="w-3 h-3" /> Featured Sprint
                </span>
                <span className="text-xs text-[#869486] font-semibold flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5" /> {challenge.daysRemaining} Days Left
                </span>
              </div>

              <h3 className="font-display text-lg font-black text-white mt-2">
                {challenge.title}
              </h3>
              <p className="text-xs text-[#bccabb] mt-1">
                {challenge.description}
              </p>

              <div className="my-4 bg-[#141a18] p-3.5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[#869486] font-medium">Your Milestone</span>
                  <span className="font-bold text-white tabular-nums">
                    {challenge.userProgress?.completedKm ?? 0} / {challenge.userProgress?.targetKm} km
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#191c1b] overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] rounded-full transition-all"
                    style={{ width: `${challenge.userProgress?.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#869486]">
                  {challenge.totalParticipants} participants
                </span>
                <button
                  onClick={handleLogRide}
                  disabled={isLoggingRide}
                  className="px-4 py-2 rounded-full bg-[#191c1b] border border-white/10 hover:bg-[#282b29] text-xs font-bold text-white flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span>Log Activity</span>
                </button>
              </div>
            </section>
          ) : (
            <div className="p-8 text-center text-xs text-[#5e6e66] border border-dashed border-white/10 rounded-2xl">
              No active community challenges joined at the moment.
            </div>
          )}

          {rivalries.length > 0 && (
            <section className="glass-card p-5 rounded-[28px] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-[#ffb4ab]" />
                  <h4 className="font-display font-bold text-xs text-white">Active Duel</h4>
                </div>
                <span className="text-[10px] text-[#869486]">{rivalries[0].endsAt}</span>
              </div>

              <div className="flex items-center justify-between bg-[#141a18] p-4 rounded-2xl border border-white/5 my-2">
                <div className="text-left">
                  <span className="text-[11px] text-[#4ade80] font-bold block">You</span>
                  <span className="font-display text-2xl font-black text-white tabular-nums">
                    {rivalries[0].userScore.toLocaleString()}
                  </span>
                </div>

                <div className="px-3 py-1 rounded-full bg-white text-black font-extrabold text-[11px] shadow-sm">
                  VS
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[#869486] font-semibold block">{rivalries[0].opponentName}</span>
                  <span className="font-display text-2xl font-black text-[#bccabb] tabular-nums">
                    {rivalries[0].opponentScore.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <button
                  id="highFiveBtn"
                  onClick={handleHighFive}
                  className={`px-4 py-2 rounded-full border text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${
                    hasCheered
                      ? 'bg-[#4ade80] text-[#0c0f0e] border-[#4ade80] shadow-glow-primary'
                      : 'bg-[#191c1b] text-white border-white/10 hover:border-[#4ade80]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span id="cheerLabel">{hasCheered ? 'Cheered!' : 'High-Five'}</span>
                  <span id="cheerCount" className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] tabular-nums">
                    {cheerCount}
                  </span>
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'leaderboards' && (
        <div className="space-y-2 my-4">
          {leaderboards.length > 0 ? (
            leaderboards.map((user: any) => (
              <div key={user.rank} className="p-3.5 rounded-2xl bg-[#141a18] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-center text-xs font-black ${user.rank === 1 ? 'text-[#4ade80]' : 'text-[#869486]'}`}>
                    #{user.rank}
                  </span>
                  <span className="text-xs font-bold text-white">{user.name}</span>
                </div>
                <span className="text-xs font-bold text-[#4ade80] tabular-nums">{user.score}</span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-[#5e6e66] border border-dashed border-white/10 rounded-2xl">
              No leaderboards active right now.
            </div>
          )}
        </div>
      )}

      {tab === 'clubs' && (
        <div className="p-8 text-center text-xs text-[#5e6e66] border border-dashed border-white/10 rounded-2xl my-4">
          <p className="font-bold text-white text-sm mb-1">Clubs & Squads</p>
          <p>Connect with runners and athletes in your area.</p>
        </div>
      )}
    </div>
  );
};
