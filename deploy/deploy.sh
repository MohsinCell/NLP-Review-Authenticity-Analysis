#!/bin/bash
# =============================================================================
# Deployment Script for NLP Review Authenticity Analysis
# Target: Fresh Ubuntu VPS (set DEPLOY_SERVER_IP before running)
# =============================================================================

SERVER="${DEPLOY_SERVER:-root@YOUR_SERVER_IP}"
SERVER_IP="${DEPLOY_SERVER_IP:-YOUR_SERVER_IP}"
REMOTE_PATH="/root/NLP-Review-Authenticity-Analysis"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== NLP Review Authenticity Analysis - Full Deployment ===${NC}"
echo -e "Target server: ${YELLOW}${SERVER_IP}${NC}"
echo ""

# ─── Validate required environment variables ────────────────────────────────
MISSING_VARS=()
[ -z "$MAIL_USERNAME" ] && MISSING_VARS+=("MAIL_USERNAME")
[ -z "$MAIL_PASSWORD" ] && MISSING_VARS+=("MAIL_PASSWORD")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}Error: Required environment variables are not set:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "  ${YELLOW}$var${NC}"
    done
    echo ""
    echo "Set them before running this script, e.g.:"
    echo "  export MAIL_USERNAME=your-email@gmail.com"
    echo "  export MAIL_PASSWORD=your-app-password"
    exit 1
fi

# ─── Step 1: Install all dependencies on the server ─────────────────────────
echo -e "${YELLOW}Step 1: Installing system dependencies on server...${NC}"
ssh $SERVER 'bash -s' << 'REMOTE_SETUP'
set -e
export DEBIAN_FRONTEND=noninteractive

echo ">>> Updating package lists..."
apt-get update -qq

echo ">>> Installing essential packages..."
apt-get install -y -qq curl wget git unzip nginx software-properties-common \
    build-essential python3 python3-pip python3-venv openjdk-21-jdk maven \
    postgresql postgresql-contrib redis-server

echo ">>> Installing Node.js 20.x..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "Java: $(java --version 2>&1 | head -1)"
echo "Python: $(python3 --version)"
echo "Maven: $(mvn --version 2>&1 | head -1)"

echo ">>> Starting PostgreSQL and Redis..."
systemctl enable postgresql redis-server
systemctl start postgresql redis-server

echo ">>> Setting up PostgreSQL database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1 || sudo -u postgres createuser -s postgres
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '\${DB_PASSWORD:-postgres}';" 2>/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='review_analyzer'" | grep -q 1 || sudo -u postgres createdb -O postgres review_analyzer

echo ">>> System dependencies installed successfully!"
REMOTE_SETUP

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install system dependencies!${NC}"
    exit 1
fi

# ─── Step 2: Create project directory and copy files ─────────────────────────
echo -e "${YELLOW}Step 2: Creating project directory...${NC}"
ssh $SERVER "mkdir -p $REMOTE_PATH $REMOTE_PATH/ml-service $REMOTE_PATH/config"

echo -e "${YELLOW}Step 3: Copying backend files...${NC}"
scp -r "$PROJECT_DIR/backend/src" $SERVER:$REMOTE_PATH/backend/
scp "$PROJECT_DIR/backend/pom.xml" $SERVER:$REMOTE_PATH/backend/
scp "$PROJECT_DIR/backend/.env" $SERVER:$REMOTE_PATH/backend/

echo -e "${YELLOW}Step 4: Copying frontend files...${NC}"
scp -r "$PROJECT_DIR/frontend/src" $SERVER:$REMOTE_PATH/frontend/
scp "$PROJECT_DIR/frontend/package.json" $SERVER:$REMOTE_PATH/frontend/
scp "$PROJECT_DIR/frontend/package-lock.json" $SERVER:$REMOTE_PATH/frontend/
scp "$PROJECT_DIR/frontend/tsconfig.json" $SERVER:$REMOTE_PATH/frontend/
scp "$PROJECT_DIR/frontend/tsconfig.node.json" $SERVER:$REMOTE_PATH/frontend/ 2>/dev/null || true
scp "$PROJECT_DIR/frontend/vite.config.ts" $SERVER:$REMOTE_PATH/frontend/
scp "$PROJECT_DIR/frontend/index.html" $SERVER:$REMOTE_PATH/frontend/
scp "$PROJECT_DIR/frontend/tailwind.config.js" $SERVER:$REMOTE_PATH/frontend/ 2>/dev/null || true
scp "$PROJECT_DIR/frontend/postcss.config.js" $SERVER:$REMOTE_PATH/frontend/ 2>/dev/null || true
scp "$PROJECT_DIR/frontend/.eslintrc.cjs" $SERVER:$REMOTE_PATH/frontend/ 2>/dev/null || true

# Copy public assets if they exist
if [ -d "$PROJECT_DIR/frontend/public" ]; then
    scp -r "$PROJECT_DIR/frontend/public" $SERVER:$REMOTE_PATH/frontend/
