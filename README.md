# VibeChat 💬

VibeChat is a premium, real-time chat application featuring a gorgeous glassmorphic dark-theme UI. It is built using the MERN stack with native WebSockets for instant, bi-directional messaging..

## ✨ Features

- **Real-Time Messaging**: Underpinned by Socket.io, messages deliver in sub-100ms.
- **Typing Indicators & Status Tracker**: Interactive jumping dot typing animations and live online/offline contact badges.
- **Read Receipts**: Visual message status checkmarks (`✓` sent, `✓✓` read).
- **Authentication**: JWT token authentication paired with Google OAuth 2.0 redirection flow.
- **Glassmorphic UI**: Beautiful, fully-responsive dashboard constructed entirely using custom Vanilla CSS variables and micro-animations.
- **Interactive Profiles**: Custom user bio settings and dynamic, rollable robot avatars (using Dicebear API seeds).

## 🚀 Tech Stack

- **Frontend**: React.js, JavaScript, Vite, Vanilla CSS, Lucide Icons.
- **Backend**: Node.js, Express.js, Socket.io, JWT.
- **Database**: MongoDB Atlas (Mongoose ODM).
- **Cloud Deployment**: S3, CloudFront CDN, EC2, Nginx, PM2.

## 🛠️ Local Installation

### Prerequisites
Ensure you have Node.js (v18+) and Git installed.

1. **Clone the Repository**
   ```bash
   git clone <your-github-repo-url>
   cd chat-app
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the `server/` directory:
   ```ini
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/chatify
   JWT_SECRET=your_jwt_secret
   CLIENT_URL=http://localhost:5173
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
   ```

3. **Install Dependencies**
   - **Backend Server**:
     ```bash
     cd server
     npm install
     ```
   - **Frontend Client**:
     ```bash
     cd ../client
     npm install
     ```

4. **Run the Application**
   - **Start Backend**:
     ```bash
     cd server
     npm run dev
     ```
   - **Start Frontend**:
     ```bash
     cd client
     npm run dev
     ```
   Open your browser and visit: `http://localhost:5173`.

## ☁️ Deployment

For step-by-step production setup on AWS (S3, CloudFront, EC2 Nginx configurations for WS upgrades, and Let's Encrypt SSL Certbot), consult the [AWS Deployment Guide](deployment_guide.md).
