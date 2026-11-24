import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Flame, 
  RefreshCw, 
  ChevronRight, 
  LogOut,
  CheckCircle2,
  Camera as CameraIcon,
  ShieldCheck,
  MapPin,
  Activity,
  Bell,
  Heart,
  Lock,
  Fingerprint,
  Trash2,
  AlertTriangle,
  Mic,
  Sparkles,
  Music,
  ExternalLink
} from 'lucide-react';
import { apiRequest, clearStoredAuth } from '../services/api';
import { PermissionsService, PermissionStatusOverview } from '../services/permissions';
import { useModalStore } from '../store/modalStore';
import { FileText } from 'lucide-react';
import { wakeWordService } from '../services/wakeWord';
import { biometricService } from '../services/biometricService';
import { healthConnectService, HealthConnectStatus } from '../services/healthConnectService';

export const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const { openWeeklyReport } = useModalStore();

  const [profile, setProfile] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [permissionsState, setPermissionsState] = useState<PermissionStatusOverview | null>(null);
  const [showPermissionsManager, setShowPermissionsManager] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Security & Privacy state
  const [biometricLock, setBiometricLock] = useState<boolean>(
    biometricService.isLockEnabled()
  );
  const [aiConsent, setAiConsent] = useState<boolean>(() => {
    return localStorage.getItem('nocturne_ai_context_consent') !== 'false';
  });
  const [heyFridayEnabled, setHeyFridayEnabled] = useState<boolean>(
    wakeWordService.isWakeWordEnabled()
  );
  const [healthConnectStatus, setHealthConnectStatus] = useState<HealthConnectStatus | null>(null);
  const [isHealthConnectConnected, setIsHealthConnectConnected] = useState<boolean>(
    healthConnectService.isConnected()
  );
  const [lastHealthSync, setLastHealthSync] = useState<string | null>(
    healthConnectService.getLastSyncTime()
  );

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleHeyFriday = async () => {
    const nextState = !heyFridayEnabled;
    const res = await wakeWordService.setEnabled(nextState);
    setHeyFridayEnabled(res.success ? nextState : false);
    showToast(res.message);
    await PermissionsService.hapticTap();
  };

  const toggleBiometricLock = async () => {
    const nextState = !biometricLock;
    if (nextState) {
      // Must verify fingerprint before enabling
      const check = await biometricService.checkAvailability();
      if (!check.isAvailable) {
        showToast(`Biometric unavailable: ${check.reason || 'Hardware not supported'}`);
        return;
      }

      const auth = await biometricService.promptVerification('Verify your fingerprint to enable Nocturne App Lock');
      if (auth.authenticated) {
        setBiometricLock(true);
        biometricService.setLockEnabled(true);
        showToast('Biometric App Lock enabled — app will require fingerprint on launch & resume');
        await PermissionsService.hapticSuccess();
      } else {
        setBiometricLock(false);
        biometricService.setLockEnabled(false);
        showToast(auth.reason || 'Fingerprint verification canceled — App Lock remained OFF');
      }
    } else {
      setBiometricLock(false);
      biometricService.setLockEnabled(false);
      showToast('Biometric App Lock disabled');
      await PermissionsService.hapticTap();
    }
  };

  const toggleAiConsent = async () => {
    try {
      const newVal = !aiConsent;
      setAiConsent(newVal);
      localStorage.setItem('nocturne_ai_context_consent', String(newVal));

      await apiRequest('/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ aiHealthContextConsent: newVal })
      });

      if (newVal) {
        showToast('Friday Health Context enabled — Friday can now read your logged workouts & sleep');
      } else {
        showToast('Friday Health Context disabled — Friday will operate without personal health logs');
      }
      await PermissionsService.hapticSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to update AI consent');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert('Please enter your password to confirm account deletion.');
      return;
    }
    try {
      setIsDeleting(true);
      await apiRequest('/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword })
      });
      clearStoredAuth();
      alert('Your account and all associated health data have been permanently erased.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Account deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePickAvatar = async () => {
    await PermissionsService.hapticTap();
    const photo = await PermissionsService.pickProfilePhoto();
    if (photo) {
      setAvatarUrl(photo);
      await PermissionsService.hapticSuccess();
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await apiRequest('/user/profile');
      setProfile(res);
      if (res?.integrations?.aiHealthContextConsent !== undefined) {
        setAiConsent(res.integrations.aiHealthContextConsent);
        localStorage.setItem('nocturne_ai_context_consent', String(res.integrations.aiHealthContextConsent));
      }
      const permRes = await PermissionsService.getAllPermissionsStatus();
      setPermissionsState(permRes);

      const hc = await healthConnectService.checkDeviceStatus();
      setHealthConnectStatus(hc);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      const res = await healthConnectService.syncRealHealthData();
      if (res.success) {
        setIsHealthConnectConnected(true);
        setLastHealthSync(res.timestamp || 'Just now');
        setSyncStatus('Synced');
        showToast('Google Health Connect synced successfully');
        fetchProfile();
      } else {
        setIsHealthConnectConnected(false);
        setSyncStatus('Failed');
        showToast(res.message);
      }
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      setIsHealthConnectConnected(false);
      showToast(err.message || 'Health Connect sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    window.location.reload();
  };

  const name = profile?.displayName || 'User';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0c0f0e] text-[#e1e3e1] px-4 safe-top safe-nav-space max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between py-2">
        <h1 className="font-display text-2xl font-black text-white">Profile</h1>
        <button
          onClick={() => navigate('/record-weight')}
          className="w-10 h-10 rounded-full bg-[#191c1b] border border-white/5 flex items-center justify-center text-[#bccabb]"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* User Hero Banner */}
      <section className="glass-card p-6 rounded-[28px] my-4 border border-white/10 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePickAvatar}
              className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#191c1b] via-[#282b29] to-[#4ade80] p-0.5 flex items-center justify-center group cursor-pointer focus:outline-none"
              title="Change Profile Photo"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#0c0f0e] flex items-center justify-center text-white font-black text-xl">
                  {initial}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <CameraIcon className="w-4 h-4 text-[#6bfb9a]" />
              </div>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-black text-white">
                  {name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#4ade80]/20 text-[#4ade80] text-[10px] font-bold">
                  Lvl {profile?.level ?? 1}
                </span>
              </div>
              <span className="text-xs text-[#869486]">
                {profile?.membershipTier ?? 'Free'} Member
              </span>
            </div>
          </div>
        </div>

        {/* Lifetime Stats Strip */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5 text-center">
          <div className="bg-[#141a18] p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#869486] font-medium block">Workouts</span>
            <span className="text-base font-bold text-white tabular-nums">
              {profile?.stats?.workouts ?? 0}
            </span>
          </div>
          <div className="bg-[#141a18] p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#869486] font-medium block">Active</span>
            <span className="text-base font-bold text-white tabular-nums">
              {profile?.stats?.activeHours ?? 0}h
            </span>
          </div>
          <div className="bg-[#141a18] p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] text-[#869486] font-medium block">Streak</span>
            <span className="text-base font-bold text-[#4ade80] tabular-nums flex items-center justify-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current" />
              {profile?.stats?.streakDays ?? 0}d
            </span>
          </div>
        </div>
      </section>

      {/* Personal Biometrics & Navigation Links */}
      <div className="space-y-3 my-4">
        <span className="text-xs font-bold text-[#869486] uppercase tracking-wider block px-1">
          Biometric Targets & Settings
        </span>

        {/* Health Profile */}
        <div 
          onClick={() => navigate('/record-weight')}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-white block">Health Profile</span>
            <span className="text-[11px] text-[#869486]">
              {profile?.biometrics?.heightCm ? `${profile.biometrics.heightCm} cm` : 'Height not set'} • {profile?.biometrics?.weightKg ? `${profile.biometrics.weightKg} kg` : 'Weight not set'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#869486]" />
        </div>

        {/* Movement Goals */}
        <div 
          onClick={() => navigate('/workout-settings')}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-white block">Daily Movement Goals</span>
            <span className="text-[11px] text-[#869486]">
              {profile?.goals?.activeMinutes ? `${profile.goals.activeMinutes}m Active` : 'No active goal'} • {profile?.goals?.steps ? `${profile.goals.steps.toLocaleString()} Steps` : 'No step goal'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#869486]" />
        </div>

        {/* Sleep Targets */}
        <div 
          onClick={() => navigate('/sleep-analytics')}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-white block">Sleep Schedule & Targets</span>
            <span className="text-[11px] text-[#869486]">
              {profile?.goals?.sleepHours ? `Target: ${profile.goals.sleepHours}h nightly` : 'No sleep target set'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#869486]" />
        </div>

        {/* Weekly Trainer / Doctor Clinical Report */}
        <div 
          onClick={openWeeklyReport}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-[#4ade80]/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4ade80]/15 flex items-center justify-center text-[#4ade80] group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Weekly Clinical Report</span>
              <span className="text-[11px] text-[#869486]">
                Export & share last 7 days metrics with trainer or doctor
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#869486] group-hover:text-white transition-colors" />
        </div>

        {/* App Permissions Row */}
        <div 
          onClick={() => setShowPermissionsManager(!showPermissionsManager)}
          className="glass-card p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-white/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#191c1b] border border-white/10 flex items-center justify-center text-[#6bfb9a]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">App Permissions</span>
              <span className="text-[11px] text-[#869486]">
                {permissionsState?.location === 'granted' ? 'Location Active' : 'Permissions Setup'} • Manage Android Access
              </span>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-[#869486] transition-transform ${showPermissionsManager ? 'rotate-90' : ''}`} />
        </div>

        {/* Detailed Permissions List (Collapsible) */}
        {showPermissionsManager && (
          <div className="bg-[#141a18] p-4 rounded-2xl border border-white/5 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
              <span className="font-bold text-white">System Access Status</span>
              <button
                onClick={() => PermissionsService.openAppSettings()}
                className="text-[11px] font-bold text-[#6bfb9a] hover:underline"
              >
                Open Device Settings
              </button>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 text-[#bccabb]">
                <MapPin className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Precise Location (GPS)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                permissionsState?.location === 'granted' 
                  ? 'bg-[#4ade80]/15 text-[#4ade80]' 
                  : 'bg-[#ffb4ab]/15 text-[#ffb4ab]'
              }`}>
                {permissionsState?.location === 'granted' ? 'Allowed' : 'Denied / Prompt'}
              </span>
            </div>

            {/* Activity Recognition */}
            <div className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 text-[#bccabb]">
                <Activity className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Physical Activity (Steps)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4ade80]/15 text-[#4ade80]">
                Allowed
              </span>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 text-[#bccabb]">
                <Bell className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Workout Notifications</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                permissionsState?.notifications === 'granted' 
                  ? 'bg-[#4ade80]/15 text-[#4ade80]' 
                  : 'bg-white/10 text-[#bccabb]'
              }`}>
                {permissionsState?.notifications === 'granted' ? 'Allowed' : 'Not Set'}
              </span>
            </div>

            {/* Camera */}
            <div className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 text-[#bccabb]">
                <CameraIcon className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Camera & Media (Avatar)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                permissionsState?.camera === 'granted' 
                  ? 'bg-[#4ade80]/15 text-[#4ade80]' 
                  : 'bg-white/10 text-[#bccabb]'
              }`}>
                {permissionsState?.camera === 'granted' ? 'Allowed' : 'Optional'}
              </span>
            </div>

            {/* Microphone (Voice Coach) */}
            <div className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 text-[#bccabb]">
                <Mic className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Microphone (Voice Coach)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                permissionsState?.microphone === 'granted' 
                  ? 'bg-[#4ade80]/15 text-[#4ade80]' 
                  : 'bg-white/10 text-[#bccabb]'
              }`}>
                {permissionsState?.microphone === 'granted' ? 'Allowed' : 'Not Set'}
              </span>
            </div>

            {/* Health Connect */}
            <div className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 text-[#bccabb]">
                <Heart className="w-3.5 h-3.5 text-[#6bfb9a]" />
                <span>Google Health Connect</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-[#bccabb]">
                Available
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Security & Privacy Hardening Section */}
      <section className="bg-[#141a18] p-5 rounded-[28px] border border-white/5 my-4 space-y-4">
        <span className="text-xs font-bold text-[#869486] uppercase tracking-wider block">
          Security & Privacy
        </span>

        {/* Biometric App Lock */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#191c1b] border border-white/10 flex items-center justify-center text-[#6bfb9a]">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Biometric App Lock</span>
              <span className="text-[11px] text-[#869486]">
                Require Fingerprint or Face unlock on resume
              </span>
            </div>
          </div>
          <button
            onClick={toggleBiometricLock}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
              biometricLock ? 'bg-[#4ade80]' : 'bg-[#191c1b] border border-white/10'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform ${
                biometricLock ? 'translate-x-6 bg-[#0c0f0e]' : 'translate-x-0 bg-[#869486]'
              }`}
            />
          </button>
        </div>

        {/* Share Health Data with AI Coach */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#191c1b] border border-white/10 flex items-center justify-center text-[#6bfb9a]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Friday Health Context</span>
              <span className="text-[11px] text-[#869486]">
                Allow Friday to reference logged workouts & sleep
              </span>
            </div>
          </div>
          <button
            onClick={toggleAiConsent}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
              aiConsent ? 'bg-[#4ade80]' : 'bg-[#191c1b] border border-white/10'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform ${
                aiConsent ? 'translate-x-6 bg-[#0c0f0e]' : 'translate-x-0 bg-[#869486]'
              }`}
            />
          </button>
        </div>

        {/* Hands-Free Voice Activation ("Hey Friday" + Shake-to-Talk) */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#191c1b] border border-white/10 flex items-center justify-center text-[#6bfb9a]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">Hands-Free "Hey Friday"</span>
                <span className="px-1.5 py-0.5 rounded bg-[#4ade80]/20 text-[#4ade80] text-[9px] font-bold">VAD + Shake</span>
              </div>
              <span className="text-[11px] text-[#869486]">
                Say "Hey Friday" or shake phone while app is open
              </span>
            </div>
          </div>
          <button
            onClick={toggleHeyFriday}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
              heyFridayEnabled ? 'bg-[#4ade80]' : 'bg-[#191c1b] border border-white/10'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform ${
                heyFridayEnabled ? 'translate-x-6 bg-[#0c0f0e]' : 'translate-x-0 bg-[#869486]'
              }`}
            />
          </button>
        </div>

        {/* Permanent Account Deletion Button */}
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#93000a]/15 border border-[#93000a]/30 text-[#ffb4ab] text-xs font-bold hover:bg-[#93000a]/30 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account & Erase All Data</span>
          </button>
        </div>
      </section>

      {/* Google Health Connect Section */}
      <section className="bg-[#141a18] p-5 rounded-[28px] border border-white/5 my-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-5 h-5 ${isHealthConnectConnected ? 'text-[#4ade80]' : 'text-[#869486]'}`} />
            <div>
              <span className="text-xs font-bold text-white block">Google Health Connect</span>
              <span className={`text-[10px] font-semibold ${isHealthConnectConnected ? 'text-[#4ade80]' : 'text-[#869486]'}`}>
                {isHealthConnectConnected 
                  ? `Connected • Last synced ${lastHealthSync || 'recently'}` 
                  : (healthConnectStatus?.isInstalled ? 'Not Connected' : 'App Not Installed')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!healthConnectStatus?.isInstalled && (
              <button
                onClick={() => healthConnectService.openSettingsOrInstall()}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] font-semibold text-[#86efac] flex items-center gap-1"
              >
                <span>Install</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-4 py-2 rounded-full bg-[#191c1b] border border-white/10 hover:bg-[#282b29] text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#4ade80] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncStatus || (isSyncing ? 'Syncing...' : 'Sync Now')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Log out */}
      <button 
        onClick={handleLogout}
        className="w-full py-3.5 rounded-full bg-[#191c1b] text-xs font-bold text-[#ffb4ab] hover:bg-[#282b29] flex items-center justify-center gap-2 transition-all mt-6"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out of Nocturne</span>
      </button>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm glass-card rounded-[32px] p-6 border border-[#93000a]/40 bg-[#141A18]/95 shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#93000a]/20 border border-[#93000a] flex items-center justify-center mx-auto text-[#ffb4ab]">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-lg text-white">Permanently Delete Account?</h3>
              <p className="text-xs text-[#bccabb] leading-relaxed">
                This action is irreversible. All your recorded biometrics, weight trends, sleep logs, workouts, and AI chats will be permanently erased.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#869486] uppercase tracking-wider block">
                Confirm Your Password
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-[#191c1b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#869486] focus:outline-none focus:border-[#ffb4ab]"
              />
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deletePassword}
                className="w-full py-3.5 rounded-full bg-[#ba1a1a] text-white font-display font-bold text-xs shadow-lg shadow-[#ba1a1a]/30 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {isDeleting ? 'Erasing Everything...' : 'Confirm & Permanently Erase'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
                className="w-full py-2.5 text-xs text-[#869486] font-semibold hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 z-50 flex justify-center animate-in slide-in-from-bottom duration-200">
          <div className="px-4 py-2.5 rounded-2xl bg-[#141a18]/95 backdrop-blur-md border border-[#4ade80]/40 text-xs font-semibold text-white shadow-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
