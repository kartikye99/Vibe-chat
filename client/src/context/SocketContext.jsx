import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // userId -> boolean

  const { token, user } = useAuth();

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to server socket
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketConnection = io(socketUrl, {
      auth: {
        token,
      },
    });

    setSocket(socketConnection);

    socketConnection.on('connect', () => {
      console.log('Socket connected successfully');
    });

    // Handle online users list on connection
    socketConnection.on('get_online_users', (users) => {
      setOnlineUsers(users);
    });

    // Handle single user status updates
    socketConnection.on('status_change', ({ userId, status }) => {
      if (status === 'online') {
        setOnlineUsers((prev) => [...new Set([...prev, userId])]);
      } else {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      }
    });

    // Handle typing indicator states at chat room level
    socketConnection.on('typing_status', ({ chatId, senderId, isTyping }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [chatId]: {
          ...(prev[chatId] || {}),
          [senderId]: isTyping,
        },
      }));
    });

    // Global sound notification chime for received messages
    socketConnection.on('receive_message', (msg) => {
      if (user && msg.sender._id !== user._id) {
        playNotificationSound();
      }
    });

    socketConnection.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Cleanup on unmount/auth change
    return () => {
      socketConnection.disconnect();
    };
  }, [token, user]);

  // Synthesis chimer using Web Audio API (no external file files needed)
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
          gain2.gain.setValueAtTime(0.1, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.25);
        } catch (err) {
          console.error(err);
        }
      }, 70);
    } catch (error) {
      console.warn('Notification sound playback blocked or failed:', error);
    }
  };

  // Actions
  const emitTyping = (chatId) => {
    if (socket) {
      socket.emit('typing', { chatId });
    }
  };

  const emitStopTyping = (chatId) => {
    if (socket) {
      socket.emit('stop_typing', { chatId });
    }
  };

  const joinChatRoom = (chatId) => {
    if (socket) {
      socket.emit('join_chat', chatId);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        typingUsers,
        emitTyping,
        emitStopTyping,
        joinChatRoom,
        playNotificationSound,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
