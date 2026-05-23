import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  MessageSquare,
  Search,
  LogOut,
  Settings,
  Send,
  User,
  X,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';

const ChatDashboard = () => {
  const { user, token, logout, updateProfile } = useAuth();
  const { socket, onlineUsers, typingUsers, emitTyping, emitStopTyping } = useSocket();
  const navigate = useNavigate();

  // State Variables
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Mobile View Helpers
  const [mobileChatActive, setMobileChatActive] = useState(false);

  // Refs
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // Load Users List
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      try {
        const url = searchQuery
          ? `/api/users?search=${encodeURIComponent(searchQuery)}`
          : '/api/users';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };

    // Debounce search slightly
    const delayDebounce = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token]);

  // Load Conversation Messages when active user changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeUser || !token) return;
      try {
        const res = await fetch(`/api/messages/${activeUser._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);

          // Clear unread count for this user
          setUnreadCounts((prev) => ({
            ...prev,
            [activeUser._id]: 0,
          }));
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();
  }, [activeUser, token]);

  // Socket Message and Read receipts handler
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg) => {
      // If message is from the currently active chat partner
      if (activeUser && (msg.sender._id === activeUser._id || msg.recipient._id === activeUser._id)) {
        setMessages((prev) => [...prev, msg]);
        
        // If message is sent to me, mark it read on the backend
        if (msg.recipient._id === user._id) {
          fetch(`/api/messages/${activeUser._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(err => console.error(err));
        }
      } else {
        // Increment unread count for the sender
        const senderId = msg.sender._id;
        setUnreadCounts((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
      }
    };

    const handleMessagesRead = ({ readerId }) => {
      if (activeUser && readerId === activeUser._id) {
        // Mark all sent messages as read in state
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender === user._id || msg.sender._id === user._id
              ? { ...msg, read: true }
              : msg
          )
        );
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [socket, activeUser, user, token]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing input changes and socket events
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!activeUser) return;

    // Send typing status to socket
    emitTyping(activeUser._id);

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping(activeUser._id);
    }, 2000);
  };

  // Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeUser || !token) return;

    const messageContent = newMessage;
    setNewMessage('');
    emitStopTyping(activeUser._id);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId: activeUser._id,
          content: messageContent,
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        // Append sent message to chat state
        setMessages((prev) => [...prev, msg]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Profile Modal Actions
  const handleOpenProfileModal = () => {
    setEditUsername(user?.username || '');
    setEditBio(user?.bio || '');
    setEditAvatar(user?.avatar || '');
    setProfileError('');
    setProfileSuccess('');
    setShowProfileModal(true);
  };

  const handleGenerateNewAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`;
    setEditAvatar(newAvatarUrl);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);

    if (!editUsername.trim()) {
      setProfileError('Username cannot be empty');
      setSavingProfile(false);
      return;
    }

    try {
      await updateProfile({
        username: editUsername,
        bio: editBio,
        avatar: editAvatar,
      });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setShowProfileModal(false), 1000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Mobile Back Navigation
  const handleBackToContacts = () => {
    setActiveUser(null);
    setMobileChatActive(false);
  };

  const handleSelectContact = (contact) => {
    setActiveUser(contact);
    setMobileChatActive(true);
  };

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar Section */}
      <div className={`sidebar glass-container ${mobileChatActive ? 'inactive-mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Sparkles size={22} style={{ color: '#8b5cf6' }} />
            <span>VibeChat</span>
          </div>
          <div className="sidebar-actions">
            <button className="icon-btn" title="Settings" onClick={handleOpenProfileModal}>
              <Settings size={18} />
            </button>
            <button className="icon-btn" title="Log Out" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Search Contacts */}
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="search-icon" size={16} />
        </div>

        {/* User Contacts List */}
        <div className="sidebar-list">
          {users.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '14px' }}>
              No contacts found
            </div>
          ) : (
            users.map((item) => {
              const isOnline = onlineUsers.includes(item._id);
              const unread = unreadCounts[item._id] || 0;
              const isActive = activeUser && activeUser._id === item._id;

              return (
                <div
                  key={item._id}
                  className={`user-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectContact(item)}
                >
                  <div className="avatar-wrapper">
                    <img className="avatar-img" src={item.avatar} alt={item.username} />
                    <div className={`status-dot ${isOnline ? 'online' : ''}`} />
                  </div>
                  <div className="user-info">
                    <div className="user-meta">
                      <span className="user-name">{item.username}</span>
                      {unread > 0 && <span className="unread-badge">{unread}</span>}
                    </div>
                    <span className="user-status-text">
                      {typingUsers[item._id] ? (
                        <span style={{ color: 'var(--accent-indigo)', fontWeight: '500' }}>typing...</span>
                      ) : (
                        item.bio || 'Available'
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Logged in User Profile Footer */}
        {user && (
          <div className="sidebar-profile">
            <div className="avatar-wrapper" style={{ width: '40px', height: '40px' }}>
              <img className="avatar-img" src={user.avatar} alt={user.username} />
              <div className="status-dot online" />
            </div>
            <div className="user-info">
              <div className="profile-name">{user.username}</div>
              <div className="profile-tag">My Profile</div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Area Section */}
      <div className={`chat-area glass-container ${mobileChatActive ? 'active-mobile' : ''}`}>
        {activeUser ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-user">
                <button
                  className="icon-btn"
                  style={{ display: 'flex', marginRight: '6px' }}
                  onClick={handleBackToContacts}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="avatar-wrapper" style={{ width: '40px', height: '40px' }}>
                  <img className="avatar-img" src={activeUser.avatar} alt={activeUser.username} />
                  <div className={`status-dot ${onlineUsers.includes(activeUser._id) ? 'online' : ''}`} />
                </div>
                <div>
                  <div className="chat-header-name">{activeUser.username}</div>
                  <div className="chat-header-status">
                    {onlineUsers.includes(activeUser._id) ? 'online' : 'offline'}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty" style={{ flex: 1 }}>
                  <MessageSquare size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>Send a message to start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isSentByMe = msg.sender === user?._id || msg.sender?._id === user?._id;
                  return (
                    <div key={msg._id || index} className={`msg-wrapper ${isSentByMe ? 'sent' : 'received'}`}>
                      <div className="msg-bubble">{msg.content}</div>
                      <div className="msg-meta">
                        <Clock size={10} />
                        <span>{formatTime(msg.createdAt)}</span>
                        {isSentByMe && (
                          <span style={{ marginLeft: '4px', color: msg.read ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicators */}
              {typingUsers[activeUser._id] && (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>

            {/* Send Chat Form */}
            <div className="chat-input-area">
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder={`Write a message to ${activeUser.username}...`}
                    value={newMessage}
                    onChange={handleInputChange}
                  />
                </div>
                <button type="submit" className="btn-send">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <MessageSquare size={36} />
            </div>
            <h3 className="chat-empty-title">Select a Contact</h3>
            <p>Choose an online contact from the sidebar list to start chatting in real time.</p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-container" style={{ background: 'var(--bg-secondary)', maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Profile</h3>
              <button className="icon-btn" onClick={() => setShowProfileModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="modal-body">
                {profileError && (
                  <div className="alert-error" style={{ marginBottom: '10px' }}>
                    <AlertCircle size={18} />
                    <span>{profileError}</span>
                  </div>
                )}
                {profileSuccess && (
                  <div className="alert-error" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', marginBottom: '10px' }}>
                    <span>{profileSuccess}</span>
                  </div>
                )}

                <div className="avatar-edit-wrapper">
                  <img className="avatar-edit-img" src={editAvatar} alt="edit avatar" />
                  <button type="button" className="avatar-refresh-btn" onClick={handleGenerateNewAvatar} title="Generate random avatar">
                    <RefreshCw size={16} />
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    style={{ paddingLeft: '14px' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Status / Bio</label>
                  <textarea
                    className="form-input"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    style={{ paddingLeft: '14px', height: '80px', resize: 'none', fontFamily: 'inherit' }}
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDashboard;
