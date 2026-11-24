import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Bot, Sparkles, Mic } from 'lucide-react';

import { FloatingBottomNav } from './components/navigation/FloatingBottomNav';
import { HealthDashboard } from './screens/HealthDashboard';
import { WorkoutsHub } from './screens/WorkoutsHub';
import { WorkoutSettings } from './screens/WorkoutSettings';
import { LiveWorkout } from './screens/LiveWorkout';
import { RecordWeightHeight } from './screens/RecordWeightHeight';
import { WeightAnalytics } from './screens/WeightAnalytics';
import { SleepRecoveryAnalytics } from './screens/SleepRecoveryAnalytics';
import { HeartRateVo2Analytics } from './screens/HeartRateVo2Analytics';
import { CommunityChallenges } from './screens/CommunityChallenges';
import { MyPage } from './screens/MyPage';
import { BoxBreathingScreen } from './screens/BoxBreathingScreen';
import { WorkoutSummaryScreen } from './screens/WorkoutSummaryScreen';
import { AuthModal } from './components/modals/AuthModal';
import { PermissionSetupModal } from './components/modals/PermissionSetupModal';
import { AiCoachDrawer } from './components/modals/AiCoachDrawer';
import { AiLiveVoiceOverlay } from './components/modals/AiLiveVoiceOverlay';
import { BiometricLockOverlay } from './components/modals/BiometricLockOverlay';
import { MealScannerModal } from './components/modals/MealScannerModal';
import { WeeklyReportModal } from './components/modals/WeeklyReportModal';
import { MusicPlayerBar } from './components/music/MusicPlayerBar';
import { useModalStore } from './store/modalStore';
import { useMusicStore } from './store/musicStore';
import { getStoredToken, apiRequest } from './services/api';
import { PermissionsService } from './services/permissions';
import { wakeWordService } from './services/wakeWord';
import { biometricService } from './services/biometricService';
import { tryHandleFastPathVoiceMusic } from './services/voiceMusicHandler';
import { offlineSyncEngine } from './services/offlineSync';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getStoredToken());
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(() => {
    return biometricService.isLockEnabled();
  });
  const [backToast, setBackToast] = useState<string | null>(null);
  const [networkSyncStatus, setNetworkSyncStatus] = useState(offlineSyncEngine.getStatus());

  const lastBackPressTimeRef = useRef<number>(0);

  const { 
    isQuickAddOpen, 
    closeQuickAdd, 
    isCalibrateOpen, 
    closeCalibrate, 
    isDiscardModalOpen, 
    closeDiscardModal, 
    isSleepNoteOpen, 
    closeSleepNote,
    isAiCoachOpen,
    closeAiCoach,
    openAiCoach,
    isLiveVoiceOpen,
    closeLiveVoice,
    openLiveVoice,
    isMealScannerOpen,
    closeMealScanner,
    isWeeklyReportOpen,
    closeWeeklyReport
  } = useModalStore();

  const {
    currentTrack,
    isPlaying,
    isDrawerOpen: isMusicDrawerOpen,
    closeDrawer: closeMusicDrawer,
    isSaySongModalOpen,
    setSaySongModalOpen
  } = useMusicStore();

  const mainTabs = ['/', '/workouts', '/community', '/my-page'];
  const showNav = mainTabs.includes(location.pathname);

  const handleFridayClick = () => {
    PermissionsService.hapticTap();
    openAiCoach();
  };

  const handleFridayVoiceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    PermissionsService.hapticTap();
    openLiveVoice();
  };

  useEffect(() => {
    // Check if permissions onboarding was completed
    PermissionsService.hasCompletedOnboarding().then((done) => {
      if (!done) {
        setShowPermissionsModal(true);
      }
    });

    try {
      StatusBar.setBackgroundColor({ color: '#0c0f0e' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    } catch {}

    // Register Hands-Free "Hey Friday" trigger callback
    wakeWordService.registerTriggerCallback(async (trigger, query) => {
      // Fast path instant check if trailing speech was provided
      if (query && query.trim()) {
        const fastRes = await tryHandleFastPathVoiceMusic(query);
        if (fastRes.handled) {
          return;
        }
      }

      // Default: Open Friday Live Voice overlay
      useModalStore.getState().openLiveVoice();
    });

    if (wakeWordService.isWakeWordEnabled()) {
      wakeWordService.startListening();
    }

    // Listen to App state transitions for background -> foreground locking
    const appStateListener = CapApp.addListener('appStateChange', (state) => {
      if (state.isActive && biometricService.isLockEnabled()) {
        setIsBiometricLocked(true);
      }
    });

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('nocturne_auth_unauthorized', handleUnauthorized);

    const backListener = CapApp.addListener('backButton', () => {
      // 1) Close topmost open modal/overlay/drawer first and do NOT exit
      if (isSaySongModalOpen) {
        setSaySongModalOpen(false);
        return;
      }
      if (isMusicDrawerOpen) {
        closeMusicDrawer();
        return;
      }
      if (isLiveVoiceOpen) {
        closeLiveVoice();
        return;
      }
      if (isAiCoachOpen) {
        closeAiCoach();
        return;
      }
      if (isQuickAddOpen) {
        closeQuickAdd();
        return;
      }
      if (isCalibrateOpen) {
        closeCalibrate();
        return;
      }
      if (isDiscardModalOpen) {
        closeDiscardModal();
        return;
      }
      if (isSleepNoteOpen) {
        closeSleepNote();
        return;
      }
      if (isMealScannerOpen) {
        closeMealScanner();
        return;
      }
      if (isWeeklyReportOpen) {
        closeWeeklyReport();
        return;
      }

      // 2) Else if current route is not root '/', navigate back
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
        return;
      }

      // 3) Else on root '/' with no modals open, require double-back within 2 seconds
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        CapApp.exitApp();
      } else {
        lastBackPressTimeRef.current = now;
        setBackToast('Press back again to exit');
        setTimeout(() => setBackToast(null), 2000);
      }
    });

    const unsubSync = offlineSyncEngine.addListener((status) => {
      setNetworkSyncStatus(status);
    });

    return () => {
      unsubSync();
      window.removeEventListener('nocturne_auth_unauthorized', handleUnauthorized);
      backListener.then(handle => handle.remove()).catch(() => {});
      appStateListener.then(handle => handle.remove()).catch(() => {});
    };
  }, [
    isSaySongModalOpen,
    isMusicDrawerOpen,
    isLiveVoiceOpen, 
    isAiCoachOpen, 
    isQuickAddOpen, 
    isCalibrateOpen, 
    isDiscardModalOpen, 
    isSleepNoteOpen,
    isMealScannerOpen,
    isWeeklyReportOpen,
    location.pathname
  ]);

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1]">
      {/* Offline / Syncing Obsidian Status Pill */}
      {(!networkSyncStatus.isOnline || networkSyncStatus.isSyncing) && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#141A18]/90 backdrop-blur-md border border-white/10 text-[11px] font-semibold shadow-lg">
            {!networkSyncStatus.isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-200">
                  Offline — saving locally {networkSyncStatus.pendingCount > 0 ? `(${networkSyncStatus.pendingCount})` : ''}
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-ping" />
                <span className="text-[#86efac]">
                  Syncing {networkSyncStatus.pendingCount} offline logs...
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <PermissionSetupModal 
        isOpen={showPermissionsModal} 
        onComplete={() => setShowPermissionsModal(false)} 
      />

      <AiCoachDrawer
        isOpen={isAiCoachOpen}
        onClose={closeAiCoach}
      />

      <AiLiveVoiceOverlay
        isOpen={isLiveVoiceOpen}
        onClose={closeLiveVoice}
      />

      <MealScannerModal
        isOpen={isMealScannerOpen}
        onClose={closeMealScanner}
      />

      <WeeklyReportModal
        isOpen={isWeeklyReportOpen}
        onClose={closeWeeklyReport}
      />

      {!isAuthenticated && (
        <AuthModal onSuccess={() => setIsAuthenticated(true)} />
      )}

      <Routes>
        <Route path="/" element={<HealthDashboard />} />
        <Route path="/workouts" element={<WorkoutsHub />} />
        <Route path="/workout-settings" element={<WorkoutSettings />} />
        <Route path="/live-workout" element={<LiveWorkout />} />
        <Route path="/workout-summary/:sessionId" element={<WorkoutSummaryScreen />} />
        <Route path="/breathing" element={<BoxBreathingScreen />} />
        <Route path="/record-weight" element={<RecordWeightHeight />} />
        <Route path="/weight-analytics" element={<WeightAnalytics />} />
        <Route path="/sleep-analytics" element={<SleepRecoveryAnalytics />} />
        <Route path="/cardio-analytics" element={<HeartRateVo2Analytics />} />
        <Route path="/community" element={<CommunityChallenges />} />
        <Route path="/my-page" element={<MyPage />} />
      </Routes>

      {showNav && <FloatingBottomNav />}

      {/* Floating Glowing Obsidian Kinetic Friday AI Button with 1-Tap Mic & Chat */}
      {showNav && (
        <div 
          className={`fixed right-4 z-40 transition-all duration-300 ease-out flex items-center gap-1.5 ${
            currentTrack && !isMusicDrawerOpen ? 'bottom-36' : 'bottom-24'
          }`}
        >
          {/* Direct 1-Tap Voice Orb Trigger */}
          <button
            onClick={handleFridayVoiceClick}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#191c1b] via-[#202923] to-[#4ade80]/40 border border-[#4ade80]/50 flex items-center justify-center text-[#4ade80] shadow-glow-primary hover:scale-105 active:scale-95 transition-all"
            title="1-Tap Instant Voice Talk with Friday"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Friday AI Coach Drawer Pill */}
          <button
            onClick={handleFridayClick}
            className="flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] shadow-glow-primary hover:scale-105 active:scale-95 transition-all group border border-white/40"
            title="Open Friday AI Coach Drawer"
          >
            <div className="w-6 h-6 rounded-full bg-[#0c0f0e] text-[#4ade80] flex items-center justify-center relative">
              <Bot className="w-3.5 h-3.5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#4ade80] animate-ping" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-display font-black text-xs tracking-tight leading-none text-[#0c0f0e]">
                Friday AI
              </span>
              <span className="text-[9px] font-bold text-[#141a18]/70 leading-none mt-0.5 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Coach</span>
              </span>
            </div>
          </button>
        </div>
      )}

      {/* In-App Obsidian Kinetic Music Player Bar */}
      <MusicPlayerBar />

      {/* Persistent Root-Level YouTube Audio Player */}
      {currentTrack?.videoId && (
        <div 
          aria-hidden="true" 
          className="fixed bottom-0 right-0 w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden z-[-1]"
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${currentTrack.videoId}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1&playsinline=1`}
            title="Nocturne Persistent Audio"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="w-full h-full border-0"
          />
        </div>
      )}

      {/* Biometric Native App Lock Fullscreen Guard */}
      {isBiometricLocked && (
        <BiometricLockOverlay onUnlocked={() => setIsBiometricLocked(false)} />
      )}

      {/* Back button Exit Toast */}
      {backToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 rounded-full bg-black/90 border border-white/10 text-xs font-semibold text-white shadow-xl animate-in fade-in duration-150">
          {backToast}
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
