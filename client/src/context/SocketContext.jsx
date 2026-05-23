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
    // In local development, Express backend runs on http://localhost:5000
    const socketConnection = io('http://localhost:5000', {
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

    // Handle typing indicator states
    socketConnection.on('typing_status', ({ senderId, isTyping }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [senderId]: isTyping,
      }));
    });

    socketConnection.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Cleanup on unmount/auth change
    return () => {
      socketConnection.disconnect();
    };
  }, [token, user]);

  // Actions
  const emitTyping = (recipientId) => {
    if (socket) {
      socket.emit('typing', { recipientId });
    }
  };

  const emitStopTyping = (recipientId) => {
    if (socket) {
      socket.emit('stop_typing', { recipientId });
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
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
