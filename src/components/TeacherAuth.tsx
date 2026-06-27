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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Back to Menu
        </button>

        <div className="text-center mb-6">
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
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm mb-4 text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-colors mt-2 flex items-center justify-center gap-2"
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
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline focus:outline-none"
            >
              {isSignUp ? 'Log in here' : 'Sign up here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
