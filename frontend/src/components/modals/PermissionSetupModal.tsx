import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Activity, 
  Bell, 
  Camera, 
  Heart, 
  ShieldCheck, 
  ChevronRight, 
  Check, 
  ExternalLink,
  Loader2
} from 'lucide-react';
import { PermissionsService, PermissionStatusOverview } from '../../services/permissions';

interface StepConfig {
  id: string;
  title: string;
  subtitle: string;
  rationale: string;
  icon: React.ReactNode;
  isOptional: boolean;
  action: () => Promise<boolean>;
  followUpNote?: string;
}

interface PermissionSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const PermissionSetupModal: React.FC<PermissionSetupModalProps> = ({ isOpen, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false);
  const [grantedMap, setGrantedMap] = useState<Record<string, boolean>>({});
  const [isRequesting, setIsRequesting] = useState(false);

  const steps: StepConfig[] = [
    {
      id: 'location',
      title: 'Precise Location',
      subtitle: 'GPS Workout Tracking',
      rationale: 'Track real-time distance, pace, and live outdoor routes during walking, running, and cycling sessions.',
      icon: <MapPin className="w-8 h-8 text-[#6bfb9a]" />,
      isOptional: false,
      action: async () => {
        const granted = await PermissionsService.requestLocationPermission();
        if (granted) {
          setShowBackgroundPrompt(true);
        }
        return granted;
      },
      followUpNote: 'For seamless tracking when your screen is locked, you can optionally enable "Allow all the time" in device settings.'
    },
    {
      id: 'activity',
      title: 'Physical Activity',
      subtitle: 'Step Counter & Cadence',
      rationale: "Count your daily steps, active minutes, and cadence using your phone's built-in motion sensor with minimal battery drain.",
      icon: <Activity className="w-8 h-8 text-[#6bfb9a]" />,
      isOptional: false,
      action: async () => {
        return await PermissionsService.requestActivityPermission();
      }
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Alerts & Live Workouts',
      rationale: 'Receive workout milestone cues, hydration reminders, and keep active workouts accessible in the notification shade.',
      icon: <Bell className="w-8 h-8 text-[#6bfb9a]" />,
      isOptional: false,
      action: async () => {
        return await PermissionsService.requestNotificationPermission();
      }
    },
    {
      id: 'camera',
      title: 'Camera & Photos',
      subtitle: 'Profile Avatar',
      rationale: 'Upload or capture a photo for your profile avatar. You can change this at any time in My Page.',
      icon: <Camera className="w-8 h-8 text-[#6bfb9a]" />,
      isOptional: true,
      action: async () => {
        return await PermissionsService.requestCameraPermission();
      }
    },
    {
      id: 'healthConnect',
      title: 'Google Health Connect',
      subtitle: 'Wearable & Biometric Sync',
      rationale: 'Sync sleep stages, resting heart rate, and workouts with compatible smartwatches and rings.',
      icon: <Heart className="w-8 h-8 text-[#6bfb9a]" />,
      isOptional: true,
      action: async () => {
        return true;
      }
    }
  ];

  // Auto-skip steps on initial mount if already granted
  useEffect(() => {
    if (!isOpen) return;

    PermissionsService.getAllPermissionsStatus().then((overview: PermissionStatusOverview) => {
      const alreadyGranted: Record<string, boolean> = {
        location: overview.location === 'granted',
        activity: overview.activity === 'granted',
        notifications: overview.notifications === 'granted',
        camera: overview.camera === 'granted',
        healthConnect: false
      };
      setGrantedMap(alreadyGranted);

      // Find first ungranted step index
      const firstUngrantedIndex = steps.findIndex(s => !alreadyGranted[s.id]);
      if (firstUngrantedIndex > 0) {
        setCurrentStep(firstUngrantedIndex);
      } else if (firstUngrantedIndex === -1) {
        // All permissions already granted!
        finishOnboarding();
      }
    }).catch(console.warn);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = steps[currentStep] || steps[0];

  const handleNextStep = () => {
    setShowBackgroundPrompt(false);
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishOnboarding();
    }
  };

  const handleAllow = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    await PermissionsService.hapticTap();

    let granted = false;
    try {
      granted = await current.action();
      setGrantedMap(prev => ({ ...prev, [current.id]: granted }));
      if (granted) {
        await PermissionsService.hapticSuccess();
      }
    } catch (err) {
      console.warn('[PermissionsModal] Action error:', err);
    } finally {
      setIsRequesting(false);

      // Brief delay after OS dialog dismisses so Android WebView resumes cleanly
      setTimeout(() => {
        // If location was granted, the UI shows the background prompt screen;
        // Otherwise, always advance automatically to the next step!
        if (current.id === 'location' && granted) {
          setShowBackgroundPrompt(true);
        } else {
          handleNextStep();
        }
      }, 150);
    }
  };

  const handleSkip = async () => {
    if (isRequesting) return;
    await PermissionsService.hapticTap();
    setGrantedMap(prev => ({ ...prev, [current.id]: false }));
    handleNextStep();
  };

  const finishOnboarding = async () => {
    await PermissionsService.markOnboardingCompleted();
    await PermissionsService.hapticSuccess();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm glass-card border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden bg-[#141A18]/95">
        
        {/* Glow ambient background accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#6bfb9a]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Step progress pills */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-6 bg-[#6bfb9a]'
                    : idx < currentStep
                    ? 'w-2 bg-[#4ade80]/60'
                    : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-[#869486] uppercase tracking-wider tabular-nums">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        {/* Modal Content */}
        {!showBackgroundPrompt ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#191c1b] border border-white/10 flex items-center justify-center mb-4 shadow-inner">
              {current.icon}
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-xl font-bold text-white tracking-tight">
                {current.title}
              </h2>
              {current.isOptional && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#bccabb] text-[10px] font-bold">
                  Optional
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-[#6bfb9a] uppercase tracking-wide mb-3">
              {current.subtitle}
            </p>

            <p className="text-xs text-[#bccabb] leading-relaxed mb-6 px-2">
              {current.rationale}
            </p>

            {/* Action buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={handleAllow}
                disabled={isRequesting}
                className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[#6bfb9a] to-[#4ade80] text-[#0c0f0e] font-display font-extrabold text-sm shadow-lg shadow-[#4ade80]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#0c0f0e]" />
                    <span>Requesting Access...</span>
                  </>
                ) : (
                  <>
                    <span>Allow Access</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                onClick={handleSkip}
                disabled={isRequesting}
                className="w-full py-2.5 px-4 rounded-full bg-transparent text-[#869486] hover:text-[#e1e3e1] text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {current.isOptional ? 'Skip for now' : 'Not now'}
              </button>
            </div>
          </div>
        ) : (
          /* Follow-up: Background Location prompt */
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#191c1b] border border-[#6bfb9a]/30 flex items-center justify-center mb-4 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-[#6bfb9a]" />
            </div>

            <h2 className="font-display text-lg font-bold text-white tracking-tight mb-1">
              Screen-Off Tracking
            </h2>

            <p className="text-xs font-semibold text-[#6bfb9a] uppercase tracking-wide mb-3">
              Allow All the Time
            </p>

            <p className="text-xs text-[#bccabb] leading-relaxed mb-6 px-1">
              To record your workout routes and pace when your phone screen turns off in your pocket, select <strong>"Allow all the time"</strong> in Android settings.
            </p>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => {
                  PermissionsService.openAppSettings();
                  handleNextStep();
                }}
                className="w-full py-3 px-4 rounded-full bg-[#191c1b] border border-[#6bfb9a]/40 text-[#6bfb9a] font-display font-bold text-xs hover:bg-[#6bfb9a]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>Open Settings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleNextStep}
                className="w-full py-2.5 px-4 rounded-full bg-transparent text-[#869486] hover:text-[#e1e3e1] text-xs font-semibold transition-colors"
              >
                Keep Current (While Using)
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
