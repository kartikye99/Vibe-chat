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
  Users,
  Plus,
  Paperclip,
  Image,
  Video,
  FileText,
  Download,
  AlertCircle,
  Bell,
} from 'lucide-react';

const ChatDashboard = () => {
  const { user, token, logout, updateProfile } = useAuth();
  const { socket, onlineUsers, typingUsers, emitTyping, emitStopTyping, joinChatRoom } = useSocket();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || '';

  // State Variables
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]); // All users for starting chats / group creation
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});

  // Message Search
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  // Group Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [groupError, setGroupError] = useState('');

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  // Toast State for Background Notifications
  const [toastNotification, setToastNotification] = useState(null);

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

  // Request browser notification permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch all chats for the logged-in user
  const loadChats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        
        // Auto-join all socket rooms for background notifications
        data.forEach((c) => {
          joinChatRoom(c._id);
        });
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  // Fetch all users list
  const loadAllUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  useEffect(() => {
    loadChats();
    loadAllUsers();
  }, [token]);

  // Load Messages when active chat changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChat || !token) return;
      try {
        const res = await fetch(`${API_BASE}/api/messages/${activeChat._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);

          // Clear unread count for this room locally
          setUnreadCounts((prev) => ({
            ...prev,
            [activeChat._id]: 0,
          }));
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();
    setMsgSearchQuery(''); // Reset search query on chat switch
    setShowMsgSearch(false);
  }, [activeChat, token]);

  // Socket listener for new messages & read status updates
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg) => {
      const msgChatId = msg.chat._id || msg.chat;
      const isSentByMe = msg.sender._id === user?._id;

      // Case 1: Message is in the currently active chat
      if (activeChat && msgChatId === activeChat._id) {
        setMessages((prev) => [...prev, msg]);

        // If I received this message from someone else, mark it read on server
        if (!isSentByMe) {
          fetch(`${API_BASE}/api/messages/${activeChat._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch((err) => console.error(err));
        }
      } else {
        // Case 2: Message is in a background room
        if (!isSentByMe) {
          // Increment unread count badge
          setUnreadCounts((prev) => ({
            ...prev,
            [msgChatId]: (prev[msgChatId] || 0) + 1,
          }));

          // Trigger Toast Notification popup
          const chatDetails = chats.find((c) => c._id === msgChatId) || msg.chat;
          const chatName = chatDetails.isGroupChat 
            ? chatDetails.chatName 
            : msg.sender.username;

          setToastNotification({
            id: Date.now(),
            chatId: msgChatId,
            senderName: msg.sender.username,
            senderAvatar: msg.sender.avatar,
            chatName: chatName,
            content: msg.fileUrl ? '📎 Sent an attachment' : msg.content,
          });

          // Show browser push notification if app is out of focus
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(`VibeChat: ${chatName}`, {
              body: msg.fileUrl ? `${msg.sender.username} sent an attachment` : `${msg.sender.username}: ${msg.content}`,
              icon: msg.sender.avatar,
            });
          }
        }
      }
    };

    const handleMessagesRead = ({ chatId, readerId }) => {
      if (activeChat && chatId === activeChat._id && readerId !== user?._id) {
        // Update read checkmark indicators in active conversation
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender._id === user?._id || msg.sender === user?._id
              ? { ...msg, readBy: [...new Set([...(msg.readBy || []), readerId])] }
              : msg
          )
        );
      }
    };

    const handleUpdateChatList = (msg) => {
      // Re-fetch chats to keep sorting and latestMessage snippet synchronized
      loadChats();
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('update_chat_list', handleUpdateChatList);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('update_chat_list', handleUpdateChatList);
    };
  }, [socket, activeChat, user, token, chats]);

  // Auto-dismiss toast notifications after 4 seconds
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing actions
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!activeChat) return;

    emitTyping(activeChat._id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping(activeChat._id);
    }, 2000);
  };

  // Send standard text message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !token) return;

    const messageContent = newMessage;
    setNewMessage('');
    emitStopTyping(activeChat._id);

    try {
      await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatId: activeChat._id,
          content: messageContent,
        }),
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Handle file uploads (mulitpart data)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat || !token) return;

    setUploading(true);
    setUploadProgress('Uploading...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const fileData = await res.json();
        
        // After uploading the file, send it as a message
        await fetch(`${API_BASE}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            chatId: activeChat._id,
            fileUrl: fileData.fileUrl,
            fileType: fileData.fileType,
            content: fileData.fileName, // Store file name as fallback text
          }),
        });
        setUploadProgress('Success!');
      } else {
        const errData = await res.json();
        alert(errData.message || 'File upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error uploading file');
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create or access 1-to-1 chat with a user
  const handleAccessChat = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        const chatData = await res.json();
        
        // Add chat to locally tracked chats if it's not present
        if (!chats.some((c) => c._id === chatData._id)) {
          setChats((prev) => [chatData, ...prev]);
        }
        
        // Make active chat
        setActiveChat(chatData);
        joinChatRoom(chatData._id);
        setMobileChatActive(true);
        setSearchQuery(''); // Reset search query
      }
    } catch (err) {
      console.error('Error accessing chat:', err);
    }
  };

  // Group creation modal selections
  const handleToggleGroupUser = (userId) => {
    setSelectedGroupUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    setGroupError('');

    if (!groupName.trim()) {
      setGroupError('Group name is required');
      return;
    }

    if (selectedGroupUsers.length < 2) {
      setGroupError('Please select at least 2 contacts');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName,
          users: selectedGroupUsers, // sends array directly
        }),
      });

      if (res.ok) {
        const groupData = await res.json();
        
        // Add group to chats list and select it
        setChats((prev) => [groupData, ...prev]);
        setActiveChat(groupData);
        joinChatRoom(groupData._id);
        
        // Close modal and reset fields
        setShowGroupModal(false);
        setGroupName('');
        setSelectedGroupUsers([]);
        setMobileChatActive(true);
      } else {
        const data = await res.json();
        setGroupError(data.message || 'Failed to create group');
      }
    } catch (err) {
      console.error('Create group error:', err);
      setGroupError('Server connection error');
    }
  };

  // Profile update modal
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

  const getChatName = (chat) => {
    if (chat.isGroupChat) return chat.chatName;
    // For 1-to-1, find the user that is NOT the currently logged-in user
    const otherUser = chat.users.find((u) => u._id !== user?._id);
    return otherUser ? otherUser.username : 'User';
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) {
      // Return a clean, premium group icon svg from dicebear using the group name seed
      return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(chat.chatName)}`;
    }
    const otherUser = chat.users.find((u) => u._id !== user?._id);
    return otherUser ? otherUser.avatar : 'https://api.dicebear.com/7.x/bottts/svg?seed=avatar';
  };

  const getChatBio = (chat) => {
    if (chat.isGroupChat) {
      return `${chat.users.length} members`;
    }
    const otherUser = chat.users.find((u) => u._id !== user?._id);
    const otherUserOnline = otherUser ? onlineUsers.includes(otherUser._id) : false;
    return otherUserOnline ? 'online' : 'offline';
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Dynamic filter for matching messages
  const filteredMessages = messages.filter((msg) =>
    msg.content?.toLowerCase().includes(msgSearchQuery.toLowerCase())
  );

  // Filter existing chats by name, or search other users to start new chat
  const filteredChats = chats.filter((chat) =>
    getChatName(chat).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Exclude users we already have 1-to-1 chats with from the "new chat" suggestions
  const usersAvailableForNewChat = users.filter((u) => {
    if (u._id === user?._id) return false; // Exclude self
    const hasChat = chats.some(
      (c) => !c.isGroupChat && c.users.some((chatUser) => chatUser._id === u._id)
    );
    return !hasChat && u.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="dashboard-wrapper">
      {/* Toast Notification for background room activities */}
      {toastNotification && (
        <div 
          className="modal-content glass-container" 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 2000,
            maxWidth: '320px',
            padding: '12px 16px',
            background: 'rgba(15, 22, 36, 0.85)',
            borderLeft: '4px solid var(--accent-indigo)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-lg)'
          }}
          onClick={() => {
            const chatToSelect = chats.find((c) => c._id === toastNotification.chatId);
            if (chatToSelect) setActiveChat(chatToSelect);
            setToastNotification(null);
            setMobileChatActive(true);
          }}
        >
          <img 
            src={toastNotification.senderAvatar} 
            alt={toastNotification.senderName} 
            style={{ width: '36px', height: '36px', borderRadius: '50%' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {toastNotification.chatName}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {toastNotification.senderName}: {toastNotification.content}
            </div>
          </div>
          <button 
            className="icon-btn" 
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.stopPropagation();
              setToastNotification(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sidebar Section */}
      <div className={`sidebar glass-container ${mobileChatActive ? 'inactive-mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Sparkles size={22} style={{ color: '#8b5cf6' }} />
            <span>VibeChat</span>
          </div>
          <div className="sidebar-actions">
            <button className="icon-btn" title="Create Group Chat" onClick={() => setShowGroupModal(true)}>
              <Users size={18} />
            </button>
            <button className="icon-btn" title="Settings" onClick={handleOpenProfileModal}>
              <Settings size={18} />
            </button>
            <button className="icon-btn" title="Log Out" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Search Contacts / Users */}
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search chats or start new..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="search-icon" size={16} />
        </div>

        {/* Conversation list */}
        <div className="sidebar-list">
          {/* Active Chats list */}
          {filteredChats.map((chat) => {
            const isSelected = activeChat && activeChat._id === chat._id;
            const unread = unreadCounts[chat._id] || 0;
            const hasTyping = typingUsers[chat._id] && Object.values(typingUsers[chat._id]).some(Boolean);

            // Determine if the contact is online (1-to-1 chats only)
            let isOnline = false;
            if (!chat.isGroupChat) {
              const otherUser = chat.users.find((u) => u._id !== user?._id);
              if (otherUser) isOnline = onlineUsers.includes(otherUser._id);
            }

            return (
              <div
                key={chat._id}
                className={`user-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setActiveChat(chat);
                  setMobileChatActive(true);
                }}
              >
                <div className="avatar-wrapper">
                  <img className="avatar-img" src={getChatAvatar(chat)} alt={getChatName(chat)} />
                  <div className={`status-dot ${isOnline ? 'online' : ''}`} style={{ display: chat.isGroupChat ? 'none' : 'block' }} />
                </div>
                <div className="user-info">
                  <div className="user-meta">
                    <span className="user-name">{getChatName(chat)}</span>
                    {unread > 0 && <span className="unread-badge">{unread}</span>}
                  </div>
                  <span className="user-status-text">
                    {hasTyping ? (
                      <span style={{ color: 'var(--accent-indigo)', fontWeight: '500' }}>typing...</span>
                    ) : chat.latestMessage ? (
                      `${chat.latestMessage.sender._id === user?._id ? 'You: ' : ''}${chat.latestMessage.fileUrl ? '📎 File' : chat.latestMessage.content}`
                    ) : (
                      getChatBio(chat)
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {/* New Chats suggestions (when searching) */}
          {searchQuery.trim().length > 0 && usersAvailableForNewChat.length > 0 && (
            <>
              <div className="divider" style={{ margin: '14px 0 8px' }}>Start new chat</div>
              {usersAvailableForNewChat.map((otherUser) => (
                <div
                  key={otherUser._id}
                  className="user-item"
                  onClick={() => handleAccessChat(otherUser._id)}
                >
                  <div className="avatar-wrapper">
                    <img className="avatar-img" src={otherUser.avatar} alt={otherUser.username} />
                    <div className={`status-dot ${onlineUsers.includes(otherUser._id) ? 'online' : ''}`} />
                  </div>
                  <div className="user-info">
                    <div className="user-name">{otherUser.username}</div>
                    <div className="user-status-text">{otherUser.bio || 'Available'}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {filteredChats.length === 0 && usersAvailableForNewChat.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '14px' }}>
              No chats or users found
            </div>
          )}
        </div>

        {/* Profile Footer */}
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
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-user" style={{ flex: 1, minWidth: 0 }}>
                <button
                  className="icon-btn"
                  style={{ display: 'flex', marginRight: '6px' }}
                  onClick={() => setMobileChatActive(false)}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="avatar-wrapper" style={{ width: '40px', height: '40px' }}>
                  <img className="avatar-img" src={getChatAvatar(activeChat)} alt={getChatName(activeChat)} />
                  {!activeChat.isGroupChat && (
                    <div 
                      className={`status-dot ${
                        onlineUsers.includes(activeChat.users.find(u => u._id !== user?._id)?._id) ? 'online' : ''
                      }`} 
                    />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="chat-header-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getChatName(activeChat)}
                  </div>
                  <div className="chat-header-status">
                    {getChatBio(activeChat)}
                  </div>
                </div>
              </div>

              {/* Message Search toggler */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {showMsgSearch && (
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search messages..."
                    value={msgSearchQuery}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    style={{ width: '150px', padding: '6px 12px' }}
                  />
                )}
                <button 
                  className={`icon-btn ${showMsgSearch ? 'active' : ''}`} 
                  onClick={() => {
                    setShowMsgSearch(!showMsgSearch);
                    setMsgSearchQuery('');
                  }}
                  title="Search message history"
                >
                  <Search size={18} />
                </button>
              </div>
            </div>

            {/* Chat Message feed */}
            <div className="chat-messages">
              {filteredMessages.length === 0 ? (
                <div className="chat-empty" style={{ flex: 1 }}>
                  <MessageSquare size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>{msgSearchQuery ? 'No matching messages found.' : 'Send a message to start conversation!'}</p>
                </div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isSentByMe = msg.sender._id === user?._id || msg.sender === user?._id;
                  
                  // Read checkmark condition: if 1-to-1, show read if readBy has other user
                  const otherUser = activeChat.users.find((u) => u._id !== user?._id);
                  const isRead = !activeChat.isGroupChat 
                    ? msg.readBy?.includes(otherUser?._id)
                    : msg.readBy?.length > 1; // Read by sender + at least 1 other

                  return (
                    <div key={msg._id || index} className={`msg-wrapper ${isSentByMe ? 'sent' : 'received'}`}>
                      {/* Render sender avatar and username in Group chats */}
                      {activeChat.isGroupChat && !isSentByMe && (
                        <img 
                          src={msg.sender.avatar} 
                          alt={msg.sender.username} 
                          style={{ width: '28px', height: '28px', borderRadius: '50%', marginBottom: '4px', border: '1px solid var(--glass-border)' }}
                          title={msg.sender.username}
                        />
                      )}

                      <div>
                        {activeChat.isGroupChat && !isSentByMe && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px', marginLeft: '4px', fontWeight: 500 }}>
                            {msg.sender.username}
                          </div>
                        )}
                        <div className="msg-bubble">
                          {/* Render text content */}
                          {msg.content && <div>{msg.content}</div>}

                          {/* Render image attachment */}
                          {msg.fileUrl && msg.fileType?.startsWith('image/') && (
                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={msg.fileUrl} 
                                alt="attachment" 
                                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginTop: msg.content ? '8px' : '0', display: 'block' }}
                              />
                            </a>
                          )}

                          {/* Render video attachment */}
                          {msg.fileUrl && msg.fileType?.startsWith('video/') && (
                            <video 
                              src={msg.fileUrl} 
                              controls 
                              style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginTop: msg.content ? '8px' : '0', display: 'block' }} 
                            />
                          )}

                          {/* Render generic file attachments */}
                          {msg.fileUrl && !msg.fileType?.startsWith('image/') && !msg.fileType?.startsWith('video/') && (
                            <div 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px', 
                                background: 'rgba(0,0,0,0.15)', 
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                marginTop: msg.content ? '8px' : '0' 
                              }}
                            >
                              <FileText size={24} style={{ color: 'var(--accent-indigo)' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {msg.content || 'Attached File'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {msg.fileType.split('/')[1]?.toUpperCase() || 'FILE'}
                                </div>
                              </div>
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'white' }}>
                                <Download size={16} />
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="msg-meta">
                          <Clock size={10} />
                          <span>{formatTime(msg.createdAt)}</span>
                          {isSentByMe && (
                            <span style={{ marginLeft: '4px', color: isRead ? 'var(--accent-green)' : 'var(--text-muted)' }} title={isRead ? 'Read' : 'Delivered'}>
                              {isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Room Typing Indicators */}
              {typingUsers[activeChat._id] && 
                Object.entries(typingUsers[activeChat._id]).map(([typerId, isTyping]) => {
                  if (!isTyping || typerId === user?._id) return null;
                  const typingUser = activeChat.users.find(u => u._id === typerId);
                  
                  return (
                    <div key={typerId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {typingUser ? typingUser.username : 'Someone'} is typing
                      </span>
                      <div className="typing-indicator" style={{ padding: '6px 10px', marginLeft: '0', marginBottom: '0' }}>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                    </div>
                  );
                })
              }

              <div ref={messageEndRef} />
            </div>

            {/* Input area */}
            <div className="chat-input-area">
              {uploading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', background: 'rgba(0,0,0,0.1)', padding: '6px 12px', borderRadius: '6px' }}>
                  <RefreshCw size={14} className="avatar-refresh-btn" style={{ animation: 'spin 1.5s infinite linear' }} />
                  <span>{uploadProgress}</span>
                </div>
              )}
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                {/* Paperclip attachment triggers input selection */}
                <input 
                  type="file" 
                  style={{ display: 'none' }} 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                />
                <button 
                  type="button" 
                  className="icon-btn" 
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload image, video or attachment"
                  disabled={uploading}
                >
                  <Paperclip size={18} />
                </button>

                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Write a message..."
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
            <h3 className="chat-empty-title">Select a Conversation</h3>
            <p>Choose an online room or search contacts in the sidebar list to chat in real time.</p>
          </div>
        )}
      </div>

      {/* Create Group Chat Modal */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-container" style={{ background: 'var(--bg-secondary)', maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Group Chat</h3>
              <button className="icon-btn" onClick={() => setShowGroupModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit}>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto', textAlign: 'left' }}>
                {groupError && (
                  <div className="alert-error" style={{ marginBottom: '10px' }}>
                    <AlertCircle size={18} />
                    <span>{groupError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Group Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{ paddingLeft: '14px' }}
                    placeholder="Enter group name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Select Members (At least 2)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {users.filter(u => u._id !== user?._id).map((u) => (
                      <label 
                        key={u._id} 
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedGroupUsers.includes(u._id)}
                          onChange={() => handleToggleGroupUser(u._id)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <img src={u.avatar} alt={u.username} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>{u.username}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
