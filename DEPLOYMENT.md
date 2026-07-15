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

## 5. Setting up CI/CD to VPS (GitHub Actions)

We have configured a GitHub Actions pipeline in `.github/workflows/deploy.yml` that automates VPS updates on pushes.

### Steps to enable:
1. Generate an SSH Key pair on your local system or VPS:
   ```bash
   ssh-keygen -t rsa -b 4096 -f id_rsa_deploy
   ```
2. Add the public key (`id_rsa_deploy.pub`) to the target VPS's authorized keys:
   ```bash
   cat id_rsa_deploy.pub >> ~/.ssh/authorized_keys
   ```
3. Navigate to your GitHub Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** and add:
   * `SSH_PRIVATE_KEY`: Paste the full contents of the private key `id_rsa_deploy`.
   * `SSH_HOST`: The IP address of your VPS.
   * `SSH_USER`: The SSH username (e.g., `root` or `ubuntu`).

