import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Square, 
  Lock, 
  Unlock, 
  Radio, 
  AlertTriangle,
  MapPin,
  Music
} from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { apiRequest } from '../services/api';
import { PermissionsService } from '../services/permissions';
import { useMusicStore } from '../store/musicStore';
import { hapticFeedback } from '../services/haptics';

// Real Haversine distance in meters
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const LiveWorkout: React.FC = () => {
  const navigate = useNavigate();

  const [countdown, setCountdown] = useState<number | null>(3);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Real tracking states
  const [isActive, setIsActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [currentPaceSec, setCurrentPaceSec] = useState<number | null>(null);
  const [activeCalories, setActiveCalories] = useState(0);
  const [gpsReady, setGpsReady] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);

  // Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const lockTimerRef = useRef<any>(null);

  // Permission Blocked Modal State
  const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);

  // Discard Modal
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);

  // Coordinates tracking
  const lastCoordRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const geoWatchIdRef = useRef<any>(null);

  useEffect(() => {
    // Start session on backend
    apiRequest('/workouts/session/start', {
      method: 'POST',
      body: JSON.stringify({ activityType: 'running' })
    })
      .then(res => setSessionId(res.sessionId))
      .catch(console.error);

    // 3-2-1 Countdown Timer
    const cdInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(cdInterval);
          setIsActive(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(cdInterval);
  }, []);

  // Real GPS tracking via Capacitor Geolocation / Browser Geolocation
  useEffect(() => {
    let watchId: any = null;

    const startGps = async () => {
      try {
        // Request Location and Notification permissions just-in-time
        const locGranted = await PermissionsService.requestLocationPermission();
        if (!locGranted) {
          setIsPermissionBlocked(true);
          setGpsReady(false);
          return;
        }

        await PermissionsService.requestNotificationPermission();

        // Test permissions
        const hasCap = typeof (Geolocation as any)?.watchPosition === 'function';
        if (hasCap) {
          watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
            if (err || !position?.coords) return;
            setGpsReady(true);
            handleNewPosition(position.coords.latitude, position.coords.longitude, position.coords.speed);
          });
          geoWatchIdRef.current = watchId;
        } else if (navigator.geolocation) {
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              setGpsReady(true);
              handleNewPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.speed);
            },
            () => setGpsReady(false),
            { enableHighAccuracy: true }
          );
          geoWatchIdRef.current = watchId;
        }
      } catch {
        setGpsReady(false);
      }
    };

    startGps();

    return () => {
      if (geoWatchIdRef.current) {
        try {
          if (typeof geoWatchIdRef.current === 'string') {
            Geolocation.clearWatch({ id: geoWatchIdRef.current }).catch(() => {});
          } else {
            navigator.geolocation.clearWatch(geoWatchIdRef.current);
          }
        } catch {}
      }
    };
  }, []);

  const handleNewPosition = (lat: number, lng: number, speed: number | null) => {
    const now = Date.now();
    if (lastCoordRef.current && isActive) {
      const dist = haversineDistanceMeters(lastCoordRef.current.lat, lastCoordRef.current.lng, lat, lng);
      // Filter jitter (<1 meter)
      if (dist >= 1.5) {
        setDistanceMeters(prev => prev + dist);
        // Compute active calories based on real distance (~60 kcal per km)
        setActiveCalories(Math.round(((distanceMeters + dist) / 1000) * 60));

        // Speed to pace
        if (speed && speed > 0.5) {
          const secPerKm = Math.round(1000 / speed);
          setCurrentPaceSec(secPerKm);
        } else {
          const timeDiffSec = (now - lastCoordRef.current.time) / 1000;
          if (timeDiffSec > 0) {
            const calculatedSpeed = dist / timeDiffSec;
            if (calculatedSpeed > 0.5) {
              setCurrentPaceSec(Math.round(1000 / calculatedSpeed));
            }
          }
        }
      }
    }
    lastCoordRef.current = { lat, lng, time: now };
    if (!locationName) setLocationName('GPS Tracking');
  };

  // Real Timer
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatStopwatch = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (sec: number | null) => {
    if (!sec || isNaN(sec) || sec <= 0 || sec > 3600) return '--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}'${s.toString().padStart(2, '0')}"`;
  };

  const handleHoldStart = () => {
    if (!isLocked) {
      setIsLocked(true);
      return;
    }
    let prog = 0;
    lockTimerRef.current = setInterval(() => {
      prog += 10;
      setLockProgress(prog);
      if (prog >= 100) {
        clearInterval(lockTimerRef.current);
        setIsLocked(false);
        setLockProgress(0);
      }
    }, 100);
  };

  const handleHoldEnd = () => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
      setLockProgress(0);
    }
  };

  const handleFinish = async (action: 'save' | 'discard') => {
    let summaryData: any = null;
    if (sessionId) {
      try {
        const res = await apiRequest(`/workouts/session/${sessionId}/finish`, {
          method: 'POST',
          body: JSON.stringify({ action })
        });
        summaryData = res;
      } catch (e) {
        console.error(e);
      }
    }

    if (action === 'save') {
      // Navigate to WorkoutSummaryScreen with route & telemetry
      navigate(`/workout-summary/${sessionId || 'current'}`, {
        state: {
          workout: {
            sessionId,
            distanceMeters,
            elapsedSeconds,
            activeCalories,
            averagePaceSecPerKm: currentPaceSec || 320
          }
        }
      });
    } else {
      navigate('/workouts');
    }
  };

  // Compute dynamic ambient zone based on pace/activity
  // > 5:00/km or distance pace -> Zone 1-2 (fatburn), < 4:30/km -> Zone 3 (aerobic), < 3:45/km -> Zone 4-5 (peak)
  const getAmbientZoneClass = () => {
    if (!isActive) return '';
    if (!currentPaceSec || currentPaceSec > 330) {
      return 'zone-ambient-fatburn';
    } else if (currentPaceSec > 260) {
      return 'zone-ambient-aerobic';
    } else {
      return 'zone-ambient-peak';
    }
  };

  return (
    <div className={`min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top pb-10 flex flex-col justify-between max-w-lg mx-auto relative overflow-hidden transition-all duration-700 ${getAmbientZoneClass()}`}>
      {/* 3-2-1 Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" className="stroke-[#191c1b]" strokeWidth="8" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="url(#cdGradient)"
                strokeWidth="8"
                strokeDasharray="264"
                strokeDashoffset={264 * (1 - (countdown / 3))}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-linear"
              />
              <defs>
                <linearGradient id="cdGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute font-display text-7xl font-black text-white animate-pulse">
              {countdown}
            </span>
          </div>
          <span className="font-display text-sm font-bold tracking-widest uppercase text-[#4ade80] mt-6">
            Starting Live Session
          </span>
        </div>
      )}

      {/* Top HUD */}
      <div>
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Live Session</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => useMusicStore.getState().toggleDrawer()}
              className="w-8 h-8 rounded-full bg-[#141a18] border border-[#4ade80]/40 flex items-center justify-center text-[#4ade80] hover:scale-105 active:scale-95 transition-all shadow-glow-primary"
              title="Music Player"
            >
              <Music className="w-3.5 h-3.5" />
            </button>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              gpsReady ? 'bg-[#141a18] border border-white/5 text-[#4ade80]' : 'bg-[#191c1b] text-[#869486]'
            }`}>
              <Radio className="w-3 h-3" /> {gpsReady ? 'GPS Connected' : 'Searching GPS'}
            </span>
          </div>
        </header>

        {/* Live Stopwatch Large Display */}
        <div className="text-center my-6">
          <span className="font-display text-6xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_4px_16px_rgba(74,222,128,0.15)]">
            {formatStopwatch(elapsedSeconds)}
          </span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-[#bccabb]">
              {isActive ? 'Tracking telemetry...' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Primary Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3 my-4">
          {/* Distance */}
          <div className="glass-card p-4 rounded-3xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Distance</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-3xl font-black text-white tabular-nums">
                {(distanceMeters / 1000).toFixed(2)}
              </span>
              <span className="text-xs font-bold text-[#4ade80]">km</span>
            </div>
            <span className="text-[10px] text-[#bccabb] mt-1 block">Real sensor tracking</span>
          </div>

          {/* Current Pace */}
          <div className="glass-card p-4 rounded-3xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Current Pace</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-3xl font-black text-white tabular-nums">
                {formatPace(currentPaceSec)}
              </span>
              <span className="text-xs font-bold text-[#bccabb]">/km</span>
            </div>
            <span className="text-[10px] text-[#869486] mt-1 block">
              {currentPaceSec ? 'Live GPS speed' : 'Awaiting motion'}
            </span>
          </div>

          {/* Heart Rate */}
          <div className="glass-card p-4 rounded-3xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Heart Rate</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-display text-3xl font-black text-white tabular-nums">
                --
              </span>
              <span className="text-xs font-bold text-[#869486]">bpm</span>
            </div>
            <span className="text-[10px] text-[#5e6e66] font-semibold mt-1 block">BLE sensor required</span>
          </div>

          {/* Active Calories */}
          <div className="glass-card p-4 rounded-3xl border border-white/5">
            <span className="text-[11px] text-[#869486] font-medium block">Active Burn</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-3xl font-black text-white tabular-nums">
                {activeCalories}
              </span>
              <span className="text-xs font-bold text-[#4ade80]">kcal</span>
            </div>
            <span className="text-[10px] text-[#bccabb] mt-1 block">Calculated from distance</span>
          </div>
        </div>

        {locationName && (
          <div className="bg-[#141a18] p-3 rounded-2xl border border-white/5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#4ade80]" />
            <span className="text-xs font-semibold text-white">{locationName}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4 pt-4">
        {isLocked && (
          <div className="text-center space-y-1">
            <span className="text-[11px] text-[#869486] font-medium block">
              Hold lock button for 3s to unlock controls
            </span>
            <div className="w-32 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
              <div 
                className="h-full bg-[#4ade80] transition-all"
                style={{ width: `${lockProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all ${
              isLocked
                ? 'bg-[#191c1b] border-[#4ade80] text-[#4ade80]'
                : 'bg-[#191c1b] border-white/5 text-[#869486] hover:text-white'
            }`}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>

          <button
            disabled={isLocked}
            onClick={() => {
              hapticFeedback.medium();
              setIsActive(!isActive);
            }}
            className={`flex-1 max-w-xs py-4 rounded-full font-display font-bold text-sm tracking-wide shadow-glow-primary flex items-center justify-center gap-2 active:scale-95 transition-all ${
              isLocked ? 'opacity-40 pointer-events-none' : ''
            } ${
              isActive 
                ? 'bg-[#1d201f] text-white border border-white/10' 
                : 'bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e]'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            disabled={isLocked}
            onClick={() => setIsDiscardModalOpen(true)}
            className={`w-14 h-14 rounded-full bg-[#93000a]/20 border border-[#93000a] text-[#ffb4ab] flex items-center justify-center hover:bg-[#93000a]/40 transition-all ${
              isLocked ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

      {/* #discardModal Bottom Sheet */}
      {isDiscardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg glass-modal rounded-[32px] p-6 pb-8 border border-white/10 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex items-center gap-2 text-[#ffb4ab]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-display font-bold text-base text-white">End Workout Session?</h3>
            </div>
            <p className="text-xs text-[#bccabb]">
              {(distanceMeters / 1000).toFixed(2)} km recorded in {formatStopwatch(elapsedSeconds)}.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleFinish('save')}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-bold text-sm tracking-wide shadow-glow-primary"
              >
                Save Workout
              </button>
              <button
                onClick={() => handleFinish('discard')}
                className="w-full py-3 rounded-full bg-[#191c1b] text-[#ffb4ab] font-bold text-xs hover:bg-[#282b29] transition-all"
              >
                Discard Telemetry
              </button>
              <button
                onClick={() => setIsDiscardModalOpen(false)}
                className="w-full py-2.5 text-xs text-[#869486] font-semibold hover:text-white"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Blocked / Don't Ask Again Modal */}
      {isPermissionBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm glass-card rounded-[32px] p-6 border border-white/10 text-center space-y-4 bg-[#141A18]/95 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 flex items-center justify-center mx-auto text-[#ffb4ab]">
              <MapPin className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg text-white">Location Permission Needed</h3>
              <p className="text-xs text-[#bccabb] leading-relaxed">
                Nocturne requires GPS access to calculate live distance, pace, and route metrics. Please enable location in system settings.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => PermissionsService.openAppSettings()}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#6bfb9a] to-[#4ade80] text-[#0c0f0e] font-display font-bold text-xs shadow-lg shadow-[#4ade80]/20 active:scale-[0.98] transition-all"
              >
                Open Settings
              </button>
              <button
                onClick={() => setIsPermissionBlocked(false)}
                className="w-full py-2.5 text-xs text-[#869486] font-semibold hover:text-white transition-colors"
              >
                Continue Without GPS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
