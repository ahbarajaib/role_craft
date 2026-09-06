# Deployment Guide: VPS & Vercel Hosting

This guide details how to host the **Role Craft** application in production:
* **Frontend**: Hosted serverless on **Vercel** pointing to `https://rolecraft.tech`.
* **Backend**: Dockerized and hosted on your **VPS** pointing to `https://api.rolecraft.tech` behind a host-level **Nginx** reverse proxy.
* **CI/CD**: Fully automated deploys for Vercel and VPS on git pushes to `main`.

---

## 1. VPS Host Setup (Nginx + Docker)

Log in to your VPS and install the required tools:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install docker.io docker-compose-v2 -y
sudo systemctl enable docker --now

# Install Nginx & Certbot for SSL
sudo apt install nginx certbot python3-certbot-nginx -y
```

---

## 2. Deploying the Backend API

1. **Clone the Repository**:
   ```bash
   cd /opt
   git clone https://github.com/your-username/rolecraft.git
    # If you already created /opt/role_craft, you can clone directly into it:
    # git clone https://github.com/your-username/rolecraft.git /opt/role_craft
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```bash
   nano .env
   ```
   Add the following variables:
   ```env
   OPENAI_API_KEY="your-openai-api-key"
   GOOGLE_CLIENT_ID="your-google-developer-client-id"
   JWT_SECRET="generate-a-secure-random-phrase-here"
   ```

3. **Launch the Container**:
   Build and start the container in detached background mode:
   ```bash
   docker compose up -d --build
   ```
   The SQLite database will be persistently stored at `./data/rolecraft.db` on your host machine.

---

## 3. Host Nginx Reverse Proxy Config

1. Create a server configuration for your API subdomain:
   ```bash
   sudo nano /etc/nginx/sites-available/api.rolecraft.tech
   ```

2. Paste the following configuration:
   ```nginx
   server {
       listen 80;
       server_name api.rolecraft.tech;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. Enable the config and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/api.rolecraft.tech /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. Secure the domain with a free Let's Encrypt SSL certificate:
   ```bash
   sudo certbot --nginx -d api.rolecraft.tech
   ```

---
## Just an update
## 4. Deploying the Frontend on Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com) and click **Add New Project**.
2. Connect your GitHub repository and select the **`frontend`** directory as the root folder.
3. Configure the **Environment Variables** in the Vercel panel:
   * `NEXT_PUBLIC_API_URL` = `https://api.rolecraft.tech`
   * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `your-google-developer-client-id`
4. Click **Deploy**. Vercel will automatically build and deploy the frontend on every git push to the `main` branch.
5. In your Vercel project settings, navigate to **Domains** and add your custom domain `rolecraft.tech`.

---
## Just a comment

## 5. Setting up CI/CD to VPS (Secure Webhook Redeployment)

To bypass standard SSH rate-limiting blocks and connection timeouts on public cloud subnets (like GitHub Actions runners), we use a secure local webhook deployment listener on the VPS host.

### How it works:
1. A lightweight Python webhook script listens locally on port `9000` (`/opt/role_craft/deploy_webhook.py`).
2. Nginx maps secure incoming requests at `https://api.rolecraft.tech/deploy-webhook` to the local port `9000`.
3. The script is registered as a persistent systemd service `rolecraft-deploy.service` on the host.
4. When a push to `main` occurs, the GitHub Action (`.github/workflows/deploy.yml`) calls the HTTPS endpoint securely using `curl` with a custom token header (`X-Deploy-Token`), triggering an in-background build.

### Steps to configure:
1. Create the deploy script on the VPS host at `/opt/role_craft/deploy_webhook.py`.
2. Register and start the systemd unit `/etc/systemd/system/rolecraft-deploy.service`:
   ```bash
   systemctl daemon-reload
   systemctl enable rolecraft-deploy --now
   ```
3. Update the Nginx proxy site configuration on the VPS to include:
   ```nginx
   location /deploy-webhook {
       proxy_pass http://127.0.0.1:9000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
4. Reload Nginx (`systemctl reload nginx`).
5. (Optional) Set `DEPLOY_TOKEN` as an Action secret on GitHub to override the default token.

---

## 6. Admin Dashboard Subdomain (`admin.rolecraft.tech`) Setup

The admin control panel is hosted completely isolated from normal users at `admin.rolecraft.tech`.

### 1. DNS Record
In your domain registrar / DNS manager for `rolecraft.tech`:
- Add an **`A` record**:
  - Host / Name: `admin`
  - Value: Your VPS IP address (same IP as `rolecraft.tech`)
  - TTL: Auto / 300

### 2. Environment Variable
Generate a strong secret key:
```bash
openssl rand -hex 16
```
Add to `backend/.env`:
```env
ADMIN_SECRET="your-generated-16-character-secret"
```

### 3. Web Server Reverse Proxy

**Option A: Caddy (`/etc/caddy/Caddyfile`)**
```caddy
admin.rolecraft.tech {
    header X-Robots-Tag "noindex, nofollow"
    rewrite * /xrc-control{uri}
    reverse_proxy localhost:3000
}
```
Reload Caddy: `systemctl reload caddy`

**Option B: Nginx (`/etc/nginx/sites-available/admin.rolecraft.tech`)**
```nginx
server {
    listen 80;
    server_name admin.rolecraft.tech;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        rewrite ^(.*)$ /xrc-control$1 break;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable and secure with Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/admin.rolecraft.tech /etc/nginx/sites-enabled/
sudo certbot --nginx -d admin.rolecraft.tech
sudo systemctl reload nginx
```

### 4. One-Time Superuser Bootstrap
Promote your account (`ahbarajaib@gmail.com`) to Administrator:
```bash
cd backend
source .venv/bin/activate
python scripts/bootstrap_admin.py
```



