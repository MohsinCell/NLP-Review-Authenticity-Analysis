# ReviewIQ | Review Authenticity Analysis

<div align="center">

![ReviewIQ](https://img.shields.io/badge/ReviewIQ-Review%20Authenticity-6C5CE7?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik05IDExbDMgM0wxNSA4Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=)

**An NLP-powered platform for detecting fake, AI-generated, and inauthentic product reviews**

Analyze individual reviews or scrape entire product pages across major e-commerce platforms - powered by fine-tuned transformer models.

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-6DB33F?style=flat-square&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.2-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

[Live Demo](https://reviewiq.website) · [Architecture](#architecture) · [Chrome Extension](#chrome-extension) · [ML Models](#ml-models) · [Getting Started](#getting-started) · [API Reference](#api-reference)

</div>

---

## Overview

ReviewIQ is a full-stack review authenticity analysis platform that combines multiple fine-tuned NLP transformer models to determine whether product reviews are genuine, AI-generated, or manipulated. It provides real-time analysis for individual reviews and batch analysis for entire product pages scraped directly from e-commerce websites.

The system employs a **multi-model fusion approach** - combining sentiment analysis, star rating prediction, and AI-generated text detection into a unified authenticity score. Product-level trust reports go further with statistical anomaly detection, duplicate review identification, and review pattern analysis.

**Live at [https://reviewiq.website](https://reviewiq.website)**

## Features

### Review Analysis
- **Sentiment Classification** - Fine-tuned BERT model classifies reviews as positive, negative, or neutral with confidence scores
- **Star Rating Prediction** - Predicts the expected 1-5 star rating from review text alone, detecting rating-sentiment mismatches
- **AI-Generated Detection** - Fine-tuned RoBERTa model identifies machine-generated review text with probability scores
- **Authenticity Scoring** - Composite 0-100 score derived from all model outputs
- **Language Detection** - Automatic language identification with translation support via LibreTranslate
- **Keyword Extraction** - KeyBERT-powered keyphrase extraction highlighting the most important terms
- **Red Flag Detection** - Identifies suspicious patterns: promotional language, repetition, vague claims, incentivized indicators

### Product Analysis
- **Automated Web Scraping** - Scrape reviews directly from product URLs across 5 major platforms (10+ regional domains)
- **Batch ML Inference** - Analyze hundreds of reviews through the ML pipeline in a single run
- **Trust Report Generation** - Comprehensive product-level report including:
  - Review burst detection (temporal clustering)
  - Rating distribution anomaly analysis
  - Duplicate/near-duplicate review identification (TF-IDF cosine similarity)
  - Review length uniformity scoring
  - Phrase repetition detection across reviews
  - Rating-sentiment mismatch analysis
- **Interactive Visualizations** - Gauge charts, sentiment pie charts, rating distribution bars, and per-review drill-down

### Platform & Security
- **JWT Authentication** - Access + refresh token flow with automatic rotation
- **Role-Based Access Control** - USER and ADMIN roles with granular permissions
- **Rate Limiting** - Token-bucket algorithm via Bucket4j + Redis (20/min anonymous, 60/min authenticated)
- **Account Protection** - Progressive lockout, OTP verification, SVG CAPTCHA
- **AES-256-GCM Encryption** - All stored review text and URLs encrypted at rest
- **Admin Dashboard** - User management, analytics metrics, contact messages, cookie management
- **Analysis History** - Authenticated users get full history with search and re-analysis
- **Responsive Design** - Optimized for desktop, tablet, and mobile viewports

### Chrome Extension
- **Browser Integration** - Analyze reviews directly from any supported e-commerce product page without leaving the site
- **One-Click Analysis** - Click the extension icon on any supported product page to trigger a full review analysis
- **Real-Time Status** - Live progress tracking as reviews are scraped and analyzed
- **Detailed Reports** - View the complete analysis report on the ReviewIQ website with a single click
- **5 Platform Support** - Works on Amazon, Flipkart, Myntra, Ajio, and Nykaa product pages

## Architecture

ReviewIQ follows a microservices architecture with four independently deployable services:

```
                                    ┌─────────────────────┐
                                    │     Nginx (443)      │
                                    │  SSL + Reverse Proxy │
                                    └──────┬──────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
          ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
          │  React Frontend │   │  Spring Boot API  │   │   Flask Scraper  │
          │   (Static/CDN)  │   │    (Port 8080)    │   │   (Port 5000)   │
          │                 │   │                   │   │                 │
          │  - React 19     │   │  - Java 21        │   │  - Playwright   │
          │  - TypeScript   │   │  - JWT + RBAC     │   │  - httpx        │
          │  - Tailwind 4   │   │  - Rate Limiting  │   │  - 5 Platforms  │
          │  - Framer Motion│   │  - Redis Cache    │   │  - Stealth Mode │
          │  - Recharts     │   │  - Actuator       │   │  - Cookie Mgmt  │
          └─────────────────┘   └───────┬───────────┘   └─────────────────┘
                                        │
                                        ▼
                                ┌──────────────────┐
                                │  Flask ML Service │
                                │   (Port 5001)    │
                                │                  │
                                │  - 3 Transformer │
                                │    Models        │
                                │  - KeyBERT       │
                                │  - Trust Reports │
                                └───────┬──────────┘
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                    ┌──────────────┐     ┌──────────────┐
                    │ PostgreSQL 16│     │   Redis 7    │
                    │   (5432)     │     │   (6379)     │
                    └──────────────┘     └──────────────┘
```

### Service Communication

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Frontend | Backend | HTTPS REST | All user-facing API calls |
| Frontend | Scraper (via Nginx) | HTTPS REST | Scrape initiation, status polling |
| Backend | ML Service | HTTP REST | Inference, keywords, red flags, trust reports |
| Backend | Scraper | HTTP REST | Server-side scrape orchestration |
| Backend | PostgreSQL | JDBC | Persistent data storage |
| Backend | Redis | Lettuce | Rate limiting, token blacklisting, caching |

## ML Models

### Model Architecture

ReviewIQ uses three independently fine-tuned transformer models that operate in parallel:

| Model | Base Architecture | Task | Output | Training Data |
|-------|------------------|------|--------|---------------|
| **Sentiment Analyzer** | BERT (custom, 6-layer) | Ternary classification | positive / negative / neutral + confidence | Product review corpora |
| **Rating Predictor** | BERT (6-layer) | 5-class classification | Predicted 1-5 star rating | Rating-labeled review datasets |
| **AI-Generated Detector** | RoBERTa (base) | Binary classification | AI probability (0.0 - 1.0) | Human + AI-generated text pairs |

### Inference Pipeline

```
                    Input Review Text
                           │
                           ▼
                  ┌─────────────────┐
                  │  Preprocessing  │
                  │  & Tokenization │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐ ┌─────────┐ ┌──────────────┐
     │  Sentiment   │ │ Rating  │ │ AI-Generated  │
     │  BERT Model  │ │  BERT   │ │ RoBERTa Model │
     └──────┬───────┘ └────┬────┘ └──────┬────────┘
            │              │             │
            ▼              ▼             ▼
     ┌──────────────────────────────────────────┐
     │           Fusion & Scoring               │
     │                                          │
     │  Authenticity Score = f(sentiment,       │
     │    predicted_rating, ai_probability,     │
     │    confidence, language)                 │
     └──────────────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │   Analysis Result    │
              │                      │
              │  - Sentiment + conf  │
              │  - Predicted rating  │
              │  - AI probability    │
              │  - Authenticity 0-100│
              │  - Language detected │
              └──────────────────────┘
```

### Supporting NLP Features

- **KeyBERT** - Uses `all-MiniLM-L6-v2` sentence embeddings to extract the most relevant keyphrases from review text
- **Red Flag Engine** - Pattern-based detection of suspicious review characteristics (promotional language, vague superlatives, incentivized phrasing, excessive repetition)
- **Trust Report Engine** - Statistical batch analysis including:
  - Temporal burst detection via review timestamp clustering
  - Rating distribution analysis against expected statistical patterns
  - Near-duplicate detection using TF-IDF vectorization + cosine similarity (0.85 threshold)
  - Length uniformity scoring across the review corpus
  - Cross-review phrase frequency analysis

## Supported E-Commerce Platforms

| Platform | Domains | Scraping Method |
|----------|---------|-----------------|
| **Amazon** | `.in`, `.com`, `.co.uk`, `.de`, `.fr`, `.es`, `.it`, `.ca`, `.com.au`, `.co.jp` | API-first with HTML fallback |
| **Flipkart** | `flipkart.com` | API-first with Playwright fallback |
| **Myntra** | `myntra.com` | Playwright (JavaScript rendering) |
| **Ajio** | `ajio.com` | API + Playwright hybrid |
| **Nykaa** | `nykaa.com`, `nykaafashion.com` | API with HTML fallback |

### Scraper Capabilities

- **Two-Phase Extraction** - Attempts lightweight HTTP/API scraping first, falls back to full Playwright browser rendering
- **Stealth Suite** - 11 anti-detection scripts (WebDriver property masking, WebGL fingerprint spoofing, navigator overrides, user-agent rotation pool of 10+)
- **Cookie Management** - Per-site cookie persistence with automatic refresh (30-min cycle), proactive pre-expiry refresh, Netscape/JSON import/export
- **Compliance** - `robots.txt` checking, configurable rate limiting with randomized delays, exponential backoff retry
- **Deduplication** - Review ID + text fingerprint (normalized first 150 chars) + rating composite key

## Getting Started

### Prerequisites

- **Java 21** (OpenJDK recommended)
- **Node.js 20+** with npm
- **Python 3.10+**
- **PostgreSQL 16**
- **Redis 7**
- **Maven 3.9+**

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=review_analyzer
DB_USERNAME=postgres
DB_PASSWORD=your_db_password

# Security (CHANGE THESE IN PRODUCTION)
JWT_SECRET=your_jwt_secret_at_least_256_bits_long
ENCRYPTION_KEY=your_32_character_aes256_key_here

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (optional - for OTP verification)
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password

# Resend (optional - for transactional emails)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=ReviewIQ <noreply@yourdomain.com>
```

Create a `.env` file in the `ml-service/` directory:

```bash
ML_SERVICE_PORT=5001
```

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/MohsinCell/NLP-Review-Authenticity-Analysis.git
cd NLP-Review-Authenticity-Analysis

# Start PostgreSQL, Redis, and LibreTranslate
docker compose -f config/docker-compose.yml up -d

# Verify services are running
docker compose -f config/docker-compose.yml ps
```

### Development Setup

**1. Database**

```bash
# Create the database (if not using Docker)
sudo -u postgres createdb review_analyzer

# Migrations run automatically via Flyway on first backend start
```

**2. Backend (Spring Boot)**

```bash
cd backend

# Build and run
mvn clean package -DskipTests
java -jar target/review-authenticity-analyzer-1.0.0.jar

# Or run in development mode
mvn spring-boot:run
```

The backend API will be available at `http://localhost:8080/api/v1`.

**3. ML Service (Flask + PyTorch)**

```bash
cd ml-service

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# Install dependencies
pip install flask gunicorn torch transformers keybert scikit-learn numpy pandas sentence-transformers

# Start the service
python ml_service.py
```

The ML service will load all three models and serve at `http://localhost:5001`.

**4. Web Scraper (Flask + Playwright)**

```bash
cd web-scraper

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Start the service
python -m review_scraper.web.app
```

The scraper will serve at `http://localhost:5000`.

**5. Frontend (React + Vite)**

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:5173
```

### Production Build

```bash
# Build frontend for production
cd frontend && npm run build

# Build backend JAR
cd backend && mvn clean package -DskipTests

# Production artifacts:
#   frontend/dist/          -> Serve via Nginx
#   backend/target/*.jar    -> Run with java -jar
```

### Production Deployment

The `deploy/` directory contains deployment scripts for different environments:

| Script | Environment | Description |
|--------|-------------|-------------|
| `deploy-full.sh` | Fresh Ubuntu server | Complete setup: Java, Node, PostgreSQL, Redis, Nginx SSL, systemd services |
| `deploy.sh` | Existing server | Incremental deployment: copy files, rebuild, restart services |
| `deploy.ps1` | Windows (PuTTY) | Windows-native deployment via PuTTY/plink |

```bash
# Full deployment to a fresh server (requires env vars to be set)
export MAIL_USERNAME=...
export MAIL_PASSWORD=...

bash deploy/deploy-full.sh
```

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/signup` | Register a new account |
| `POST` | `/api/v1/auth/login` | Authenticate and receive JWT tokens |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token |
| `POST` | `/api/v1/auth/verify-otp` | Verify email OTP |
| `POST` | `/api/v1/auth/resend-otp` | Resend OTP email |
| `POST` | `/api/v1/auth/change-password` | Change account password |

### Review Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/reviews/analyze` | Analyze a single review text |
| `GET` | `/api/v1/reviews/history` | Get analysis history (authenticated) |
| `POST` | `/api/v1/reviews/save-link-analysis` | Save product analysis results |
| `GET` | `/api/v1/reviews/link-history` | Get product analysis history |

### ML Service (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ml/analyze` | Run full ML inference pipeline |
| `POST` | `/ml/extract-keywords` | Extract keyphrases via KeyBERT |
| `POST` | `/ml/detect-red-flags` | Detect suspicious review patterns |
| `POST` | `/ml/product-trust-report` | Generate product trust report |
| `GET` | `/health` | Service health check |

### Scraper

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scrape` | Start a new scrape job |
| `GET` | `/api/status/<job_id>` | Poll scrape job status and results |
| `GET` | `/api/health` | Service health + cookie store status |
| `GET` | `/api/cookies/status` | Cookie freshness per domain |
| `POST` | `/api/cookies/import` | Import cookies (Netscape/JSON) |
| `GET` | `/api/cookies/export/<site>` | Export cookies for a domain |

### User & Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users/profile` | Get current user profile |
| `PUT` | `/api/v1/users/profile` | Update profile |
| `GET` | `/api/v1/admin/users` | List all users (admin) |
| `PUT` | `/api/v1/admin/users/{id}/role` | Change user role (admin) |
| `GET` | `/api/v1/admin/analytics` | Platform analytics (admin) |
| `GET` | `/api/v1/admin/contact-messages` | Contact submissions (admin) |

## Database Schema

```
┌─────────────────────┐     ┌──────────────────────┐
│       users          │     │   refresh_tokens     │
├─────────────────────┤     ├──────────────────────┤
│ id (UUID, PK)       │──┐  │ id (UUID, PK)        │
│ email (UNIQUE)      │  │  │ token_hash (UNIQUE)  │
│ full_name           │  ├──│ user_id (FK)         │
│ password_hash       │  │  │ expires_at           │
│ role (USER/ADMIN)   │  │  │ revoked              │
│ enabled             │  │  │ issued_from_ip       │
│ account_locked      │  │  │ user_agent           │
│ failed_login_attempts│ │  │ created_at           │
│ lock_expires_at     │  │  └──────────────────────┘
│ created_at          │  │
│ updated_at          │  │  ┌──────────────────────┐
└─────────────────────┘  │  │  review_analyses     │
                         │  ├──────────────────────┤
                         │  │ id (UUID, PK)        │
                         ├──│ user_id (FK)         │
                         │  │ encrypted_review_text│
                         │  │ sentiment            │
                         │  │ predicted_rating     │
                         │  │ ai_generated_prob    │
                         │  │ authenticity_score   │
                         │  │ confidence           │
                         │  │ detected_language    │
                         │  │ created_at           │
                         │  └──────────────────────┘
                         │
                         │  ┌──────────────────────┐
                         │  │   link_analyses      │
                         │  ├──────────────────────┤
                         │  │ id (UUID, PK)        │
                         ├──│ user_id (FK)         │
                         │  │ encrypted_product_url│
                         │  │ domain               │
                         │  │ total_reviews_analyzed│
                         │  │ positive_percentage  │
                         │  │ negative_percentage  │
                         │  │ neutral_percentage   │
                         │  │ avg_predicted_rating │
                         │  │ ai_generated_pct     │
                         │  │ languages_detected   │
                         │  │ created_at           │
                         │  └──────────────────────┘
                         │
                         │  ┌──────────────────────┐
                         │  │  analysis_metrics    │
                         │  ├──────────────────────┤
                         │  │ id (UUID, PK)        │
                         └──│ user_id (nullable)   │
                            │ analysis_type        │
                            │ authenticated        │
                            │ detected_language    │
                            │ domain               │
                            │ created_at           │
                            └──────────────────────┘

┌──────────────────────┐    ┌──────────────────────┐
│    site_visits       │    │  contact_messages    │
├──────────────────────┤    ├──────────────────────┤
│ id (UUID, PK)        │    │ id (UUID, PK)        │
│ endpoint             │    │ name                 │
│ http_method          │    │ email                │
│ authenticated        │    │ subject              │
│ ip_address           │    │ message              │
│ user_agent           │    │ read                 │
│ user_id (nullable)   │    │ created_at           │
│ response_status      │    └──────────────────────┘
│ response_time_ms     │
│ created_at           │
└──────────────────────┘
```

All review text and product URLs are **encrypted at rest** using AES-256-GCM before storage.

## Project Structure

```
NLP-Review-Authenticity-Analysis/
│
├── backend/                            # Spring Boot API (Java 21)
│   ├── src/main/java/com/nlpreview/analyzer/
│   │   ├── config/                     # App config, security, Redis, rate limiting
│   │   ├── controller/                 # REST controllers (7 controllers)
│   │   ├── dto/                        # Request/response DTOs
│   │   ├── entity/                     # JPA entities
│   │   ├── exception/                  # Custom exceptions + global handler
│   │   ├── filter/                     # JWT auth filter, rate limit filter, visit logging
│   │   ├── integration/                # ML service & scraper REST clients
│   │   ├── repository/                 # Spring Data JPA repositories
│   │   ├── security/                   # JWT provider, UserPrincipal, auth entry point
│   │   ├── service/                    # Business logic (13 services)
│   │   └── util/                       # Encryption, language detection, helpers
│   ├── src/main/resources/
│   │   ├── application.yml             # Application configuration
│   │   ├── logback-spring.xml          # Logging configuration
│   │   └── db/migration/              # Flyway SQL migrations (V1-V4)
│   └── pom.xml
│
├── frontend/                           # React SPA (TypeScript)
│   ├── src/
│   │   ├── components/                 # Reusable UI components
│   │   │   ├── ui/                     # Button, Card, Modal, Badge, ProgressBar, etc.
│   │   │   ├── charts/                 # GaugeChart, SentimentPieChart, RatingBarChart
│   │   │   ├── layout/                 # Navbar, Footer, ProtectedRoute
│   │   │   └── SvgCaptcha.tsx          # Client-side SVG CAPTCHA
│   │   ├── pages/
│   │   │   ├── analysis/               # AnalyzeReviewPage, ProductAnalysisPage
│   │   │   ├── auth/                   # LoginPage, SignupPage
│   │   │   ├── admin/                  # Dashboard, Users, ContactMessages, Cookies
│   │   │   └── ...                     # Home, Models, Contact, Profile, History,
│   │   │                               # FAQ, Privacy, ChromeExtension, 404
│   │   ├── services/                   # Axios API modules (auth, reviews, scraper, admin)
│   │   ├── context/                    # AuthContext (JWT state management)
│   │   ├── hooks/                      # Custom React hooks
│   │   ├── lib/                        # Utility functions
│   │   └── types/                      # TypeScript type definitions
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── chrome-extension/                   # Chrome Extension (Manifest V3)
│   ├── manifest.json                   # Extension manifest with permissions
│   ├── popup.html                      # Extension popup UI
│   ├── popup.js                        # Popup logic (status polling, progress tracking)
│   ├── background.js                   # Service worker (onInstalled listener)
│   ├── content.js                      # Content script (URL detection, scrape triggers)
│   ├── report.js                       # Report page integration
│   ├── report.html                     # Report display page
│   └── icons/                          # Extension icons (16, 48, 128px)
│
├── ml-service/                         # ML Inference Service (Python)
│   ├── ml_service.py                   # Flask app with all ML endpoints
│   └── models/
│       ├── sentiment/                  # Fine-tuned BERT sentiment model
│       ├── rating/                     # Fine-tuned BERT rating predictor
│       └── ai-generated/              # Fine-tuned RoBERTa AI detector
│
├── web-scraper/                        # Web Scraping Service (Python)
│   ├── review_scraper/
│   │   ├── web/
│   │   │   └── app.py                  # Flask app (scrape, status, cookies, health)
│   │   ├── core/
│   │   │   ├── scraper_manager.py      # Job orchestration + platform routing
│   │   │   └── base_scraper.py         # Abstract scraper base class
│   │   ├── scrapers/
│   │   │   ├── amazon_scraper.py       # Amazon (10 regional domains)
│   │   │   ├── flipkart_scraper.py     # Flipkart
│   │   │   ├── myntra_scraper.py       # Myntra
│   │   │   ├── ajio_scraper.py         # Ajio
│   │   │   └── nykaa_scraper.py        # Nykaa
│   │   ├── cookies/                    # Per-site cookie management
│   │   ├── stealth/                    # Anti-detection scripts (11 modules)
│   │   └── utils/                      # Helpers, compliance, deduplication
│   └── requirements.txt
│
├── config/
│   ├── docker-compose.yml              # PostgreSQL, Redis, LibreTranslate
│   ├── nginx.conf                      # Production Nginx (SSL, reverse proxy)
│   └── update_admin.sql                # Admin user setup
│
├── deploy/
│   ├── deploy-full.sh                  # Full Ubuntu server provisioning
│   ├── deploy.sh                       # Incremental deployment (Linux/Mac)
│   └── deploy.ps1                      # Windows deployment (PuTTY)
│
├── tests/                              # Development & testing utilities
│   ├── scraper/                        # Platform-specific scraper tests
│   ├── debug/                          # Debug & diagnostic scripts
│   └── data/                           # Test data files
│
└── README.md
```

## Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Java | 21 | Runtime |
| Spring Boot | 3.3.5 | Application framework |
| Spring Security | 6.x | Authentication & authorization |
| Spring Data JPA | 3.x | Database ORM |
| JJWT | 0.12.6 | JWT token generation & validation |
| Bucket4j | 8.10.1 | Rate limiting |
| MapStruct | 1.6.3 | DTO mapping |
| Flyway | 10.x | Database migrations |
| HikariCP | 5.x | Connection pooling |
| Micrometer | 1.x | Metrics + Prometheus export |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.3 | Build tool & dev server |
| Tailwind CSS | 4.2 | Utility-first styling |
| Framer Motion | 12.x | Animations |
| Recharts | 3.8 | Data visualization |
| Axios | 1.13 | HTTP client |
| React Router | 7.13 | Client-side routing |
| Headless UI | 2.x | Accessible UI primitives |

### ML Service
| Technology | Purpose |
|-----------|---------|
| PyTorch | Deep learning framework |
| HuggingFace Transformers | Pre-trained model loading & inference |
| KeyBERT | Keyword/keyphrase extraction |
| scikit-learn | TF-IDF vectorization, cosine similarity |
| Flask | REST API framework |
| sentence-transformers | Sentence embeddings (MiniLM) |

### Web Scraper
| Technology | Purpose |
|-----------|---------|
| Playwright | Browser automation & JS rendering |
| httpx | Async HTTP client |
| BeautifulSoup | HTML parsing |
| Flask | REST API framework |

### Infrastructure
| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Primary database |
| Redis | 7 | Rate limiting, caching, token blacklisting |
| Nginx | Latest | Reverse proxy, SSL termination, static files |
| LibreTranslate | Latest | Open-source machine translation |
| systemd | -- | Process management |
| Let's Encrypt | -- | SSL certificates |

## Monitoring

ReviewIQ exposes production monitoring via Spring Boot Actuator:

| Endpoint | Access | Description |
|----------|--------|-------------|
| `/api/v1/actuator/health` | Public | Application health status |
| `/api/v1/actuator/info` | Public | Application metadata |
| `/api/v1/actuator/metrics` | Authorized | JVM, HTTP, and custom metrics |
| `/api/v1/actuator/prometheus` | Authorized | Prometheus-format metrics export |

Logging is configured with four output channels:
- **Console** - Standard output with thread and trace ID
- **Rolling File** - `logs/review-analyzer.log` (50MB rotation, 30-day retention, 1GB cap)
- **JSON File** - `logs/review-analyzer-json.log` (structured logging for log aggregation)
- **Security Audit** - `logs/security-audit.log` (authentication events, 90-day retention)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Acknowledgments

- [HuggingFace](https://huggingface.co/) for pre-trained transformer model architectures
- [KeyBERT](https://github.com/MaartenGr/KeyBERT) for keyword extraction
- [Playwright](https://playwright.dev/) for reliable browser automation
- [Spring Boot](https://spring.io/projects/spring-boot) for the production-grade application framework
- [LibreTranslate](https://libretranslate.com/) for open-source machine translation

---

<div align="center">

**Built for authenticity in the age of AI-generated content**

[Back to top](#reviewiq--review-authenticity-analysis)

</div>
