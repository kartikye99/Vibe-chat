# VibeChat: Render Deployment Guide 🚀

[Render](https://render.com/) is a cloud developer platform that offers auto-deployments directly from GitHub, fully managed SSL, and excellent WebSockets support out-of-the-box. This guide walks you through deploying your React frontend and Node/Express backend on Render.

---

## 1. Step 1: Deploy the Backend (Express & Socket.io Web Service)

Since the backend serves API requests and keeps persistent WebSockets open, we deploy it as a **Web Service** on Render.

1. Log in to [Render](https://dashboard.render.com/).
2. Click the **New +** button in the dashboard and select **Web Service**.
3. Link your GitHub account and select your **Vibe-chat** repository.
4. Configure the Web Service settings:
   * **Name**: `vibechat-api`
   * **Language**: `Node`
   * **Branch**: `main`
   * **Root Directory**: (Leave blank)
   * **Build Command**: `cd server && npm install`
   * **Start Command**: `cd server && npm start`
   * **Instance Type**: `Free`
5. Click **Advanced** and add the following **Environment Variables**:
   * `PORT` = `10000` (Render default)
   * `MONGODB_URI` = `mongodb+srv://kartikyesaini_db_user:li5seWjVobHRhvYK@chatify.8oo2vn3.mongodb.net/chatify?retryWrites=true&w=majority`
   * `JWT_SECRET` = `super_secret_jwt_key_for_vibechat_app_development_12345`
   * `CLIENT_URL` = (Your Render Frontend URL, which we will retrieve in Step 2, e.g. `https://vibechat.onrender.com`)
   * `GOOGLE_CLIENT_ID` = `YOUR_GOOGLE_CLIENT_ID`
   * `GOOGLE_CLIENT_SECRET` = `YOUR_GOOGLE_CLIENT_SECRET`
   * `GOOGLE_CALLBACK_URL` = `https://<YOUR_RENDER_BACKEND_SUBDOMAIN>.onrender.com/auth/google/callback`
6. Click **Create Web Service**.
7. *Render will build and boot your Node backend. Once deployed, copy your backend URL (e.g., `https://vibechat-api.onrender.com`).*

---

## 2. Step 2: Deploy the Frontend (React Static Site)

The frontend is a static React application. We deploy it as a **Static Site** on Render.

1. In your Render Dashboard, click the **New +** button and select **Static Site**.
2. Select your **Vibe-chat** repository.
3. Configure the Static Site settings:
   * **Name**: `vibechat`
   * **Branch**: `main`
   * **Root Directory**: (Leave blank)
   * **Build Command**: `cd client && npm install && npm run build`
   * **Publish Directory**: `client/dist`
4. Click **Create Static Site**.
5. **Set up SPA Fallback Routing (Crucial for React Router)**:
   * Once the site is created, go to the **Redirects/Rewrites** tab in the sidebar of your Static Site.
   * Click **Add Rule**.
   * **Source**: `/*`
   * **Destination**: `/index.html`
   * **Action**: `Rewrite` (This ensures refreshing the page on routes like `/login` or `/register` doesn't throw a 404 page).
6. *Render will build and host your frontend. Copy the URL of your deployed site (e.g., `https://vibechat.onrender.com`).*

---

## 3. Step 3: Link both services

1. Go back to your **Backend Web Service** settings in the Render Dashboard.
2. Click **Environment** and update the `CLIENT_URL` variable to your actual Render Frontend URL (`https://vibechat.onrender.com`).
3. Under **Google Cloud Console** credentials, update the **Authorized Javascript Origins** to include your frontend URL and the **Authorized Redirect URIs** to point to your live backend callback endpoint:
   `https://<YOUR_RENDER_BACKEND_SUBDOMAIN>.onrender.com/auth/google/callback`
4. In your local client code, ensure that the WebSocket server URL connects directly to the live backend URL (`https://vibechat-api.onrender.com`) in production.
