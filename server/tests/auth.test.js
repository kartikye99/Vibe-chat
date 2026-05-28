const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock User model instance methods & pre-hooks for testing
const mockUserSchemaMethods = {
  matchPassword: async function (enteredPassword, hashedPassword) {
    return await bcrypt.compare(enteredPassword, hashedPassword);
  },
  hashPassword: async function (password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }
};

describe('Auth Helpers & Password Encryption Unit Tests', () => {
  const plainPassword = 'superPassword123';
  let hashedPassword;

  beforeAll(async () => {
    // Generate hashed password before running tests
    hashedPassword = await mockUserSchemaMethods.hashPassword(plainPassword);
  });

  test('should successfully encrypt password using bcrypt', () => {
    expect(hashedPassword).toBeDefined();
    expect(hashedPassword).not.toBe(plainPassword);
    expect(hashedPassword.startsWith('$2a$')).toBe(true); // Blowfish cipher indicator for bcrypt
  });

  test('should return true for matching passwords', async () => {
    const isMatch = await mockUserSchemaMethods.matchPassword(plainPassword, hashedPassword);
    expect(isMatch).toBe(true);
  });

  test('should return false for incorrect passwords', async () => {
    const isMatch = await mockUserSchemaMethods.matchPassword('wrongPassword', hashedPassword);
    expect(isMatch).toBe(false);
  });

  test('should sign a valid JWT token containing the user ID', () => {
    const userId = '507f1f77bcf86cd799439011'; // Mock ObjectId
    const jwtSecret = 'test_secret_key_123';

    // Sign token
    const token = jwt.sign({ id: userId }, jwtSecret, { expiresIn: '30d' });
    expect(token).toBeDefined();

    // Verify token content
    const decoded = jwt.verify(token, jwtSecret);
    expect(decoded.id).toBe(userId);
  });
});
