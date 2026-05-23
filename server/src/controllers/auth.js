const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    // Check if user exists by email
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if user exists by username
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Create user (pre-save hook will hash password)
    const user = await User.create({
      username,
      email,
      password,
    });

    if (user) {
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
      res.status(400).json({ message: 'Invalid user data' });
    }
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

module.exports = {
  registerUser,
  loginUser,
  redirectToGoogle,
  handleGoogleCallback,
  getMe,
  updateProfile,
};
