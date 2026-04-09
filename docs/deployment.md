# Deployment Guide

This document covers deploying ReviewIQ to a production Ubuntu server.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Requirements](#server-requirements)
- [Environment Variables](#environment-variables)
- [Full Deployment (Fresh Server)](#full-deployment-fresh-server)
- [Incremental Deployment](#incremental-deployment)
- [Service Management](#service-management)
- [SSL / HTTPS Setup](#ssl--https-setup)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

**Local machine:**
- SSH access to the target server (key-based authentication recommended)
- Project repository cloned locally
- All environment variables set (see below)

**Target server:**
- Ubuntu 22.04+ (fresh or existing)
- Minimum 4GB RAM (ML models require ~2GB)
- 20GB+ disk space (ML model weights are ~1.4GB)
- Public IP with ports 80 and 443 open

## Server Requirements

The full deployment script (`deploy-full.sh`) installs all of the following automatically:

| Component | Version | Purpose |
|-----------|---------|---------|
| Java (OpenJDK) | 21 | Spring Boot backend |
| Node.js | 20.x | Frontend build |
| Python 3 | 3.10+ | ML service + scraper |
| PostgreSQL | 16 | Primary database |
| Redis | 7 | Rate limiting, caching |
| Maven | 3.9+ | Backend build |
| Nginx | Latest | Reverse proxy, SSL, static files |

## Environment Variables

The following environment variables **must** be set before running the deployment script:

```bash
# Required
export MAIL_USERNAME="your-email@gmail.com"
export MAIL_PASSWORD="your-gmail-app-password"

# Optional (have defaults)
export DB_PASSWORD="postgres"              # Default: postgres
export JWT_SECRET="your-256-bit-secret"    # Default: insecure placeholder
export ENCRYPTION_KEY="your-32-char-key"   # Default: insecure placeholder
```

> **Security Note**: The `JWT_SECRET` and `ENCRYPTION_KEY` defaults are intentionally insecure placeholders. Always override them in production via the backend `.env` file on the server.

### Backend `.env` File

The backend reads its configuration from `/root/NLP-Review-Authenticity-Analysis/backend/.env`:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=review_analyzer
DB_USERNAME=postgres
DB_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_jwt_secret_at_least_256_bits_long_change_this
ENCRYPTION_KEY=your_32_character_aes256_key!!

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password

# Resend (optional)
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=ReviewIQ <noreply@yourdomain.com>
RESEND_ADMIN_EMAIL=admin@yourdomain.com
```

### ML Service `.env` File

Located at `/root/NLP-Review-Authenticity-Analysis/ml-service/.env`:

```bash
ML_SERVICE_PORT=5001
```

## Full Deployment (Fresh Server)

For a completely fresh Ubuntu server:

```bash
# Set required environment variables
export MAIL_USERNAME="..."
export MAIL_PASSWORD="..."

# Run the full deployment
bash deploy/deploy-full.sh
```

This script performs the following steps:
1. Installs all system dependencies (Java, Node, Python, PostgreSQL, Redis, Nginx)
2. Creates the project directory structure on the server
3. Copies all source files (backend, frontend, ML service, scraper)
4. Uploads ML model weights (~1.4GB, skipped if already present)
5. Builds the backend (Maven) and frontend (npm)
6. Creates Python virtual environments for ML and scraper services
7. Creates `.env` files on the server with secrets
8. Sets up systemd services (nlp-backend, nlp-ml, nlp-scraper)
9. Configures Nginx reverse proxy
10. Starts all services and runs health checks

**Estimated time**: 15-30 minutes (depending on network speed for model upload).

## Incremental Deployment

For updating an existing installation:

```bash
# Linux/Mac
bash deploy/deploy.sh

# Windows (requires PuTTY)
powershell deploy/deploy.ps1
```

The incremental script:
1. Stops backend and frontend services
2. Creates a timestamped backup
3. Copies updated source files
4. Rebuilds backend and frontend
5. Restarts services
6. Verifies service status

## Service Management

All services are managed via systemd:

```bash
# View status
systemctl status nlp-backend
systemctl status nlp-ml
systemctl status nlp-scraper
systemctl status nginx
systemctl status postgresql
systemctl status redis-server

# Start/stop/restart
systemctl restart nlp-backend
systemctl restart nlp-ml
systemctl restart nlp-scraper

# View logs (live tail)
journalctl -u nlp-backend -f
journalctl -u nlp-ml -f
journalctl -u nlp-scraper -f

# View last 100 lines
journalctl -u nlp-backend -n 100 --no-pager
```

### Service Dependencies

```
postgresql, redis-server
        │
        ▼
   nlp-backend ──→ nlp-ml (port 5001)
                ──→ nlp-scraper (port 5000)
        │
        ▼
      nginx (ports 80, 443)
```

Start order: PostgreSQL/Redis → Backend → ML Service → Scraper → Nginx

## SSL / HTTPS Setup

The production Nginx configuration in `config/nginx.conf` includes SSL support via Let's Encrypt:

```bash
# Install Certbot
ssh root@your-server 'apt install -y certbot python3-certbot-nginx'

# Obtain certificate
ssh root@your-server 'certbot --nginx -d yourdomain.com'

# Auto-renewal is configured automatically by Certbot
```

The Nginx config handles:
- HTTPS redirect (80 → 443)
- Reverse proxy to backend (`:8080/api/v1/`)
- Reverse proxy to scraper (`:5000/api/` via `/scraper/` prefix)
- SPA fallback for React Router
- Gzip compression
- Static file serving from `frontend/dist/`

## Monitoring

### Health Check Endpoints

| Service | URL | Expected Response |
|---------|-----|-------------------|
| Backend | `http://localhost:8080/api/v1/actuator/health` | `{"status":"UP"}` |
| ML Service | `http://localhost:5001/health` | `{"status":"healthy","models":{...}}` |
| Scraper | `http://localhost:5000/api/health` | `{"status":"running",...}` |
| Nginx | `http://localhost/` | HTML page (200) |

### Application Logs

| Log File | Location | Purpose |
|----------|----------|---------|
| Application | `logs/review-analyzer.log` | Main application log |
| JSON (structured) | `logs/review-analyzer-json.log` | For log aggregation tools |
| Security audit | `logs/security-audit.log` | Authentication events |

### Prometheus Metrics

The backend exposes Prometheus-format metrics at `/api/v1/actuator/prometheus` (requires authentication).

## Troubleshooting

### Backend won't start

```bash
# Check Java version
java --version   # Should be 21+

# Check if port 8080 is in use
ss -tlnp | grep 8080

# Check database connectivity
sudo -u postgres psql -d review_analyzer -c "SELECT 1"

# Check backend logs
journalctl -u nlp-backend -n 200 --no-pager
```

### ML Service won't start

```bash
# ML service takes 1-5 minutes to load models
# Check if models exist
ls -la /root/NLP-Review-Authenticity-Analysis/ml-service/models/*/

# Check Python dependencies
source /root/NLP-Review-Authenticity-Analysis/ml_venv/bin/activate
python -c "import torch; import transformers; print('OK')"

# Check ML logs
journalctl -u nlp-ml -n 200 --no-pager
```

### Scraper won't start

```bash
# Check Playwright browsers
source /root/NLP-Review-Authenticity-Analysis/scraper_venv/bin/activate
playwright install chromium

# Check scraper logs
journalctl -u nlp-scraper -n 200 --no-pager
```

### Nginx 502 Bad Gateway

```bash
# Backend may not be running yet
systemctl status nlp-backend

# Check Nginx config
nginx -t

# Check Nginx logs
journalctl -u nginx -f
```

### Out of Memory

The ML service requires ~2GB RAM for model loading. If the server runs out of memory:

```bash
# Check memory usage
free -h

# Consider adding swap
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
