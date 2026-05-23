# VibeChat: AWS Production Deployment & Interview Guide

This guide details how to deploy the **VibeChat** real-time application in a secure, scalable, and cost-effective production environment on Amazon Web Services (AWS). It is written to help you understand every layer of the infrastructure so you can confidently explain the design choices during your technical interviews.

---

## 1. Architectural Architecture Overview

For a modern real-time single-page application (SPA), we decouple the **static assets (frontend)** from the **dynamic API and WebSocket server (backend)**. This follows cloud-native best practices:

```
[User Browser]
      │
      ├───────► HTTPS (Static Assets) ────────► [Amazon CloudFront CDN] ──► [Amazon S3 Bucket]
      │
      └───────► WSS / HTTPS (API & Sockets) ──► [AWS Application Load Balancer] (Terminates SSL)
                                                            │
                                                     HTTP / WS Proxy
                                                            ▼
                                                   [AWS EC2 Instance]
                                                ┌──────────────────────┐
                                                │    Nginx Proxy       │
                                                │         │            │
                                                │  Node Server (PM2)   │
                                                └──────────────────────┘
                                                            │
                                                       Read / Write
                                                            ▼
                                                   [MongoDB Atlas Cloud]
```

### Key Talking Points for Interviews:
* **Separation of Concerns**: We compile the React app into static files (`dist/`) and offload them to **Amazon S3 + CloudFront**. This makes frontend delivery virtually infinite in scale, highly available, and extremely cheap, with zero CPU load on our backend servers.
* **WebSocket Persistence**: Since WebSockets require a persistent TCP handshake, they cannot run on serverless functions like AWS Lambda (which have execution limits and cannot keep sockets open). Hence, we host the backend on a dedicated virtual machine like **AWS EC2**.
* **SSL/TLS Termination**: All network traffic is encrypted. The Application Load Balancer or Nginx reverse proxy handles **SSL termination**, converting incoming HTTPS/WSS to standard HTTP/WS internally to reduce CPU load on the Node.js application process.

---

## 2. Step 1: Database Setup (MongoDB Atlas)

To prevent database overhead on your server, deploy a managed cluster:
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster in the **same AWS Region** where you plan to host your EC2 instance (e.g., `us-east-1` or `ap-south-1`). This minimizes database latency (ping times).
3. In **Network Access**, add IP address `0.0.0.0/0` (to allow access from anywhere temporarily) or restrict it to the Elastic IP of your EC2 instance once created (best practice).
4. Create a Database User and save the generated password.
5. Retrieve your connection string (format: `mongodb+srv://...`) and save it for the EC2 environment file.

---

## 3. Step 2: Backend Deployment on AWS EC2

### A. Spin Up an EC2 Instance
1. Launch an EC2 instance in the AWS Console.
   * **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible).
   * **Instance Type**: `t2.micro` or `t3.micro`.
2. **Key Pair**: Create or use an existing SSH key pair (`.pem`) to securely log in.
3. **Security Groups** (Configure Firewall):
   * Add **SSH (Port 22)**: Restrict to your IP for security.
   * Add **HTTP (Port 80)**: Allow from anywhere.
   * Add **HTTPS (Port 443)**: Allow from anywhere.

### B. Associate an Elastic IP
By default, stopping and starting an EC2 instance changes its public IP address.
1. Go to **Elastic IPs** in the EC2 Dashboard.
2. Click **Allocate Elastic IP address**.
3. Once allocated, select the IP, click **Associate**, and link it to your backend EC2 instance. This gives you a permanent IP address.

### C. Server Environment Installation
SSH into your instance via terminal:
```bash
ssh -i "your-key.pem" ubuntu@your-ec2-elastic-ip
```
Install Node.js (via NVM), Git, and Nginx:
```bash
# Update Ubuntu package index
sudo apt update && sudo apt upgrade -y

# Install Node Version Manager (NVM) and Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# Install PM2 (Process Manager) globally
npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

### D. Setup Code & Env Variables
Clone the repository or transfer files to the EC2 server:
```bash
git clone <your-git-repo-url> /var/www/vibechat
cd /var/www/vibechat/server
npm install
```
Create the `.env` production file (`nano .env`):
```ini
PORT=5000
MONGODB_URI=mongodb+srv://kartikyesaini_db_user:YOUR_DB_PASSWORD@chatify.8oo2vn3.mongodb.net/chatify?retryWrites=true&w=majority
JWT_SECRET=YOUR_SECURE_JWT_SECRET_STRING_HERE
CLIENT_URL=https://yourfrontenddomain.com

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://api.yourbackenddomain.com/auth/google/callback
```
*Note: Once you register a custom domain, replace the URLs with your domain names.*

### E. Start Application with PM2
PM2 ensures the server runs continuously in the background and restarts automatically if it crashes or the server reboots:
```bash
# Start server process
pm2 start src/server.js --name "vibechat-api"

