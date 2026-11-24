import React, { useState } from 'react';
import { Fingerprint, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { biometricService } from '../../services/biometricService';

interface BiometricLockOverlayProps {
  onUnlocked: () => void;
}

export const BiometricLockOverlay: React.FC<BiometricLockOverlayProps> = ({ onUnlocked }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleUnlockClick = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await biometricService.promptVerification('Verify your fingerprint to unlock Nocturne');
      if (res.authenticated) {
        onUnlocked();
      } else if (res.canceled) {
        setErrorMsg('Authentication canceled. Tap to try again.');
      } else {
        setErrorMsg(res.reason || 'Authentication failed. Please try again.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Biometric prompt error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#0c0f0e] px-6 py-14 select-none animate-in fade-in duration-300">
      <div className="flex items-center gap-2 pt-8">
        <div className="w-8 h-8 rounded-full bg-[#4ade80]/15 border border-[#4ade80]/30 flex items-center justify-center text-[#4ade80]">
          <Lock className="w-4 h-4" />
        </div>
        <span className="font-display font-black text-sm tracking-widest text-white uppercase">
          Nocturne Locked
        </span>
      </div>

      <div className="flex flex-col items-center text-center max-w-xs space-y-6">
        <div className="relative">
          <button
            onClick={handleUnlockClick}
            disabled={isVerifying}
            className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#141a18] to-[#1d2622] border-2 border-[#4ade80]/40 flex items-center justify-center text-[#4ade80] shadow-glow-primary hover:scale-105 active:scale-95 transition-all group"
          >
            <Fingerprint className={`w-12 h-12 stroke-[1.75] ${isVerifying ? 'animate-pulse' : 'group-hover:scale-110'} transition-transform`} />
          </button>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#4ade80] text-[#0c0f0e] flex items-center justify-center shadow-md">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[3]" />
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="font-display font-extrabold text-2xl text-white">
            App Locked
          </h2>
          <p className="text-xs text-[#869486] leading-relaxed">
            Biometric protection is active. Touch the fingerprint sensor to access your health data.
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          onClick={handleUnlockClick}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-bold text-xs uppercase tracking-wider shadow-glow-primary active:scale-95 transition-all"
        >
          {isVerifying ? 'Verifying...' : 'Unlock with Fingerprint'}
        </button>
      </div>

      <div className="text-center text-[10px] text-[#5e6e66] uppercase tracking-wider font-semibold">
        Obsidian Kinetic • Zero-Cloud Protected
      </div>
    </div>
  );
};
