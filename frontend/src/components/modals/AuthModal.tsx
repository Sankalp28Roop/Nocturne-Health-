import React, { useState } from 'react';
import { apiRequest, setStoredTokens } from '../../services/api';
import { Lock, Mail, User as UserIcon, Sparkles, ShieldCheck } from 'lucide-react';

export const AuthModal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body: any = { email, password };
      if (isRegister) body.displayName = displayName;

      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setStoredTokens(res.tokens.accessToken, res.tokens.refreshToken, res.user);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-sm glass-modal rounded-[32px] p-6 border border-white/10 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#4ade80]/15 flex items-center justify-center text-[#4ade80] mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl font-black text-white">
            {isRegister ? 'Create Account' : 'Welcome to Nocturne'}
          </h2>
          <p className="text-xs text-[#869486] mt-1">
            {isRegister ? 'Start tracking your real biometrics' : 'Sign in to access your personal telemetry'}
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-xs text-[#ffb4ab] mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div className="flex items-center gap-2 bg-[#141a18] rounded-xl px-3.5 py-2.5 border border-white/10">
              <UserIcon className="w-4 h-4 text-[#869486]" />
              <input
                type="text"
                placeholder="Full Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="bg-transparent text-xs text-white w-full focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#141a18] rounded-xl px-3.5 py-2.5 border border-white/10">
            <Mail className="w-4 h-4 text-[#869486]" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-transparent text-xs text-white w-full focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#141a18] rounded-xl px-3.5 py-2.5 border border-white/10">
            <Lock className="w-4 h-4 text-[#869486]" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-transparent text-xs text-white w-full focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-[#0c0f0e] font-display font-bold text-xs uppercase tracking-wider shadow-glow-primary active:scale-95 transition-all"
          >
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-4 space-y-3">
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(null); }}
            className="text-xs text-[#869486] hover:text-[#4ade80] transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>

          <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-[#4ade80]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Private On-Device Storage (Zero Cloud)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
