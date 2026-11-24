import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MoreVertical, 
  Plus, 
  Trash2, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Check
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { PermissionsService } from '../services/permissions';
import { useModalStore } from '../store/modalStore';
import { FileText } from 'lucide-react';

export const WeightAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const { openWeeklyReport } = useModalStore();

  const [timeframe, setTimeframe] = useState('month');
  const [data, setData] = useState<any>(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const res = await apiRequest(`/analytics/weight?timeframe=${timeframe}`);
      setData(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const toggleSelectLog = (id: string) => {
    PermissionsService.hapticTap();
    setSelectedLogs(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedLogs.length === 0) return;
    try {
      await apiRequest('/analytics/weight/logs', {
        method: 'DELETE',
        body: JSON.stringify({ logIds: selectedLogs })
      });
      PermissionsService.hapticSuccess();
      setSelectedLogs([]);
      setIsManageMode(false);
      fetchAnalytics();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleExportCsv = async () => {
    setIsMenuOpen(false);
    try {
      // Fetch CSV string from endpoint
      const token = localStorage.getItem('nocturne_access_token');
      const response = await fetch('http://localhost:4000/api/v1/analytics/weight/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const csvText = await response.text();
      await PermissionsService.shareCsv('nocturne_weight_logs.csv', csvText);
    } catch (err) {
      console.error(err);
      window.open('http://localhost:4000/api/v1/analytics/weight/export', '_blank');
    }
  };

  const history = data?.history || [];
  const avgWeight = data?.averageWeightKg;
  const bmi = data?.bmi;
  const deltaKg = data?.deltaKg;
  const goalWeight = data?.goalWeightKg;

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-14 max-w-lg mx-auto relative">
      {/* Top Header */}
      <header className="flex items-center justify-between py-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-base font-bold text-white">Weight Analytics</h1>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => navigate('/record-weight')}
            className="w-9 h-9 rounded-full bg-[#4ade80] text-[#0c0f0e] flex items-center justify-center shadow-glow-primary"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-9 h-9 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-11 w-48 glass-modal rounded-2xl p-1.5 border border-white/10 shadow-2xl z-30">
              <button
                onClick={() => { setIsManageMode(!isManageMode); setIsMenuOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#ffb4ab]" />
                <span>{isManageMode ? 'Exit Manage' : 'Manage Data'}</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-[#4ade80]" />
                <span>Share / Export CSV</span>
              </button>
              <button
                onClick={() => { setIsMenuOpen(false); openWeeklyReport(); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2 border-t border-white/5"
              >
                <FileText className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Doctor / Weekly Report</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Timeframe Filter Tabs */}
      <div className="flex rounded-full bg-[#141a18] p-1 border border-white/5 my-3">
        {['Day', 'Week', 'Month', 'Year'].map(t => {
          const isSel = timeframe === t.toLowerCase();
          return (
            <button
              key={t}
              onClick={() => {
                PermissionsService.hapticTap();
                setTimeframe(t.toLowerCase());
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${
                isSel ? 'bg-white text-[#0c0f0e] shadow-md' : 'text-[#869486] hover:text-white'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-[#869486] px-1 mb-2 font-medium">
        <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-white" />
        <span>{data?.dateRangeFormatted || '--'}</span>
        <ChevronRight className="w-4 h-4 cursor-pointer hover:text-white" />
      </div>

      {/* Hero Average Weight Card */}
      <section className="glass-card p-5 rounded-[28px] my-3 border border-white/10">
        <span className="text-[11px] text-[#869486] font-medium block">Average Weight</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-display text-4xl font-black text-white tabular-nums">
            {avgWeight !== null && avgWeight !== undefined ? avgWeight : '--'}
          </span>
          <span className="text-sm font-bold text-[#bccabb]">kg</span>
          {bmi && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#4ade80]/15 text-[#4ade80] font-bold ml-auto">
              BMI {bmi} {data?.bmiCategory || ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-[#4ade80] font-semibold">
          {deltaKg !== null && deltaKg !== undefined ? (
            <span>{deltaKg > 0 ? `+${deltaKg}` : deltaKg} kg in this timeframe</span>
          ) : (
            <span className="text-[#869486]">Log at least 2 entries to see change</span>
          )}
          {goalWeight && <span className="text-[#869486] ml-auto">Goal: {goalWeight} kg</span>}
        </div>
      </section>

      {/* Trend Graph */}
      <section className="glass-card p-5 rounded-[28px] my-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display font-bold text-xs text-white">Trend Analysis</span>
          <span className="text-[11px] text-[#4ade80] font-bold">
            {goalWeight ? `Target: ${goalWeight} kg` : 'No goal set'}
          </span>
        </div>

        {history.length > 0 ? (
          <div className="h-36 w-full relative flex items-end">
            <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                points={history.map((h: any, idx: number) => {
                  const x = (idx / Math.max(1, history.length - 1)) * 300;
                  const y = Math.max(10, Math.min(110, 120 - (h.weightKg - 50) * 2));
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        ) : (
          <div className="h-36 flex flex-col items-center justify-center text-center text-xs text-[#5e6e66] border border-dashed border-white/10 rounded-2xl">
            <p>No historical weight entries found</p>
            <button
              onClick={() => navigate('/record-weight')}
              className="mt-2 text-[#4ade80] font-bold underline"
            >
              Log your weight
            </button>
          </div>
        )}
      </section>

      {/* Manage Mode Checklist */}
      {isManageMode && history.length > 0 && (
        <section className="space-y-2 my-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-white">Select Logs to Delete</span>
            <span className="text-xs text-[#4ade80] font-bold">{selectedLogs.length} selected</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {history.map((log: any) => {
              const isSel = selectedLogs.includes(log.id);
              return (
                <div
                  key={log.id}
                  onClick={() => toggleSelectLog(log.id)}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer border transition-all ${
                    isSel ? 'bg-[#ffb4ab]/10 border-[#ffb4ab]' : 'bg-[#141a18] border-white/5'
                  }`}
                >
                  <span className="text-xs font-medium text-white">{log.date}</span>
                  <span className="text-xs font-bold text-white tabular-nums">{log.weightKg} kg</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSel ? 'bg-[#ffb4ab] border-[#ffb4ab] text-black' : 'border-white/20'}`}>
                    {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedLogs.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="w-full py-3 rounded-full bg-[#93000a] text-white font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete {selectedLogs.length} Selected Logs</span>
            </button>
          )}
        </section>
      )}
    </div>
  );
};
