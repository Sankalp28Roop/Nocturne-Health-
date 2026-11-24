import React, { useState } from 'react';
import { 
  X, 
  Camera, 
  Mic, 
  Sparkles, 
  Check, 
  Flame, 
  Utensils, 
  Plus, 
  AlertCircle,
  Upload,
  RefreshCw
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { apiRequest } from '../../services/api';
import { offlineSyncEngine } from '../../services/offlineSync';
import { hapticFeedback } from '../../services/haptics';
import { VoiceEngine } from '../../services/voice';

interface MealScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealSaved?: () => void;
}

export const MealScannerModal: React.FC<MealScannerModalProps> = ({
  isOpen,
  onClose,
  onMealSaved
}) => {
  const [inputText, setInputText] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    items: Array<{ name: string; quantity: string; calories: number }>;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    totalCalories: number;
    proteinG: number;
    carbsG: number;
    fatsG: number;
    summary: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleTakePhoto = async () => {
    try {
      hapticFeedback.light();
      const photo = await CapCamera.getPhoto({
        quality: 75,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt
      });

      if (photo.base64String) {
        setPhotoBase64(`data:image/jpeg;base64,${photo.base64String}`);
        analyzeFood({ imageBase64: photo.base64String });
      }
    } catch {
      // User cancelled or camera denied
    }
  };

  const handleVoiceInput = async () => {
    try {
      hapticFeedback.light();
      setIsListening(true);
      setErrorMsg(null);

      const voice = new VoiceEngine({
        onListeningStart: () => setIsListening(true),
        onTranscript: (text) => {
          setInputText(text);
        },
        onListeningEnd: () => {
          setIsListening(false);
        },
        onError: (err) => {
          setIsListening(false);
          setErrorMsg(err);
        }
      });

      await voice.startListening();
    } catch (e: any) {
      setIsListening(false);
      setErrorMsg(e.message || 'Microphone error');
    }
  };

  const analyzeFood = async (params: { text?: string; imageBase64?: string }) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest('/nutrition/analyze', {
        method: 'POST',
        body: JSON.stringify({
          text: params.text || inputText,
          imageBase64: params.imageBase64,
          mimeType: 'image/jpeg'
        })
      });

      if (res?.analysis) {
        setAnalysisResult(res.analysis);
        hapticFeedback.success();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Analysis failed. Please check network or GEMINI_API_KEY.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!analysisResult) return;
    try {
      setIsSaving(true);
      hapticFeedback.medium();

      const mealPayload = {
        description: analysisResult.items.map(i => `${i.quantity} ${i.name}`).join(', ') || inputText || 'Logged meal',
        mealType: analysisResult.mealType,
        caloriesKcal: Math.round(analysisResult.totalCalories),
        proteinG: Number(analysisResult.proteinG),
        carbsG: Number(analysisResult.carbsG),
        fatsG: Number(analysisResult.fatsG),
        loggedAt: new Date().toISOString()
      };

      // Offline-safe mutation
      await offlineSyncEngine.mutate('MEAL_LOG', '/nutrition/log', mealPayload);

      hapticFeedback.success();
      onMealSaved?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save meal');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg glass-modal rounded-t-[36px] sm:rounded-[36px] p-6 pb-10 flex flex-col gap-4 border border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-[#4ade80]/15 flex items-center justify-center text-[#4ade80]">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-white">Friday Food & Calorie Scanner</h3>
              <p className="text-[11px] text-[#869486]">AI Multimodal Nutrition Analysis</p>
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

        {/* Action Buttons: Snap Photo / Voice Input */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={handleTakePhoto}
            className="p-3.5 rounded-2xl bg-[#141A18] border border-white/10 flex flex-col items-center gap-2 hover:border-[#4ade80]/40 active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#6bfb9a] group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Snap / Upload Photo</span>
              <span className="text-[10px] text-[#869486]">Instant Visual Scanner</span>
            </div>
          </button>

          <button
            onClick={handleVoiceInput}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 active:scale-95 transition-all text-center group ${
              isListening 
                ? 'bg-[#4ade80]/20 border-[#4ade80] text-[#4ade80] animate-pulse'
                : 'bg-[#141A18] border-white/10 hover:border-[#4ade80]/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#4ade80] group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {isListening ? 'Listening...' : 'Say Meal Name'}
              </span>
              <span className="text-[10px] text-[#869486]">e.g. "2 rotis and dal"</span>
            </div>
          </button>
        </div>

        {/* Photo Preview if Taken */}
        {photoBase64 && (
          <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
            <img src={photoBase64} alt="Meal preview" className="w-full h-full object-cover" />
            <button 
              onClick={() => setPhotoBase64(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Text Input & Analyze Button */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Or type what you ate (e.g. 1 bowl oats with banana & almonds)"
              className="w-full py-3 px-4 rounded-2xl bg-[#141A18] border border-white/10 text-xs text-white placeholder-[#5e6e66] focus:outline-none focus:border-[#4ade80]/50 pr-20"
            />
            {inputText && (
              <button
                onClick={() => analyzeFood({ text: inputText })}
                disabled={isAnalyzing}
                className="absolute right-2 top-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] text-[11px] font-bold shadow flex items-center gap-1 active:scale-95 transition-all"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isAnalyzing ? '...' : 'Scan'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 flex items-center gap-2 text-[#ffb4ab] text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Analysis Loading Shimmer */}
        {isAnalyzing && (
          <div className="p-4 rounded-2xl bg-[#141A18] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs text-[#86efac] font-bold">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Friday is analyzing your meal with Gemini 2.5...</span>
            </div>
            <div className="h-6 w-3/4 rounded skeleton-shimmer" />
            <div className="grid grid-cols-4 gap-2 pt-1">
              <div className="h-10 rounded skeleton-shimmer" />
              <div className="h-10 rounded skeleton-shimmer" />
              <div className="h-10 rounded skeleton-shimmer" />
              <div className="h-10 rounded skeleton-shimmer" />
            </div>
          </div>
        )}

        {/* Editable Analysis Results Card */}
        {analysisResult && !isAnalyzing && (
          <div className="p-4 rounded-2xl bg-[#141A18] border border-[#4ade80]/30 shadow-glow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#4ade80] tracking-wider">
                Nutritional Breakdown
              </span>
              <select
                value={analysisResult.mealType}
                onChange={(e) => setAnalysisResult({ ...analysisResult, mealType: e.target.value as any })}
                className="bg-[#191c1b] border border-white/10 rounded-lg text-[10px] text-white px-2 py-1 font-semibold focus:outline-none"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>

            {/* Total Calories & Macro Pills */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-[#ffb4ab] font-bold block">Calories</span>
                <input
                  type="number"
                  value={analysisResult.totalCalories}
                  onChange={(e) => setAnalysisResult({ ...analysisResult, totalCalories: Number(e.target.value) })}
                  className="w-full text-center font-display font-black text-sm text-white bg-transparent focus:outline-none"
                />
                <span className="text-[9px] text-[#869486]">kcal</span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-[#6bfb9a] font-bold block">Protein</span>
                <input
                  type="number"
                  value={analysisResult.proteinG}
                  onChange={(e) => setAnalysisResult({ ...analysisResult, proteinG: Number(e.target.value) })}
                  className="w-full text-center font-display font-black text-sm text-white bg-transparent focus:outline-none"
                />
                <span className="text-[9px] text-[#869486]">g</span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-[#86efac] font-bold block">Carbs</span>
                <input
                  type="number"
                  value={analysisResult.carbsG}
                  onChange={(e) => setAnalysisResult({ ...analysisResult, carbsG: Number(e.target.value) })}
                  className="w-full text-center font-display font-black text-sm text-white bg-transparent focus:outline-none"
                />
                <span className="text-[9px] text-[#869486]">g</span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-amber-300 font-bold block">Fats</span>
                <input
                  type="number"
                  value={analysisResult.fatsG}
                  onChange={(e) => setAnalysisResult({ ...analysisResult, fatsG: Number(e.target.value) })}
                  className="w-full text-center font-display font-black text-sm text-white bg-transparent focus:outline-none"
                />
                <span className="text-[9px] text-[#869486]">g</span>
              </div>
            </div>

            {/* Detected Items Pill List */}
            {analysisResult.items && analysisResult.items.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-[#869486] font-semibold">Detected Items:</span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.items.map((item, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-[#bccabb]">
                      {item.quantity} {item.name} ({item.calories} kcal)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary note */}
            {analysisResult.summary && (
              <p className="text-[11px] text-[#869486] italic leading-relaxed pt-1">
                "{analysisResult.summary}"
              </p>
            )}

            {/* Save to Today Button */}
            <button
              onClick={handleSaveMeal}
              disabled={isSaving}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-black text-xs shadow-glow-primary active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSaving ? 'Saving...' : 'Save to Today'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
