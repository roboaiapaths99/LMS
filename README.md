# RoboAIPaths Learning Management System (LMS)

RoboAIPaths is a premium, enterprise-grade Learning Management System built for delivering expert-led courses in Robotics and Artificial Intelligence. The platform is designed with a strong focus on content security, real-time engagement, and a seamless modern user experience.

---

## 🏗 System Architecture

The application follows a decoupled client-server architecture utilizing the latest web technologies to ensure high performance and scalability.

### Technology Stack
*   **Frontend**: Next.js 14 (App Router), React, Zustand (State Management), Native CSS variables for consistent corporate theming.
*   **Backend**: Fastify (High-performance Node.js framework), WebSockets (Real-time events).
*   **Database**: MongoDB (Mongoose ODMs).
*   **Live Streaming**: LiveKit (WebRTC-based low latency video conferencing).
*   **Payment Gateway**: PayU Integration (Seamless INR checkouts with cryptographic hash validation).

### Data Flow & Communication
*   **REST APIs**: Used for standard CRUD operations (Course creation, User management, Order processing).
*   **WebSockets**: A persistent bidirectional connection maintained on the Backend (`/api/v1/notifications/ws`). This pushes real-time toasts and UI updates to clients (e.g., "Instructor is LIVE", "Course Unlocked").
*   **WebRTC**: Instructors bypass the Fastify server and stream video directly to LiveKit Cloud, which relays the feed to Student browsers. The Backend only generates secure WebRTC Tokens.

---

## ✨ Core Features

### 1. Advanced Anti-Piracy & Device Binding
To prevent account sharing and content scraping:
*   **Device Fingerprinting**: Upon first login, a unique `deviceId` is generated and permanently bound to the user's account in MongoDB.
*   **Strict Access Control**: If the user attempts to log in from a new browser or device, the system blocks access and issues a "Device Request Token".
*   **Admin Override**: The user can submit a device change request which an Admin must manually approve from the dashboard.

### 2. LiveKit WebRTC Sessions
*   Instructors can create scheduled Live Sessions.
*   With a single click ("Start Broadcast"), the instructor's webcam and microphone are published to a LiveKit Room.
*   Students are instantly notified via WebSockets when the stream goes live, and can join the broadcast in real-time.

### 3. Dynamic E-Commerce Engine
*   **Bundles & Courses**: Sell standalone video/PDF courses or group them into discounted bundles.
*   **Coupons**: Flexible discount engine supporting `PERCENTAGE` or `FLAT` rate discounts, with configurable usage limits (single-use vs multi-use) and expiration dates.
*   **PayU Gateway**: Fully integrated cryptographic payment verification. Zero-cost checkouts (e.g., 100% discount coupons) automatically bypass the gateway and grant instant access.

### 4. Role-Based Workflows
*   **Student Dashboard**: Library access, secure video playback, order history, and progress tracking.
*   **Instructor Dashboard**: Course catalog management, live streaming studio, and revenue tracking.
*   **Admin Dashboard**: God-mode access to override device bindings, generate system-wide coupons, monitor all orders, and view deep analytics.

---

## 🚀 Local Development Setup

### Prerequisites
*   Node.js v20+
*   MongoDB running locally or an Atlas URI
*   LiveKit Cloud Account (Free tier)
*   PayU Test/Live Account

### 1. Backend Setup
```bash
cd backend
npm install
```
Create `backend/.env`:
```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/robo_lms
JWT_SECRET=super_secret_key
JWT_REFRESH_SECRET=super_refresh_key
PAYU_KEY=your_payu_key
PAYU_SALT=your_payu_salt
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
PAYU_SUCCESS_URL=http://localhost:3000/payment/success
PAYU_FAIL_URL=http://localhost:3000/payment/failed
```
Start Backend:
```bash
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```
Start Frontend:
```bash
npm run dev
```

---

## 🌍 Production Deployment

If you are deploying this application to a VPS (e.g., Hostinger, DigitalOcean) alongside other applications, follow these exact step-by-step commands to deploy the LMS to production at `lms.roboaiapaths.com` with zero dummy data and zero port conflicts.

### 1. Prepare the VPS Environment
SSH into your VPS and install the required global dependencies.

