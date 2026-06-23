import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, UserPlus, MessageSquareCode, AlertCircle, ArrowLeft, Key, Clock, CheckCircle } from 'lucide-react';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  // OTP Verification States
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, verifyOtp, resendOtp, user, error, setError } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
    return () => setError(null);
  }, [user, navigate, setError]);

  // Cooldown timer for resending OTP
  useEffect(() => {
    if (resendCooldown === 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setFormError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setFormError('');
    setLoadingLocal(true);
    try {
      await register(username, email, password);
      // Success means OTP was sent, show verification screen
      setShowOtpScreen(true);
      setOtpSuccess('Verification code sent to your email!');
    } catch (err) {
      setFormError(err.message || 'Registration failed');
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Please enter a 6-digit verification code');
      return;
    }

    setOtpError('');
    setOtpSuccess('');
    setLoadingLocal(true);
    try {
      await verifyOtp(email, otp);
      navigate('/');
    } catch (err) {
      setOtpError(err.message || 'Verification failed');
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    setOtpSuccess('');
    try {
      await resendOtp(email);
      setOtpSuccess('A new verification code has been sent!');
      setResendCooldown(30); // 30 seconds cooldown
    } catch (err) {
      setOtpError(err.message || 'Failed to resend code');
    }
  };

  const handleGoogleLogin = () => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass-container">
        <div className="logo-icon">
          <MessageSquareCode size={30} />
        </div>

        {showOtpScreen ? (
          <>
            <h2 className="auth-title">Verify Email</h2>
            <p className="auth-subtitle">We sent a 6-digit code to <strong style={{ color: 'var(--accent-indigo, #8b5cf6)' }}>{email}</strong></p>

            {otpError && (
              <div className="alert-error">
                <AlertCircle size={18} />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccess && (
              <div 
                className="alert-success" 
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderLeft: '4px solid var(--accent-green, #10b981)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '20px',
                  color: '#10b981',
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                <CheckCircle size={18} />
                <span>{otpSuccess}</span>
              </div>
            )}

            <form onSubmit={handleOtpSubmit}>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold' }}
                  />
                  <Key className="input-icon" size={18} />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loadingLocal || otp.length !== 6}
              >
                <UserPlus size={18} />
                {loadingLocal ? 'Verifying...' : 'Verify & Sign Up'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', fontSize: '13px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowOtpScreen(false);
                  setOtpError('');
                  setOtpSuccess('');
                  setOtp('');
                }}
                className="auth-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}
              >
                <ArrowLeft size={16} />
                <span>Edit Signup Details</span>
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="auth-link"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  color: resendCooldown > 0 ? 'var(--text-muted, #94a3b8)' : 'var(--accent-indigo, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0
                }}
              >
                <Clock size={16} />
                <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="auth-title">Join VibeChat</h2>
            <p className="auth-subtitle">Create a premium messaging profile</p>

            {(formError || error) && (
              <div className="alert-error">
                <AlertCircle size={18} />
                <span>{formError || error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <User className="input-icon" size={18} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="Create password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Lock className="input-icon" size={18} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                <UserPlus size={18} />
                {loadingLocal ? 'Sending Code...' : 'Sign Up'}
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
              Sign up with Google
            </button>

            <p className="auth-footer-text">
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Register;
