import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Share2, 
  Scale, 
  Flame, 
  Moon, 
  Heart, 
  Wind, 
  Utensils, 
  Check, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { apiRequest } from '../../services/api';
import { hapticFeedback } from '../../services/haptics';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      apiRequest('/reports/weekly')
        .then(res => setData(res))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportShare = async () => {
    try {
      setIsExporting(true);
      hapticFeedback.light();

      // Build clean text/markdown summary for immediate sharing
      const period = data?.reportPeriod ? `${data.reportPeriod.startDate} to ${data.reportPeriod.endDate}` : 'Last 7 Days';
      const weightSummary = data?.weight?.startKg && data?.weight?.endKg 
        ? `${data.weight.startKg}kg → ${data.weight.endKg}kg (${data.weight.changeKg > 0 ? '+' : ''}${data.weight.changeKg}kg)` 
        : 'No weight logged';
      const workoutSummary = `${data?.activity?.totalWorkouts || 0} sessions, ${(data?.activity?.totalDistanceKm || 0)}km, ${(data?.activity?.totalDurationMinutes || 0)} mins`;
      const sleepSummary = data?.sleep?.averageSleepHours ? `${data.sleep.averageSleepHours}h/night (Avg Score: ${data.sleep.averageScore || 'N/A'})` : 'No sleep logged';
      const nutritionSummary = data?.nutrition?.averageDailyCalories ? `${data.nutrition.averageDailyCalories} kcal/day (${data.nutrition.averageDailyProteinG || 0}g protein)` : 'No meals logged';
      const mindfulnessSummary = `${data?.mindfulness?.breathingSessionsCount || 0} sessions (${data?.mindfulness?.totalMinutes || 0} mins)`;

      const textReport = `📋 NOCTURNE WEEKLY HEALTH & CLINICAL SUMMARY
Period: ${period}
User: ${data?.user?.displayName || 'Athlete'} (${data?.user?.membershipTier || 'Free'} Tier)

⚖️ Body Composition:
- Weight Trend: ${weightSummary}
- Target Goal: ${data?.weight?.targetKg ? `${data.weight.targetKg} kg` : 'Not set'}

🏃‍♂️ Physical Activity & Training:
- Workouts: ${workoutSummary}
- Active Burn: ${data?.activity?.totalActiveCalories || 0} kcal

😴 Sleep Architecture:
- Avg Sleep: ${sleepSummary}

🥗 Nutrition & Caloric Intake:
- Daily Averages: ${nutritionSummary}

🧘‍♂️ Mindfulness & Vagal Reset:
- Box Breathing: ${mindfulnessSummary}

🫀 Cardio Fitness:
- VO2 Max: ${data?.cardio?.vo2Max || 'Not calibrated'} (${data?.cardio?.vo2MaxTier || 'Standard'})

Generated with zero-fake-data precision by Nocturne Health & Fitness.`;

      // Try native share sheet
      try {
        const fileName = `nocturne_weekly_report_${Date.now()}.txt`;
        const file = await Filesystem.writeFile({
          path: fileName,
          data: textReport,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Nocturne Weekly Health Report',
          text: textReport,
          url: file.uri,
          dialogTitle: 'Share Weekly Report with Doctor or Trainer'
        });
      } catch {
        // Fallback: browser download
        const blob = new Blob([textReport], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nocturne_weekly_report_${Date.now()}.txt`;
        a.click();
      }

      hapticFeedback.success();
    } catch (e: any) {
      alert(e.message || 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div 
        ref={reportRef}
        className="w-full max-w-lg glass-modal rounded-[32px] p-6 max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl flex flex-col gap-4 text-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#4ade80]/15 flex items-center justify-center text-[#4ade80]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-white">Trainer & Doctor Weekly Report</h3>
              <p className="text-[10px] text-[#869486]">
                {data?.reportPeriod ? `${data.reportPeriod.startDate} to ${data.reportPeriod.endDate}` : '7-Day Comprehensive Health Audit'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              hapticFeedback.light();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#bccabb]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            <div className="h-16 rounded-2xl skeleton-shimmer" />
            <div className="h-24 rounded-2xl skeleton-shimmer" />
            <div className="h-24 rounded-2xl skeleton-shimmer" />
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Weight Section */}
            <div className="p-3.5 rounded-2xl bg-[#141A18] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span>Body Composition & Weight</span>
                </span>
                <span className="text-[10px] text-[#869486]">
                  {data?.weight?.targetKg ? `Goal: ${data.weight.targetKg} kg` : 'No goal set'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {data?.weight?.startKg && data?.weight?.endKg ? (
                  <>
                    <span className="font-display font-black text-xl text-white tabular-nums">
                      {data.weight.startKg} → {data.weight.endKg} kg
                    </span>
                    <span className={`text-xs font-bold ${data.weight.changeKg <= 0 ? 'text-[#4ade80]' : 'text-amber-400'}`}>
                      ({data.weight.changeKg > 0 ? '+' : ''}{data.weight.changeKg} kg)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">No weight logs recorded this week</span>
                )}
              </div>
            </div>

            {/* Workouts Section */}
            <div className="p-3.5 rounded-2xl bg-[#141A18] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Workouts & Physical Activity</span>
                </span>
                <span className="text-[10px] text-[#4ade80] font-semibold">
                  {data?.activity?.totalWorkouts || 0} Sessions
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-black/30">
                  <span className="text-[9px] text-[#869486] block">Distance</span>
                  <span className="font-display font-black text-sm text-white tabular-nums">{data?.activity?.totalDistanceKm || 0} km</span>
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  <span className="text-[9px] text-[#869486] block">Duration</span>
                  <span className="font-display font-black text-sm text-white tabular-nums">{data?.activity?.totalDurationMinutes || 0} min</span>
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  <span className="text-[9px] text-[#869486] block">Calories</span>
                  <span className="font-display font-black text-sm text-white tabular-nums">{data?.activity?.totalActiveCalories || 0} kcal</span>
                </div>
              </div>
            </div>

            {/* Sleep Section */}
            <div className="p-3.5 rounded-2xl bg-[#141A18] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-[#86efac]" />
                  <span>Sleep & Recovery Architecture</span>
                </span>
                <span className="text-[10px] text-[#869486]">
                  {data?.sleep?.targetHours ? `Target: ${data.sleep.targetHours}h` : 'WHO standard: 7-9h'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {data?.sleep?.averageSleepHours ? (
                  <>
                    <span className="font-display font-black text-xl text-white tabular-nums">
                      {data.sleep.averageSleepHours} hrs / night
                    </span>
                    {data.sleep.averageScore && (
                      <span className="text-xs font-bold text-[#4ade80]">
                        (Avg Score: {data.sleep.averageScore})
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">No sleep recorded this week</span>
                )}
              </div>
            </div>

            {/* Nutrition Section */}
            <div className="p-3.5 rounded-2xl bg-[#141A18] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Nutrition & Daily Caloric Intake</span>
                </span>
                <span className="text-[10px] text-[#869486]">
                  {data?.nutrition?.totalMealsLogged || 0} Meals Logged
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {data?.nutrition?.averageDailyCalories ? (
                  <span className="font-display font-black text-xl text-white tabular-nums">
                    {data.nutrition.averageDailyCalories} kcal / day ({data.nutrition.averageDailyProteinG || 0}g protein)
                  </span>
                ) : (
                  <span className="text-xs text-[#5e6e66] italic">No meals logged this week</span>
                )}
              </div>
            </div>

            {/* Mindfulness & Breathing Section */}
            <div className="p-3.5 rounded-2xl bg-[#141A18] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[#6bfb9a]" />
                  <span>Mindfulness & Box Breathing</span>
                </span>
                <span className="text-[10px] text-[#4ade80] font-semibold">
                  {data?.mindfulness?.breathingSessionsCount || 0} Sessions
                </span>
              </div>
              <span className="text-xs font-bold text-white block pt-0.5">
                {data?.mindfulness?.totalMinutes || 0} Minutes of Vagus Reset
              </span>
            </div>

            {/* Export & Share Button */}
            <div className="pt-2">
              <button
                onClick={handleExportShare}
                disabled={isExporting}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-black text-xs shadow-glow-primary active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>{isExporting ? 'Generating Report...' : 'Export & Share Report'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
