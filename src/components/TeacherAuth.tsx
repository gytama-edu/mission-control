import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Loader2, ArrowLeft, Eye, EyeOff, AlertTriangle, CheckCircle, MonitorPlay } from 'lucide-react';

interface TeacherAuthProps {
  onBack: () => void;
  onAuthSuccess: (user: any) => void;
}

export function TeacherAuth({ onBack, onAuthSuccess }: TeacherAuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        
        if (data.session) {
          onAuthSuccess(data.user);
        } else {
          setSuccessMsg('Registration successful! Please check your email for confirmation (if email confirmation is enabled), or log in.');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.user) {
          onAuthSuccess(data.user);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-950/15 via-slate-950/40 to-slate-950 pointer-events-none" />

      {/* Top Navigation Row */}
      <div className="w-full max-w-md mx-auto relative z-10 pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 cursor-pointer"
        >
          <ArrowLeft size={13} /> Back to Main Menu
        </button>
      </div>

      {/* Center Form Container */}
      <div className="max-w-md w-full mx-auto my-auto py-8 relative z-10">
        <div className="bg-slate-900/65 backdrop-blur-md border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
          
          {/* Header */}
          <div className="text-center mb-6 select-none">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded-full border border-purple-500/20 mb-3.5">
              Presented by GYTama EDU
            </div>
            <div className="relative inline-block mb-3.5">
              <div className="bg-purple-500/10 text-purple-400 p-2.5 rounded-xl border border-purple-500/20">
                <MonitorPlay size={20} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isSignUp ? 'Teacher Registration' : 'Teacher Access Portal'}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {isSignUp
                ? 'Create a secure administrator account to manage classes'
                : 'Sign in to access your classroom control panel'}
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-3 rounded-xl text-xs mb-5 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={13} className="shrink-0 text-red-400" />
                <span>Authentication Error</span>
              </div>
              <p className="leading-relaxed text-slate-300">{error}</p>
              {error.toLowerCase().includes('invalid login credentials') && (
                <p className="text-[11px] text-slate-400 pt-1 border-t border-red-500/10 leading-normal">
                  If you do not have an account yet, please click <strong className="text-purple-400">"Register an account"</strong> below. If you already signed up, verify your verification link if required.
                </p>
              )}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-3 rounded-xl text-xs mb-5 flex items-start gap-2 leading-relaxed">
              <CheckCircle size={14} className="shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-xs font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-xs font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer p-1 rounded hover:bg-slate-900 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold transition-all duration-200 mt-2.5 flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <span>{isSignUp ? 'Register Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          {/* Toggle link */}
          <div className="text-center mt-5 pt-5 border-t border-slate-850">
            <p className="text-xs text-slate-400">
              {isSignUp ? 'Already have an administrator account?' : "Need a new administrator account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-purple-400 hover:text-purple-300 font-semibold hover:underline focus:outline-none cursor-pointer"
              >
                {isSignUp ? 'Log in here' : 'Register an account'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full flex justify-center py-4 select-none relative z-10 border-t border-slate-900/40">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
          Mission Control &copy; {new Date().getFullYear()} &bull; GYTama EDU
        </p>
      </div>
    </div>
  );
}