fi

echo -e "${YELLOW}Step 5: Copying ML service...${NC}"
scp "$PROJECT_DIR/ml-service/ml_service.py" $SERVER:$REMOTE_PATH/ml-service/

echo -e "${YELLOW}Step 5b: Copying ML models (model weights)...${NC}"
# Check if models already exist on server to avoid re-uploading 1.4GB
MODELS_EXIST=$(ssh $SERVER "[ -d $REMOTE_PATH/ml-service/models/sentiment ] && [ -d $REMOTE_PATH/ml-service/models/rating ] && [ -d $REMOTE_PATH/ml-service/models/ai-generated ] && echo 'yes' || echo 'no'")

if [ "$MODELS_EXIST" = "yes" ]; then
    echo -e "${GREEN}ML models already exist on server, skipping upload.${NC}"
    echo -e "To force re-upload, delete them first: ssh $SERVER 'rm -rf $REMOTE_PATH/ml-service/models'"
else
    echo -e "Uploading ML models (~1.4GB) -- this may take a while..."
    ssh $SERVER "mkdir -p $REMOTE_PATH/ml-service/models"
    # Copy each model directory, excluding __pycache__ and non-essential files
    for model_dir in ai-generated rating sentiment; do
        echo -e "  Copying $model_dir..."
        rsync -az --exclude='__pycache__' --exclude='*.ipynb' --exclude='*.pdf' --exclude='*.png' \
            "$PROJECT_DIR/ml-service/models/$model_dir/" "$SERVER:$REMOTE_PATH/ml-service/models/$model_dir/"
    done
    echo -e "${GREEN}ML models uploaded successfully.${NC}"
fi

echo -e "${YELLOW}Step 6: Copying web scraper...${NC}"
scp -r "$PROJECT_DIR/web-scraper" $SERVER:$REMOTE_PATH/

echo -e "${YELLOW}Step 7: Copying docker-compose.yml...${NC}"
scp "$PROJECT_DIR/config/docker-compose.yml" $SERVER:$REMOTE_PATH/config/

# ─── Step 3: Build backend ───────────────────────────────────────────────────
echo -e "${YELLOW}Step 8: Building backend (Spring Boot)...${NC}"
ssh $SERVER "cd $REMOTE_PATH/backend && mvn clean package -DskipTests"

if [ $? -ne 0 ]; then
    echo -e "${RED}Backend build failed!${NC}"
    exit 1
fi

# ─── Step 4: Build frontend ─────────────────────────────────────────────────
echo -e "${YELLOW}Step 9: Building frontend (React/Vite)...${NC}"
ssh $SERVER "cd $REMOTE_PATH/frontend && npm install && npm run build"

if [ $? -ne 0 ]; then
    echo -e "${RED}Frontend build failed!${NC}"
    exit 1
fi

# ─── Step 5: Setup Python virtualenv for ML + scraper ────────────────────────
echo -e "${YELLOW}Step 10: Setting up Python services...${NC}"
ssh $SERVER 'bash -s' << REMOTE_PYTHON
set -e
cd $REMOTE_PATH

# ML Service venv
echo ">>> Setting up ML service virtualenv..."
python3 -m venv ml_venv
source ml_venv/bin/activate
pip install --upgrade pip
pip install flask gunicorn keybert torch transformers numpy pandas scikit-learn sentence-transformers
deactivate

# Scraper Service venv
echo ">>> Setting up scraper service virtualenv..."
python3 -m venv scraper_venv
source scraper_venv/bin/activate
pip install --upgrade pip
pip install -r web-scraper/requirements.txt
pip install gunicorn
deactivate

echo ">>> Python services setup complete!"
REMOTE_PYTHON

# ─── Step 5b: Create environment files on server ────────────────────────────
echo -e "${YELLOW}Step 10b: Creating environment files on server...${NC}"

# Ensure backend .env has mail credentials
ssh $SERVER "grep -q MAIL_USERNAME $REMOTE_PATH/backend/.env 2>/dev/null || cat >> $REMOTE_PATH/backend/.env << EOF
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=$MAIL_USERNAME
MAIL_PASSWORD=$MAIL_PASSWORD
EOF"

# ─── Step 6: Create systemd services ────────────────────────────────────────
echo -e "${YELLOW}Step 11: Creating systemd services...${NC}"
ssh $SERVER 'bash -s' << 'REMOTE_SERVICES'
set -e
REMOTE_PATH="/root/NLP-Review-Authenticity-Analysis"

# --- Backend Service (Spring Boot) ---
cat > /etc/systemd/system/nlp-backend.service << 'EOF'
[Unit]
Description=NLP Review Analyzer Backend (Spring Boot)
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/NLP-Review-Authenticity-Analysis/backend
EnvironmentFile=/root/NLP-Review-Authenticity-Analysis/backend/.env
ExecStart=/usr/bin/java -jar /root/NLP-Review-Authenticity-Analysis/backend/target/review-authenticity-analyzer-1.0.0.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# --- Frontend Service (serve static files via nginx, no separate service needed) ---