# Configure PM2 to auto-start on server boot
pm2 startup systemd
# (Run the command outputted in the terminal by the above step, it will look like:)
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save the current list of PM2 processes
pm2 save
```

---

## 4. Step 3: Configure Nginx Reverse Proxy & SSL

Because Node.js runs internally on port 5000, we use **Nginx** on port 80 to act as a reverse proxy, translating client queries and routing standard connections alongside WebSocket handshakes.

### A. Nginx Configuration for WebSockets
Modify the default Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/default
```
Replace the content with the following configuration. This is a **critical interview snippet** showing how you enable WebSocket support:
```nginx
server {
    listen 80;
    server_name api.yourbackenddomain.com; # Or your Elastic IP if you don't have a domain yet

    location / {
        # Forward normal HTTP API requests to Node
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # Crucial headers for WebSockets upgrade handshake
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Forward original host info and IP details to Node
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Prevent timeouts on WebSocket connections (keep connection alive for 1 hour)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```
Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### B. Secure with SSL (Let's Encrypt Certbot)
To run HTTPS and secure WebSockets (WSS), configure free SSL credentials:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourbackenddomain.com
```
Certbot will auto-renew your certificates and update Nginx to route all traffic on port 80 (HTTP) to port 443 (HTTPS) automatically.

---

## 5. Step 4: Frontend Deployment (Amazon S3 + CloudFront)

### A. Build the React App
On your local machine or build runner, configure production variables. Create `client/.env.production` if needed, then compile:
```bash
cd client
npm run build
```
This generates a static `dist` folder.

### B. Host on S3
1. Open the **Amazon S3 Console** and click **Create Bucket** (name it e.g., `vibechat-app`).
2. **Object Ownership**: Set to *ACLs disabled* (recommended).
3. **Block Public Access**: Disable *Block all public access* (temporarily, so we can configure static hosting, though CloudFront OAC is the premium method to block all direct public access to S3 and force traffic through CDN only).
4. Upload all files from inside your local `client/dist/` folder directly to the root of the bucket.
5. In **Properties**, enable **Static website hosting**:
   * Index document: `index.html`
   * Error document: `index.html` (crucial for Single Page Applications using React Router).

### C. Distribute via CloudFront CDN
1. Go to the **CloudFront Console** and click **Create Distribution**.
2. **Origin Domain**: Select your S3 bucket website endpoint (use the static website hosting URL, not the S3 bucket ARN, to support React Router fallback routing).
3. **Viewer Protocol Policy**: Select *Redirect HTTP to HTTPS*.
4. **Custom SSL Certificate**: Request or associate a free SSL certificate from AWS Certificate Manager (ACM) matching your domain (`yourfrontenddomain.com`).
5. Set the **Default Root Object** to `index.html`.
6. Once deployed, point your frontend domain DNS CNAME record to the CloudFront distribution domain (`xxxx.cloudfront.net`).

---

## 6. Real-World Interview Q&A Cheatsheet

Prepare for these common technical interview questions about this architecture:

### Q1: Why did you choose WebSockets (Socket.io) instead of HTTP Polling?
> **Answer**: HTTP polling requires the client to send request messages at set intervals (e.g. every 5 seconds) to check for updates. This leads to massive overhead from HTTP header parsing and network requests, and is not truly real-time. WebSockets establish a single, bi-directional, persistent TCP connection over a single handshake, minimizing latency (sub-100ms) and saving bandwidth. Socket.io was chosen because it provides robust fallback mechanisms (HTTP long polling if WebSockets fail), auto-reconnection, and easy room partitioning.

### Q2: What Nginx configurations are required to support WebSockets?
> **Answer**: Standard HTTP connections are transient, but WebSockets require Nginx to intercept the handshake and keep the connection open. I configured Nginx to pass the `Upgrade` header as `$http_upgrade` and set the `Connection` header to `"upgrade"`. I also adjusted `proxy_read_timeout` and `proxy_send_timeout` to `3600s` (1 hour) to prevent Nginx from forcefully dropping idle socket connections.

### Q3: How does Google OAuth authentication work securely in your application?
> **Answer**: We use the OAuth 2.0 Authorization Code Flow. 
> 1. The React app redirects the browser to the backend `/api/auth/google` route.
> 2. The backend generates a secure Google OAuth URL and redirects the user's browser there.
> 3. The user consents, and Google redirects back to the backend callback endpoint with an authorization code.
> 4. The backend server exchanges this authorization code for an ID Token directly via Google's API, verifies the token's validity, finds or creates the user in MongoDB, signs our custom JWT, and redirects the browser back to the frontend with the JWT as a query param.
> This keeps our Google Client Secret hidden on the backend, which is the industry standard for security.

### Q4: How would you scale this Socket.io server to support millions of users?
> **Answer**: To scale horizontally, we would run multiple EC2 instances behind an Application Load Balancer. Since WebSockets are stateful, users on Instance A cannot message users on Instance B directly. 
> To solve this, we would introduce a **Redis Pub/Sub Adapter (Socket.io Redis Adapter)**. When a message is sent, the server publishes it to Redis, which broadcasts it to all other Socket.io instances, ensuring real-time message delivery across nodes. 
> We would also configure the load balancer with **sticky sessions** (cookie-based session affinity) so the initial Socket.io HTTP handshake hits the same server that establishes the WebSocket connection.
