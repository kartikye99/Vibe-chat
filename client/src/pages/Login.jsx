import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, MessageSquareCode, AlertCircle } from 'lucide-react';

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  const { login, user, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Read URL query errors (e.g. if Google OAuth failed)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errParam = params.get('error');
    if (errParam === 'oauth_failed') {
      setFormError('Google Login failed. Please try again.');
    } else if (errParam) {
      setFormError('An error occurred during authentication.');
    }
    // Clean up error state on unmount
    return () => setError(null);
  }, [location, setError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailOrUsername || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    setFormError('');
    setLoadingLocal(true);
    try {
      await login(emailOrUsername, password);
      navigate('/');
    } catch (err) {
      setFormError(err.message || 'Invalid credentials');
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect browser to backend Google OAuth initiation route dynamically
    const API_BASE = import.meta.env.VITE_API_URL || '';
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass-container">
        <div className="logo-icon">
          <MessageSquareCode size={30} />
        </div>
        <h2 className="auth-title">Welcome to VibeChat</h2>
        <p className="auth-subtitle">Elevate your messaging experience</p>

        {(formError || error) && (
          <div className="alert-error">
            <AlertCircle size={18} />
            <span>{formError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email or Username</label>
            <div className="input-wrapper">
              <input
                type="text"
                className="form-input"
                placeholder="Enter email or username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
              />
              <Mail className="input-icon" size={18} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock className="input-icon" size={18} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loadingLocal}
          >
            <LogIn size={18} />
            {loadingLocal ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="divider">Or continue with</div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="btn btn-google"
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11C18.281 1.09 15.42 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.195-1.925H12.24z"
            />
          </svg>
          Sign in with Google
        </button>

        <p className="auth-footer-text">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
