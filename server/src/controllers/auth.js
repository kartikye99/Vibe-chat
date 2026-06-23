const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const sendEmail = require('../utils/sendEmail');

const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user (initiates OTP verification)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    // Check if user exists in permanent collection by email
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if user exists in permanent collection by username
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save registration payload temporarily to PendingUser collection
    await PendingUser.findOneAndDelete({ email: email.toLowerCase() });
    await PendingUser.create({
      username,
      email: email.toLowerCase(),
      password, // Stored plain text, will be hashed when permanent User is created
      otp,
      otpExpires,
    });

    // Send verification email
    const subject = 'Verify Your VibeChat Registration';
    const text = `Your 6-digit OTP code is: ${otp}. It will expire in 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #0f172a; color: #f1f5f9;">
        <h2 style="color: #8b5cf6; text-align: center;">Welcome to VibeChat</h2>
        <p style="font-size: 16px;">Hello,</p>
        <p style="font-size: 16px;">Thank you for signing up. Please verify your email by entering the 6-digit OTP code below on the registration screen:</p>
        <div style="font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; letter-spacing: 6px; color: #8b5cf6; background: rgba(139, 92, 246, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3);">${otp}</div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `;
    
    await sendEmail({ email, subject, text, html });

    res.status(200).json({
      status: 'pending',
      message: 'OTP verification code sent to email',
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Please enter credentials' });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        bio: user.bio,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Redirect to Google OAuth consent screen
// @route   GET /api/auth/google
// @access  Public
const redirectToGoogle = (req, res) => {
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'select_account',
  });
  res.redirect(authorizeUrl);
};

// @desc    Handle Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
const handleGoogleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code_provided`);
  }

  try {
    // Exchange auth code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Verify ID Token and extract payload
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { sub: googleId, email, name, picture } = payload;

    // Check if user with this googleId already exists
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user with this email already exists
      user = await User.findOne({ email });

      if (user) {
        // Link googleId to existing account
        user.googleId = googleId;
        if (!user.avatar) user.avatar = picture;
        
        // Defensive check: if existing user doesn't have a valid username (min 3 chars), generate one
        if (!user.username || user.username.length < 3) {
          let baseUsername = '';
          if (typeof name === 'string' && name.trim().length > 0) {
            baseUsername = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          }
          if (!baseUsername && typeof email === 'string') {
            baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          }
          if (!baseUsername) {
            baseUsername = 'user';
          }
          if (baseUsername.length < 3) {
            baseUsername = baseUsername.padEnd(3, '0');
          }
          let uniqueUsername = baseUsername;
          let count = 1;
          while (await User.findOne({ username: uniqueUsername })) {
            uniqueUsername = `${baseUsername}${count}`;
            count++;
          }
          user.username = uniqueUsername;
        }
        
        await user.save();
      } else {
        // Create new user. Safely generate a unique username.
        let baseUsername = '';
        if (typeof name === 'string' && name.trim().length > 0) {
          baseUsername = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        }
        
        // Fallback to email prefix if name is missing or invalid
        if (!baseUsername && typeof email === 'string') {
          baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        }
        
        // Final fallback if both are empty
        if (!baseUsername) {
          baseUsername = 'user';
        }
        
        // Ensure username meets minlength of 3 characters
        if (baseUsername.length < 3) {
          baseUsername = baseUsername.padEnd(3, '0');
        }

        let uniqueUsername = baseUsername;
        let count = 1;

        // Ensure username uniqueness
        while (await User.findOne({ username: uniqueUsername })) {
          uniqueUsername = `${baseUsername}${count}`;
          count++;
        }

        console.log('Creating Google OAuth user with details:', {
          googleId,
          email,
          name,
          generatedUsername: uniqueUsername
        });

        user = await User.create({
          username: uniqueUsername,
          email,
          googleId,
          avatar: picture || undefined,
        });
      }
    }

    // Generate JWT and redirect back to client
    const token = generateToken(user._id);
    const redirectUrl = `${process.env.CLIENT_URL}/oauth-success?token=${token}&id=${user._id}&username=${encodeURIComponent(user.username)}&avatar=${encodeURIComponent(user.avatar)}&bio=${encodeURIComponent(user.bio || '')}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      user.username = req.body.username || user.username;
      user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
      user.avatar = req.body.avatar || user.avatar;

      // Handle password change if requested
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        bio: updatedUser.bio,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP and finalize registration
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP code' });
    }

    const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });

    if (!pendingUser) {
      return res.status(400).json({ message: 'Registration session expired. Please sign up again.' });
    }

    // Verify OTP code
    if (pendingUser.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Check expiration
    if (new Date() > pendingUser.otpExpires) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Verify email/username uniqueness one final time in permanent collection
    const emailExists = await User.findOne({ email: pendingUser.email });
    if (emailExists) {
      await PendingUser.findOneAndDelete({ email: pendingUser.email });
      return res.status(400).json({ message: 'Email already registered' });
    }

    const usernameExists = await User.findOne({ username: pendingUser.username });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Create permanent user account (Pre-save hook in User model will hash password)
    const user = await User.create({
      username: pendingUser.username,
      email: pendingUser.email,
      password: pendingUser.password, // Plain text here, gets hashed by User Schema
    });

    if (user) {
      // Delete temporary PendingUser record
      await PendingUser.findOneAndDelete({ email: pendingUser.email });

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        bio: user.bio,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Failed to create user account' });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend registration OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide email address' });
    }

    const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });

    if (!pendingUser) {
      return res.status(400).json({ message: 'Registration session expired. Please sign up again.' });
    }

    // Generate new OTP code
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingUser.otp = newOtp;
    pendingUser.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes reset
    await pendingUser.save();

    // Send new verification email
    const subject = 'Verify Your VibeChat Registration';
    const text = `Your new 6-digit OTP code is: ${newOtp}. It will expire in 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #0f172a; color: #f1f5f9;">
        <h2 style="color: #8b5cf6; text-align: center;">Welcome to VibeChat</h2>
        <p style="font-size: 16px;">Hello,</p>
        <p style="font-size: 16px;">Your request for a new verification code was successful. Please enter the 6-digit OTP code below to verify your email:</p>
        <div style="font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; letter-spacing: 6px; color: #8b5cf6; background: rgba(139, 92, 246, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3);">${newOtp}</div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `;
    
    await sendEmail({ email: pendingUser.email, subject, text, html });

    res.json({ message: 'New verification OTP sent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  redirectToGoogle,
  handleGoogleCallback,
  getMe,
  updateProfile,
  verifyOTP,
  resendOTP,
};
