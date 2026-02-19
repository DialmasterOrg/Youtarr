import React, { useState } from 'react';
import axios from 'axios';
import { locationUtils } from '../utils/location';

interface LocalLoginProps {
  setToken: (token: string) => void;
}

const redirectTo = (path: string) => {
  locationUtils.setHref(path);
};

const LocalLogin: React.FC<LocalLoginProps> = ({ setToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axios.post('/auth/login', {
        username,
        password
      });

      const { token } = response.data;
      localStorage.setItem('authToken', token);
      setToken(token);
      redirectTo('/settings');
    } catch (err: any) {
      if (err.response?.data?.requiresSetup) {
        redirectTo('/setup');
      } else if (err.response?.status === 429) {
        // Rate limited - show the specific message from server
        setError(err.response?.data?.error || err.response?.data?.message || 'Too many login attempts. Please try again later.');
      } else if (err.response?.status === 401) {
        // Invalid credentials
        setError('Invalid username or password');
      } else if (err.response?.data?.error) {
        // Other server errors with specific messages
        setError(err.response.data.error);
      } else {
        // Generic error fallback
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="mt-2 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--app-text-primary)]">Username</span>
        <input
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--app-primary-main)] focus:ring-2 focus:ring-[var(--app-primary-main)]/20"
          name="username"
          type="text"
          autoComplete="username"
          aria-label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoFocus
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--app-text-primary)]">Password</span>
        <input
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--app-primary-main)] focus:ring-2 focus:ring-[var(--app-primary-main)]/20"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        />
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-[var(--app-primary-main)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

export default LocalLogin;