# --- ML Service ---
cat > /etc/systemd/system/nlp-ml.service << 'EOF'
[Unit]
Description=NLP Review Analyzer ML Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/NLP-Review-Authenticity-Analysis/ml-service
ExecStart=/root/NLP-Review-Authenticity-Analysis/ml_venv/bin/python ml_service.py
Restart=always
RestartSec=10
Environment=ML_SERVICE_PORT=5001
# Give ML service time to load models before systemd considers it stalled
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

# --- Scraper Service ---
cat > /etc/systemd/system/nlp-scraper.service << 'EOF'
[Unit]
Description=NLP Review Analyzer Web Scraper
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/NLP-Review-Authenticity-Analysis/web-scraper
ExecStart=/root/NLP-Review-Authenticity-Analysis/scraper_venv/bin/python -m review_scraper.web.app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload
systemctl enable nlp-backend nlp-ml nlp-scraper

echo ">>> Systemd services created!"
REMOTE_SERVICES

# ─── Step 7: Configure Nginx ────────────────────────────────────────────────
echo -e "${YELLOW}Step 12: Configuring Nginx...${NC}"
ssh $SERVER 'bash -s' << 'REMOTE_NGINX'
set -e
REMOTE_PATH="/root/NLP-Review-Authenticity-Analysis"

cat > /etc/nginx/sites-available/reviewiq << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend - serve built static files
    root /root/NLP-Review-Authenticity-Analysis/frontend/dist;
    index index.html;

    # API proxy to Spring Boot backend
    location /api/v1/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
        client_max_body_size 10M;
    }

    # Scraper proxy
    location /scraper/ {
        rewrite ^/scraper/(.*) /api/$1 break;
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    # SPA fallback - all other routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;
}
EOF

# Enable site and remove default
ln -sf /etc/nginx/sites-available/reviewiq /etc/nginx/sites-enabled/reviewiq
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t && systemctl restart nginx
systemctl enable nginx

echo ">>> Nginx configured!"
REMOTE_NGINX

# ─── Step 8: Start all services ─────────────────────────────────────────────
echo -e "${YELLOW}Step 13: Starting all services...${NC}"
ssh $SERVER 'bash -s' << 'REMOTE_START'
set -e

echo ">>> Starting backend..."
systemctl start nlp-backend
sleep 5

echo ">>> Starting ML service..."
systemctl start nlp-ml
sleep 5

echo ">>> Starting scraper..."
systemctl start nlp-scraper
sleep 2

echo ""
echo "=== Service Status ==="
echo "--- Backend ---"
systemctl status nlp-backend --no-pager | head -5
echo ""
echo "--- ML Service ---"
systemctl status nlp-ml --no-pager | head -5
echo ""
echo "--- Scraper ---"
systemctl status nlp-scraper --no-pager | head -5
echo ""
echo "--- Nginx ---"
systemctl status nginx --no-pager | head -5
echo ""
echo "--- PostgreSQL ---"
systemctl status postgresql --no-pager | head -5
echo ""
echo "--- Redis ---"
systemctl status redis-server --no-pager | head -5
REMOTE_START

# ─── Step 9: Health checks ─────────────────────────────────────────────────
echo -e "${YELLOW}Step 14: Running health checks...${NC}"
ssh $SERVER 'bash -s' << 'REMOTE_HEALTH'
echo ">>> Waiting for services to start..."
sleep 10

echo ""
echo "=== Health Checks ==="

# Check backend
echo -n "Backend (port 8080): "
if curl -sf http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAILED (may still be starting -- Spring Boot can take 30-60s)"
fi

# Check ML service
echo -n "ML Service (port 5001): "
ML_HEALTH=$(curl -sf http://localhost:5001/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "OK"
    echo "  Models: $ML_HEALTH"
else
    echo "FAILED -- check: journalctl -u nlp-ml -f"
fi

# Check scraper
echo -n "Scraper (port 5000): "
if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAILED -- check: journalctl -u nlp-scraper -f"
fi

# Check nginx
echo -n "Nginx (port 80): "
if curl -sf http://localhost/ > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAILED -- check: journalctl -u nginx -f"
fi
REMOTE_HEALTH

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "Frontend:  ${GREEN}http://${SERVER_IP}${NC}"
echo -e "Backend:   ${GREEN}http://${SERVER_IP}/api/v1${NC}"
echo ""
echo "Useful commands:"
echo "  ssh $SERVER 'journalctl -u nlp-backend -f'     # Backend logs"
echo "  ssh $SERVER 'journalctl -u nlp-ml -f'          # ML service logs"
echo "  ssh $SERVER 'journalctl -u nlp-scraper -f'     # Scraper logs"
echo "  ssh $SERVER 'journalctl -u nginx -f'           # Nginx logs"