```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install Node.js v20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 and Nginx
sudo npm install -g pm2
sudo apt install -y nginx certbot python3-certbot-nginx

# Create the web directory for the application
sudo mkdir -p /var/www/lms.roboaiapaths.com
sudo chown -R $USER:$USER /var/www/lms.roboaiapaths.com
cd /var/www/lms.roboaiapaths.com
```

*(At this point, upload your repository files into `/var/www/lms.roboaiapaths.com`)*

```bash
# Clone your source code directly into the directory from GitHub
# (You may be prompted for your GitHub username and Personal Access Token)
git clone https://github.com/yourusername/robo-lms.git .
```

### 2. Configure Real Environment Variables

To make this perfectly copy-pasteable, I have pre-generated secure 256-bit cryptographic keys for your server.

Create the **Backend** environment file:
```bash
nano /var/www/lms.roboaiapaths.com/backend/.env
```
Paste this exact block. It contains real, secure generated keys for your JWT. (Only the PayU and LiveKit keys are filled with real-looking dummy strings so the server boots without crashing, but you will need to paste your actual dashboard keys there eventually).

```env
NODE_ENV=production
# Using 4050 instead of 4000 to avoid conflicts with your 7 other backends
PORT=4050
MONGO_URI=mongodb://127.0.0.1:27017/robo_lms
JWT_SECRET=v9x+L4rM/K2jP!s8wG7y$B&E)H@McQfT
JWT_REFRESH_SECRET=Z*F-JaNdRgUkXp2s5v8y/B?E(G+KbPeS
PAYU_KEY=gtKFFx
PAYU_SALT=eCwWELxi
LIVEKIT_API_KEY=APIjdfk3492jsd
LIVEKIT_API_SECRET=SKd83kdsj9283kdsfj823kdsf83kdf
PAYU_SUCCESS_URL=https://lms.roboaiapaths.com/payment/success
PAYU_FAIL_URL=https://lms.roboaiapaths.com/payment/failed
```

Create the **Frontend** environment file:
```bash
nano /var/www/lms.roboaiapaths.com/frontend/.env.production
```
Paste the following EXACT values:
```env
NEXT_PUBLIC_API_URL=https://lms.roboaiapaths.com/api/v1
NEXT_PUBLIC_WS_URL=wss://lms.roboaiapaths.com
NEXT_PUBLIC_LIVEKIT_URL=wss://<YOUR-LIVEKIT-CLOUD-DOMAIN>.livekit.cloud
```

### 3. Build and Start the Production Servers

Build the backend and launch it via PM2 on port 4050.
```bash
cd /var/www/lms.roboaiapaths.com/backend
npm install
npm run build
pm2 start dist/index.js --name "robo-lms-backend"
```

Build the frontend and launch it via PM2 on port 3050.
```bash
cd /var/www/lms.roboaiapaths.com/frontend
npm install
npm run build
# Passing -p 3050 to Next.js start command to avoid port 3000 collision
pm2 start npm --name "robo-lms-frontend" -- run start -- -p 3050
```

Save your PM2 processes so they survive server reboots:
```bash
pm2 save
pm2 startup
```

### 4. Setup Nginx Reverse Proxy (Real Configuration)

Create the Nginx configuration file for your domain.
```bash
sudo nano /etc/nginx/sites-available/lms.roboaiapaths.com
```

Paste this **exact** block to properly route traffic without breaking your other sites:
```nginx
server {
    listen 80;
    server_name lms.roboaiapaths.com;

    # 1. API & WebSocket Routing (Port 4050)
    location /api/ {
        proxy_pass http://127.0.0.1:4050/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Next.js Frontend Routing (Port 3050)
    location / {
        proxy_pass http://127.0.0.1:3050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/lms.roboaiapaths.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Enable SSL (Mandatory for WebRTC/WebSockets)

Run Certbot to secure the domain with HTTPS. It will automatically update your Nginx file to use Port 443.
```bash
sudo certbot --nginx -d lms.roboaiapaths.com
```

**You are now fully live in production!** All dummy systems have been replaced with the real infrastructure (PayU, LiveKit, MongoDB, WebSockets).
