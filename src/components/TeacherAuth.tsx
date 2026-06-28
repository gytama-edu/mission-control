import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-6">
      <div className="flex-1" />

      <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl relative">
        <button
          onClick={onBack}
          className="mc-back-link mb-6"
        >
          <ArrowLeft size={14} className="mc-back-icon" /> Back to Main Menu
        </button>

        <div className="text-center mb-6">
          <div className="inline-block text-[10px] font-mono uppercase tracking-wider bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/20 mb-3 select-none">
            Presented by GYTama EDU
          </div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">
            {isSignUp ? 'Teacher Sign Up' : 'Teacher Login'}
          </h2>
          <p className="text-sm text-slate-400">
            {isSignUp
              ? 'Create a secure teacher account to manage your classes'
              : 'Sign in to access your classes and dashboards'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-4 text-center">
            <p className="font-semibold">{error}</p>
            {error.toLowerCase().includes('invalid login credentials') && (
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                If you do not have an account yet, please click <strong className="text-rose-400">"Sign up here"</strong> below to register. If you already signed up, please ensure you confirmed your email address via the link sent by Supabase.
              </p>
            )}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm mb-4 text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-sm font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-sm font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-all duration-200 mt-2 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/15"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : isSignUp ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-slate-800">
          <p className="text-sm text-slate-400">
            {isSignUp ? 'Already have a teacher account?' : "Don't have a teacher account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-rose-400 hover:text-rose-300 font-medium hover:underline focus:outline-none cursor-pointer"
            >
              {isSignUp ? 'Log in here' : 'Sign up here'}
            </button>
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-center pt-12 select-none">
        <p className="text-xs font-mono uppercase tracking-widest text-slate-600">
          Mission Control &copy; {new Date().getFullYear()} &bull; GYTama EDU
        </p>
      </div>
    </div>
  );
}
