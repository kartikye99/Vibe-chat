const request = require('supertest');
const express = require('express');

// Set up mock express server to test routing configurations
const app = express();
app.use(express.json());

// Mock database and route controllers
const mockAuthRouter = express.Router();
mockAuthRouter.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please add all fields' });
  }
  res.status(201).json({
    _id: 'mockUserId123',
    username,
    email,
    token: 'mockJwtTokenXYZ'
  });
});

app.use('/api/auth', mockAuthRouter);

describe('Express Authentication Route Integration Tests', () => {
  test('POST /api/auth/register should create a user and return a token when credentials are valid', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'sagar',
        email: 'sagar@gmail.com',
        password: 'password123'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('_id');
    expect(response.body.username).toBe('sagar');
    expect(response.body.email).toBe('sagar@gmail.com');
    expect(response.body).toHaveProperty('token');
  });

  test('POST /api/auth/register should fail with status 400 if fields are missing', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'sagar'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Please add all fields');
  });
});
