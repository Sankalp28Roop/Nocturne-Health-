import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  ChevronLeft, 
  Share2, 
  Shield, 
  MapPin, 
  Flame, 
  Timer, 
  Navigation, 
  Sliders, 
  Check, 
  Download,
  Sparkles
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { apiRequest } from '../services/api';
import { hapticFeedback } from '../services/haptics';

interface TelemetryPoint {
  lat: number;
  lng: number;
  distMeters: number;
}

export const WorkoutSummaryScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Can receive workout data via route state or fetch by id
  const workoutState = (location.state as any)?.workout;
  const sessionId = params.sessionId || workoutState?.sessionId || workoutState?.id;

  const [workout, setWorkout] = useState<any>(workoutState || null);
  const [trimStartMeters, setTrimStartMeters] = useState<number>(150);
  const [trimEndMeters, setTrimEndMeters] = useState<number>(150);
  const [customStartLabel, setCustomStartLabel] = useState<string>('Start Point');
  const [customEndLabel, setCustomEndLabel] = useState<string>('Finish Point');
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Parse telemetry coordinates
  const telemetryPoints: TelemetryPoint[] = React.useMemo(() => {
    if (!workout?.telemetryPointsJson) {
      // Default fallback sample route points if empty
      return [
        { lat: 12.9716, lng: 77.5946, distMeters: 0 },
        { lat: 12.9725, lng: 77.5955, distMeters: 250 },
        { lat: 12.9740, lng: 77.5970, distMeters: 600 },
        { lat: 12.9765, lng: 77.5995, distMeters: 1200 },
        { lat: 12.9780, lng: 77.6010, distMeters: 1800 },
        { lat: 12.9800, lng: 77.6030, distMeters: 2400 }
      ];
    }
    try {
      return JSON.parse(workout.telemetryPointsJson);
    } catch {
      return [];
    }
  }, [workout]);

  // Privacy-trimmed coordinates
  const trimmedCoordinates = React.useMemo(() => {
    if (telemetryPoints.length === 0) return [];
    const totalDist = telemetryPoints[telemetryPoints.length - 1].distMeters || 2400;
    const startThreshold = trimStartMeters;
    const endThreshold = Math.max(0, totalDist - trimEndMeters);

    const filtered = telemetryPoints.filter(p => p.distMeters >= startThreshold && p.distMeters <= endThreshold);
    return filtered.length > 1 ? filtered : telemetryPoints;
  }, [telemetryPoints, trimStartMeters, trimEndMeters]);

  // Draw Dark Polyline Route on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Dark canvas background
    ctx.fillStyle = '#111413';
    ctx.fillRect(0, 0, width, height);

    // Grid lines for terrain feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (trimmedCoordinates.length < 2) return;

    // Compute bounding box to normalize coordinates into canvas space
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    trimmedCoordinates.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    const padding = 50;
    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;

    const toX = (lng: number) => padding + ((lng - minLng) / lngSpan) * (width - padding * 2);
    const toY = (lat: number) => height - (padding + ((lat - minLat) / latSpan) * (height - padding * 2));

    // Outer glow path
    ctx.strokeStyle = 'rgba(107, 251, 154, 0.25)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    trimmedCoordinates.forEach((p, idx) => {
      const x = toX(p.lng);
      const y = toY(p.lat);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Vibrant neon core line
    ctx.strokeStyle = '#6bfb9a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    trimmedCoordinates.forEach((p, idx) => {
      const x = toX(p.lng);
      const y = toY(p.lat);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Start point pin (White circle)
    const startX = toX(trimmedCoordinates[0].lng);
    const startY = toY(trimmedCoordinates[0].lat);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(startX, startY, 6, 0, Math.PI * 2);
    ctx.fill();

    // End point pin (Emerald Green ring)
    const endX = toX(trimmedCoordinates[trimmedCoordinates.length - 1].lng);
    const endY = toY(trimmedCoordinates[trimmedCoordinates.length - 1].lat);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(endX, endY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c0f0e';
    ctx.beginPath();
    ctx.arc(endX, endY, 3, 0, Math.PI * 2);
    ctx.fill();

  }, [trimmedCoordinates]);

  // Save Privacy Settings
  const handleSavePrivacy = async () => {
    if (!sessionId) return;
    try {
      setIsSavingPrivacy(true);
      hapticFeedback.medium();

      await apiRequest(`/workouts/session/${sessionId}/privacy`, {
        method: 'PATCH',
        body: JSON.stringify({
          trimStartMeters,
          trimEndMeters,
          customStartLabel,
          customEndLabel
        })
      });

      setIsSavedFeedback(true);
      hapticFeedback.success();
      setTimeout(() => setIsSavedFeedback(false), 2000);
    } catch (e: any) {
      alert(e.message || 'Failed to save privacy settings');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  // Generate & Share 1080x1350 High-Contrast Social Card
  const handleShareCard = async () => {
    try {
      setIsGeneratingCard(true);
      hapticFeedback.light();

      // Create an offscreen high-res 1080x1350 canvas
      const shareCanvas = document.createElement('canvas');
      shareCanvas.width = 1080;
      shareCanvas.height = 1350;
      const sCtx = shareCanvas.getContext('2d');
      if (!sCtx) return;

      // Obsidian Kinetic Background
      sCtx.fillStyle = '#0c0f0e';
      sCtx.fillRect(0, 0, 1080, 1350);

      // Gradient glow
      const grad = sCtx.createRadialGradient(540, 450, 50, 540, 450, 600);
      grad.addColorStop(0, 'rgba(74, 222, 128, 0.12)');
      grad.addColorStop(1, 'rgba(12, 15, 14, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 1080, 1350);

      // Top branding
      sCtx.fillStyle = '#869486';
      sCtx.font = 'bold 28px sans-serif';
      sCtx.fillText('NOCTURNE HEALTH & FITNESS', 70, 90);

      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 64px sans-serif';
      sCtx.fillText(customStartLabel || 'Morning Run', 70, 170);

      // Draw Route Map
      const mapCanvas = canvasRef.current;
      if (mapCanvas) {
        sCtx.save();
        sCtx.beginPath();
        sCtx.roundRect(70, 230, 940, 680, 36);
        sCtx.clip();
        sCtx.drawImage(mapCanvas, 70, 230, 940, 680);
        sCtx.restore();
      }

      // 4 Metric Badges
      const distKm = ((workout?.distanceMeters || 2400) / 1000).toFixed(2);
      const pace = workout?.averagePaceSecPerKm ? `${Math.floor(workout.averagePaceSecPerKm / 60)}'${(workout.averagePaceSecPerKm % 60).toString().padStart(2, '0')}"` : "5'24\"";
      const duration = workout?.elapsedSeconds ? `${Math.floor(workout.elapsedSeconds / 60)}m ${workout.elapsedSeconds % 60}s` : "24m 10s";
      const cals = workout?.activeCalories || 215;

      // Metrics Bar
      const startY = 1000;
      sCtx.fillStyle = '#141A18';
      sCtx.beginPath();
      sCtx.roundRect(70, startY, 940, 220, 32);
      sCtx.fill();
      sCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      sCtx.lineWidth = 2;
      sCtx.stroke();

      // Dist
      sCtx.fillStyle = '#869486';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.fillText('DISTANCE', 120, startY + 60);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 52px sans-serif';
      sCtx.fillText(`${distKm} km`, 120, startY + 130);

      // Pace
      sCtx.fillStyle = '#869486';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.fillText('AVG PACE', 360, startY + 60);
      sCtx.fillStyle = '#4ade80';
      sCtx.font = '900 52px sans-serif';
      sCtx.fillText(pace, 360, startY + 130);

      // Duration
      sCtx.fillStyle = '#869486';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.fillText('DURATION', 600, startY + 60);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 52px sans-serif';
      sCtx.fillText(duration, 600, startY + 130);

      // Calories
      sCtx.fillStyle = '#869486';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.fillText('BURNED', 840, startY + 60);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 52px sans-serif';
      sCtx.fillText(`${cals} kcal`, 840, startY + 130);

      // Privacy Badge Footer
      sCtx.fillStyle = '#86efac';
      sCtx.font = 'bold 24px sans-serif';
      sCtx.fillText(`🔒 Location Protected (Trimmed ${trimStartMeters}m start / ${trimEndMeters}m end)`, 70, 1280);

      // Export to data URL
      const dataUrl = shareCanvas.toDataURL('image/png');
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

      // Try native share via Capacitor Filesystem & Share
      try {
        const fileName = `nocturne_workout_${Date.now()}.png`;
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'My Nocturne Workout',
          text: `Crushed a ${distKm} km session in ${duration}! 🏃‍♂️`,
          url: savedFile.uri,
          dialogTitle: 'Share Workout to Stories / WhatsApp'
        });
      } catch {
        // Fallback: browser download
        const link = document.createElement('a');
        link.download = `nocturne_workout_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }

      hapticFeedback.success();
    } catch (e: any) {
      alert(e.message || 'Failed to generate share card');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  const distanceKm = ((workout?.distanceMeters || 2400) / 1000).toFixed(2);
  const activeCalories = workout?.activeCalories || 215;

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-16 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <button
          onClick={() => {
            hapticFeedback.light();
            navigate(-1);
          }}
          className="w-10 h-10 rounded-full bg-[#141A18] border border-white/5 flex items-center justify-center text-[#bccabb] hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#869486]">Workout Summary</span>
          <h1 className="font-display text-base font-black text-white">Route Telemetry & Privacy</h1>
        </div>
        <button
          onClick={handleShareCard}
          disabled={isGeneratingCard}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#191c1b] to-[#4ade80]/40 border border-[#4ade80]/50 flex items-center justify-center text-[#4ade80] shadow-glow-primary active:scale-95 transition-all"
          title="Share Card"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* Dark Route Canvas Map */}
      <div className="relative w-full h-64 rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#111413]">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full h-full object-cover"
        />

        {/* Floating Privacy Pill */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-[#4ade80]/30 flex items-center gap-1.5 text-[10px] font-bold text-[#6bfb9a]">
          <Shield className="w-3 h-3" />
          <span>Home Protected (-{trimStartMeters}m / -{trimEndMeters}m)</span>
        </div>

        {/* Distance Badge */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white tabular-nums">
          {distanceKm} km
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl bg-[#141A18] border border-white/5 text-center">
          <span className="text-[10px] text-[#869486] font-medium flex items-center justify-center gap-1">
            <Navigation className="w-3 h-3 text-[#4ade80]" />
            <span>Distance</span>
          </span>
          <span className="font-display text-lg font-black text-white tabular-nums mt-1 block">
            {distanceKm}
          </span>
          <span className="text-[9px] text-[#5e6e66]">km</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#141A18] border border-white/5 text-center">
          <span className="text-[10px] text-[#869486] font-medium flex items-center justify-center gap-1">
            <Timer className="w-3 h-3 text-[#86efac]" />
            <span>Duration</span>
          </span>
          <span className="font-display text-lg font-black text-white tabular-nums mt-1 block">
            {workout?.elapsedSeconds ? `${Math.floor(workout.elapsedSeconds / 60)}m` : '24m'}
          </span>
          <span className="text-[9px] text-[#5e6e66]">total time</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#141A18] border border-white/5 text-center">
          <span className="text-[10px] text-[#869486] font-medium flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" />
            <span>Calories</span>
          </span>
          <span className="font-display text-lg font-black text-white tabular-nums mt-1 block">
            {activeCalories}
          </span>
          <span className="text-[9px] text-[#5e6e66]">active kcal</span>
        </div>
      </div>

      {/* Start & End Location Privacy Controls (Mandatory Section) */}
      <section className="glass-card rounded-[28px] p-5 space-y-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#4ade80]" />
            <h3 className="font-display font-black text-sm text-white">Route Privacy Editor</h3>
          </div>
          <span className="text-[10px] text-[#869486]">Masks exact home / work GPS</span>
        </div>

        {/* Hide Start Distance Slider */}
        <div className="space-y-1.5 bg-[#141A18] p-3 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#bccabb] font-semibold">Trim Start Distance</span>
            <span className="font-bold text-[#4ade80] tabular-nums">{trimStartMeters} meters</span>
          </div>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={trimStartMeters}
            onChange={(e) => setTrimStartMeters(Number(e.target.value))}
            className="w-full accent-[#4ade80]"
          />
          <div className="flex items-center justify-between text-[9px] text-[#5e6e66]">
            <span>0m (Exact GPS)</span>
            <span>250m</span>
            <span>500m (Max Privacy)</span>
          </div>
        </div>

        {/* Hide End Distance Slider */}
        <div className="space-y-1.5 bg-[#141A18] p-3 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#bccabb] font-semibold">Trim End Distance</span>
            <span className="font-bold text-[#4ade80] tabular-nums">{trimEndMeters} meters</span>
          </div>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={trimEndMeters}
            onChange={(e) => setTrimEndMeters(Number(e.target.value))}
            className="w-full accent-[#4ade80]"
          />
          <div className="flex items-center justify-between text-[9px] text-[#5e6e66]">
            <span>0m (Exact GPS)</span>
            <span>250m</span>
            <span>500m (Max Privacy)</span>
          </div>
        </div>

        {/* Custom Start & End Labels */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] font-semibold text-[#869486] block mb-1">Start Label</label>
            <input
              type="text"
              value={customStartLabel}
              onChange={(e) => setCustomStartLabel(e.target.value)}
              placeholder="e.g. Park Gate"
              className="w-full py-2 px-3 rounded-xl bg-[#141A18] border border-white/10 text-xs text-white placeholder-[#5e6e66] focus:outline-none focus:border-[#4ade80]"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#869486] block mb-1">End Label</label>
            <input
              type="text"
              value={customEndLabel}
              onChange={(e) => setCustomEndLabel(e.target.value)}
              placeholder="e.g. Finish Line"
              className="w-full py-2 px-3 rounded-xl bg-[#141A18] border border-white/10 text-xs text-white placeholder-[#5e6e66] focus:outline-none focus:border-[#4ade80]"
            />
          </div>
        </div>

        {/* Save Privacy Settings Button */}
        <button
          onClick={handleSavePrivacy}
          disabled={isSavingPrivacy}
          className="w-full py-3 rounded-full bg-[#191c1b] border border-white/15 hover:border-[#4ade80] text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
        >
          {isSavedFeedback ? (
            <>
              <Check className="w-4 h-4 text-[#4ade80]" />
              <span className="text-[#4ade80]">Privacy Saved!</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-[#4ade80]" />
              <span>{isSavingPrivacy ? 'Saving...' : 'Save Privacy Settings'}</span>
            </>
          )}
        </button>
      </section>

      {/* Share Card Trigger Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-[#141A18] via-[#1a231e] to-[#141A18] border border-[#4ade80]/30 shadow-glow-subtle flex items-center justify-between">
        <div>
          <h4 className="font-display font-black text-sm text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#4ade80]" />
            <span>Obsidian Social Card</span>
          </h4>
          <p className="text-[10px] text-[#869486] mt-0.5">1080x1350 High-Contrast Shareable for WhatsApp & IG</p>
        </div>
        <button
          onClick={handleShareCard}
          disabled={isGeneratingCard}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] text-xs font-display font-extrabold shadow active:scale-95 transition-all flex items-center gap-1"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{isGeneratingCard ? 'Generating...' : 'Share Card'}</span>
        </button>
      </div>
    </div>
  );
};
