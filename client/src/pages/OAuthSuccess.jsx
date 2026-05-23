import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthSuccess = () => {
  const { handleOAuthSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const id = params.get('id');
    const username = params.get('username');
    const avatar = params.get('avatar');
    const bio = params.get('bio');

    if (token && id && username) {
      // Store OAuth values into state & local storage
      handleOAuthSuccess({
        token,
        _id: id,
        username,
        avatar,
        bio,
      });

      // Redirect to main chat interface
      navigate('/');
    } else {
      // If parameters are missing, redirect back to login with error
      navigate('/login?error=oauth_failed');
    }
  }, [location, handleOAuthSuccess, navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: '#080b11',
      color: '#f8fafc',
      flexDirection: 'column',
      gap: '15px'
    }}>
      <div className="typing-dot" style={{ width: '40px', height: '40px', background: '#6366f1', borderRadius: '50%' }}></div>
      <h3 style={{ fontWeight: '500', fontSize: '18px' }}>Syncing with Google...</h3>
    </div>
  );
};

export default OAuthSuccess;
