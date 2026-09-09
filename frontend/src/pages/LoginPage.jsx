import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INSTITUTION } from '../config/institution';
import { Eye, EyeOff, Shield, GraduationCap, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const from = location.state?.from?.pathname || null;

  const demoAccounts = [
    { label: 'Admin', email: 'facultyhub0024@gmail.com', password: 'asdf123', icon: Shield, color: 'text-purple-400 bg-purple-950/40 border-purple-800/50 hover:bg-purple-900/40' },
    { label: 'Faculty', email: 'faculty@facultyhub.dev', password: 'Faculty@1234', icon: UserCheck, color: 'text-blue-400 bg-blue-950/40 border-blue-800/50 hover:bg-blue-900/40' },
  ];

  const fillDemo = (email, password) => {
    setForm({ email, password });
    setErrors({});
  };

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const data = await login({ email: form.email, password: form.password });
      if (data.success) {
        toast.success(`Welcome back, ${data.user.name}!`);
        if (from && !from.includes('/login') && !from.includes('/student')) {
          navigate(from, { replace: true });
        } else {
          navigate('/faculty/dashboard', { replace: true });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please verify the server is running and try again.';
      toast.error(msg);
      setErrors({ server: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-3 shadow-lg shadow-blue-600/30">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">
            FacultyHub
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {INSTITUTION.name || INSTITUTION.NAME}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Faculty & Administration Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Faculty & Admin Sign in</h2>
          <p className="text-xs text-slate-400 mb-6">Enter your registered academic credentials to access your workspace.</p>

          {/* Quick Demo Access Pills */}
          <div className="mb-6 pb-5 border-b border-slate-800">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2.5">
              Quick Demo Login:
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {demoAccounts.map((acc) => {
                const IconComponent = acc.icon;
                return (
                  <button
                    key={acc.label}
                    type="button"
                    onClick={() => fillDemo(acc.email, acc.password)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-medium transition-all ${acc.color}`}
                    title={`Autofill ${acc.label} (${acc.email})`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {errors.server && (
            <div className="mb-5 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{errors.server}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@facultyhub.dev"
                className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border text-white placeholder-slate-500 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  errors.email ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full px-3.5 py-2.5 pr-11 rounded-lg bg-slate-800 border text-white placeholder-slate-500 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    errors.password ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  id="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          FacultyHub &copy; {new Date().getFullYear()} — Dr. Panjabrao Deshmukh Polytechnic, Amravati
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
