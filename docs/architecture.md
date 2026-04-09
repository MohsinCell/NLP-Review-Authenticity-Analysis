# Architecture & Design

Technical architecture documentation for ReviewIQ.

## Table of Contents

- [System Overview](#system-overview)
- [Service Architecture](#service-architecture)
- [ML Pipeline](#ml-pipeline)
- [Security Architecture](#security-architecture)
- [Data Flow](#data-flow)
- [Database Design](#database-design)
- [Web Scraper Design](#web-scraper-design)
- [Frontend Architecture](#frontend-architecture)

---

## System Overview

ReviewIQ is a distributed system composed of four microservices, two data stores, and a reverse proxy:

```
Internet
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│  Nginx (Port 80/443)                                          │
│  - SSL termination (Let's Encrypt)                            │
│  - Reverse proxy routing                                      │
│  - Static file serving (React SPA)                            │
│  - Gzip compression                                           │
└─────────┬──────────────────┬──────────────────┬───────────────┘
          │                  │                  │
     /api/v1/*          /scraper/*           /*
          │                  │                  │
          ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────────┐
   │ Backend  │      │ Scraper  │      │ Static Files │
   │ :8080    │      │ :5000    │      │ frontend/dist│
   └────┬─────┘      └──────────┘      └──────────────┘
        │
   ┌────┴────────────────┐
   │                     │
   ▼                     ▼
┌──────────┐      ┌──────────┐
│ ML Svc   │      │ Data     │
│ :5001    │      │ Stores   │
└──────────┘      │ PG+Redis │
                  └──────────┘
```

### Design Principles

1. **Service Independence** - Each service can be developed, tested, and deployed independently
2. **Stateless API** - The backend is stateless; all session state lives in JWT tokens and Redis
3. **Defense in Depth** - Multiple security layers (Nginx, Spring Security, rate limiting, encryption at rest)
4. **Graceful Degradation** - The frontend handles ML/scraper service unavailability with user-friendly error messages
5. **Encryption by Default** - All stored review text and URLs use AES-256-GCM encryption

## Service Architecture

### Backend (Spring Boot)

The backend follows a layered architecture:

```
Controller Layer          ← HTTP request handling, validation, response mapping
        │
Service Layer             ← Business logic, orchestration, transaction management
        │
Repository Layer          ← Data access (Spring Data JPA)
        │
Entity Layer              ← JPA entities mapped to PostgreSQL tables
```

**Key packages:**

| Package | Responsibility |
|---------|---------------|
| `controller` | 7 REST controllers handling all API endpoints |
| `service` | 13 service classes (Auth, Review, Link Analysis, OTP, Email, Admin, etc.) |
| `security` | JWT filter, UserPrincipal, authentication entry point |
| `filter` | Rate limiting filter, visit logging filter |
| `integration` | HTTP clients for ML service and scraper |
| `config` | Security config, Redis config, rate limit config, CORS, app properties |
| `exception` | Custom exceptions + global exception handler |
| `util` | AES encryption utility, language detector |
| `dto` | Request/response DTOs with validation annotations |

**Cross-cutting concerns:**

- **Rate Limiting**: Token-bucket algorithm implemented via Bucket4j, backed by Redis for distributed state. Separate buckets per IP (anonymous) or user ID (authenticated).
- **Request Logging**: Every API request is logged to the `site_visits` table with endpoint, method, response status, and response time.
- **Token Cleanup**: Scheduled task revokes expired refresh tokens from the database.
- **CORS**: Configured for the production domain and localhost (development).

### ML Service (Flask)

The ML service is a Python Flask application that loads three transformer models at startup and serves inference requests.

**Startup sequence:**
1. Load sentiment model (BERT) from `models/sentiment/`
2. Load rating model (BERT) from `models/rating/`
3. Load AI-generated detector (RoBERTa) from `models/ai-generated/`
4. Initialize KeyBERT with `all-MiniLM-L6-v2`
5. Begin serving on port 5001

**Memory footprint:** ~2GB RAM for all three models loaded simultaneously.

### Web Scraper (Flask)

The scraper is a Flask application with background job execution:

```
Flask API Layer           ← Job creation, status polling, cookie management
        │
Scraper Manager           ← Job queue, platform routing, thread pool
        │
Platform Scrapers         ← Amazon, Flipkart, Myntra, Ajio, Nykaa
        │
Stealth Layer             ← Anti-detection, cookie management, UA rotation
```

Jobs run in background threads. The API provides job creation (`POST /api/scrape`) and status polling (`GET /api/status/<id>`).

## ML Pipeline

### Multi-Model Fusion

ReviewIQ combines three independent model predictions into a unified analysis:

```
                    ┌─────────────────────────────────┐
                    │        Input Review Text         │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │ Sentiment │   │  Rating   │   │ AI Detect │
              │   BERT    │   │   BERT    │   │  RoBERTa  │
              │           │   │           │   │           │
              │ 3-class:  │   │ 5-class:  │   │ Binary:   │
              │ pos/neg/  │   │ 1-5 star  │   │ human vs  │
              │ neutral   │   │ rating    │   │ AI-gen    │
              └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │       Fusion Engine           │
                    │                               │
                    │ Weighted combination of:      │
                    │ - Sentiment confidence         │
                    │ - Rating prediction accuracy   │
                    │ - AI generation probability    │
                    │ - Language detection            │
                    │                               │
                    │ → Authenticity Score (0-100)   │
                    └───────────────────────────────┘
```

### Model Details

**Sentiment Analyzer (BERT)**
- Architecture: Custom BERT with 6 transformer layers
- Tokenizer: BERT WordPiece
- Output: 3-class softmax (positive, negative, neutral) + confidence
- Max sequence length: 512 tokens

**Rating Predictor (BERT)**
- Architecture: BERT with 6 transformer layers
- Output: 5-class softmax (ratings 1-5)
- Used to detect rating-sentiment mismatches (e.g., 5-star review with negative text)

**AI-Generated Detector (RoBERTa)**
- Architecture: RoBERTa-base (12 layers, 768 hidden)
- Output: Binary sigmoid (AI probability 0.0 - 1.0)
- Threshold: >0.5 classified as AI-generated

### Batch Analysis (Trust Reports)

For product-level analysis, the trust report engine performs additional statistical analysis:

| Analysis | Method | Threshold |
|----------|--------|-----------|
| Duplicate detection | TF-IDF vectorization + cosine similarity | 0.85 |
| Review bursts | Temporal clustering of review timestamps | Configurable |
| Rating anomaly | Statistical deviation from expected distribution | Z-score based |
| Length uniformity | Standard deviation of review lengths | Normalized 0-1 |
| Phrase repetition | N-gram frequency analysis across corpus | Frequency threshold |
| Sentiment mismatch | Rating vs. predicted sentiment comparison | Direct mismatch |

## Security Architecture

### Authentication Flow

```
Client                    Backend                     Redis
  │                         │                           │
  ├── POST /auth/login ────►│                           │
  │   {email, password,     │                           │
  │    captchaToken}        │                           │
  │                         ├── Verify CAPTCHA           │
  │                         ├── Check login attempts     │
  │                         ├── BCrypt verify (12 rounds)│
  │                         ├── Generate JWT access token│
  │                         ├── Generate refresh token   │
  │                         │                           │
  │◄── {accessToken,       ─┤                           │
  │     refreshToken}       │                           │
  │                         │                           │
  ├── GET /api/resource ───►│                           │
  │   Authorization: Bearer │                           │
  │                         ├── Validate JWT signature   │
  │                         ├── Check token expiry       │
  │                         ├── Check rate limit ───────►│
  │                         │                   ◄───────┤
  │                         ├── Extract UserPrincipal    │
  │◄── {resource data}    ─┤                           │
```

### Security Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Transport | TLS 1.3 (Let's Encrypt) | Encryption in transit |
| Reverse Proxy | Nginx | DDoS protection, request filtering |
| Authentication | JWT (JJWT, HS512) | Stateless user identity |
| Authorization | Spring Security RBAC | Role-based access (USER, ADMIN) |
| Rate Limiting | Bucket4j + Redis | Abuse prevention |
| Password Storage | BCrypt (12 rounds) | One-way password hashing |
| Data at Rest | AES-256-GCM | Review text/URL encryption |
| Account Protection | Progressive lockout + OTP | Brute-force prevention |
| CAPTCHA | SVG-based (client-side) | Bot prevention at login/signup |

### Encryption at Rest

All user-submitted review text and product URLs are encrypted before database storage:

```
Plaintext Review → AES-256-GCM Encrypt → Base64 Encode → Store in PostgreSQL
                        │
                   ENCRYPTION_KEY (from .env)
                        │
Stored Ciphertext → Base64 Decode → AES-256-GCM Decrypt → Plaintext Review
```

The encryption key is loaded from the `ENCRYPTION_KEY` environment variable and never stored in the codebase.

## Data Flow

### Single Review Analysis

```
User types review text
        │
        ▼
Frontend ──POST /api/v1/reviews/analyze──► Backend
                                              │
                                   ┌──────────┴──────────┐
                                   │                     │
                                   ▼                     ▼
                           POST /ml/analyze     (If non-English)
                                   │            POST /translate
                                   │                     │
                                   ▼                     ▼
                            ML Service            LibreTranslate
                            3-model inference
                                   │
                                   ▼
                            Backend receives results
                                   │
                           ┌───────┴───────┐
                           │               │
                     (If authenticated)    │
                     Encrypt + save        │
                     to PostgreSQL         │
                           │               │
                           └───────┬───────┘
                                   │
                                   ▼
                            Return analysis
                            to frontend
```

### Product URL Analysis

```
User enters product URL
        │
        ▼
Frontend ──POST /scraper/scrape──► Scraper Service
                                        │
                                  Start background job
                                  Platform detection
                                  Cookie management
                                  Stealth scraping
                                        │
Frontend ──GET /scraper/status/<id>──► (polling every 2s)
                                        │
                                  When complete:
                                  Return scraped reviews
                                        │
        ◄───────────────────────────────┘
        │
Frontend sends reviews to Backend
        │
        ▼
Backend ──POST /ml/analyze (per review)──► ML Service
        │
Backend ──POST /ml/product-trust-report──► ML Service
        │
Backend ──POST /ml/extract-keywords──► ML Service
        │
        ▼
Frontend receives all results
Renders visualizations (charts, tables, trust report)
```

## Database Design

### Entity Relationship

```
users (1) ──── (*) review_analyses
users (1) ──── (*) link_analyses
users (1) ──── (*) refresh_tokens
users (1) ──── (*) analysis_metrics (optional FK)
                   site_visits (standalone)
                   contact_messages (standalone)
```

### Key Design Decisions

1. **UUID Primary Keys** - Prevents ID enumeration attacks and supports distributed ID generation
2. **Encrypted Text Storage** - `encrypted_review_text` and `encrypted_product_url` columns store AES-256-GCM ciphertext
3. **Separate Analysis Tables** - `review_analyses` (single reviews) and `link_analyses` (product URLs) are separate tables with different schemas
4. **Metrics Tables** - `analysis_metrics` and `site_visits` are append-only for analytics
5. **Token Rotation** - Refresh tokens are stored as hashes; each use generates a new token
6. **Soft Locking** - Account lockout uses `lock_expires_at` timestamp (auto-unlocks)

### Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `users` | `idx_users_email` (UNIQUE) | Fast login lookup |
| `refresh_tokens` | `idx_refresh_tokens_token_hash` (UNIQUE) | Token validation |
| `refresh_tokens` | `idx_refresh_tokens_user_id` | User's active sessions |
| `review_analyses` | `idx_review_analyses_user_id` | User history queries |
| `review_analyses` | `idx_review_analyses_created_at` | Time-range queries |
| `link_analyses` | `idx_link_analyses_user_id` | User history queries |
| `site_visits` | `idx_site_visits_created_at` | Analytics time-range |
| `analysis_metrics` | `idx_analysis_metrics_type` | Type-based aggregation |

## Web Scraper Design

### Platform Abstraction

```
BaseScraper (Abstract)
    │
    ├── AmazonScraper      (10 regional domains)
    ├── FlipkartScraper
    ├── MyntraScraper
    ├── AjioScraper
    └── NykaaScraper
```

Each scraper implements the same interface:
1. `detect(url)` - Returns True if the URL belongs to this platform
2. `scrape(url, options)` - Extracts reviews with configurable limits
3. `get_product_info(url)` - Extracts product metadata

### Two-Phase Extraction Strategy

```
Phase 1: API/HTTP (fast, lightweight)
    │
    ├── Attempt direct API call or HTTP request
    ├── Parse JSON/HTML response
    │
    ├── Success? → Return reviews
    │
    └── Failed? → Phase 2

Phase 2: Playwright (slower, more robust)
    │
    ├── Launch headless Chromium with stealth scripts
    ├── Navigate to URL, wait for dynamic content
    ├── Extract reviews from rendered DOM
    └── Return reviews
```

### Anti-Detection

The stealth module applies 11 anti-detection techniques to Playwright browser instances:

| Module | Technique |
|--------|-----------|
| `webdriver_hide` | Removes `navigator.webdriver` property |
| `webgl_spoof` | Randomizes WebGL renderer/vendor strings |
| `navigator_override` | Spoofs platform, language, hardware concurrency |
| `plugin_inject` | Simulates browser plugins array |
| `permission_override` | Overrides permission query responses |
| `chrome_runtime` | Adds `chrome.runtime` stub |
| `iframe_contentWindow` | Patches iframe contentWindow access |
| `media_codecs` | Spoofs media codec support |
| `user_agent_rotation` | Rotates through 10+ realistic UA strings |
| `timezone_spoof` | Matches timezone to geolocation |
| `canvas_noise` | Adds imperceptible noise to canvas fingerprint |

### Cookie Management

Cookies are managed per-site with automatic refresh:

- **Storage**: JSON files per domain
- **Auto-refresh**: Every 30 minutes
- **Pre-expiry refresh**: Proactively refreshes before cookies expire
- **Import/Export**: Supports Netscape (.txt) and JSON formats
- **Health monitoring**: Cookie freshness reported via `/api/health`

## Frontend Architecture

### Routing

```
App
├── / (Home)
├── /analyze (AnalyzeReviewPage)
├── /product-analysis (ProductAnalysisPage)
├── /models (ModelsPage)
├── /contact (ContactPage)
├── /faq (FaqPage)
├── /privacy (PrivacyPage)
├── /login (LoginPage)
├── /signup (SignupPage)
├── /chrome-extension (ProtectedRoute → ChromeExtensionPage)
├── /profile (ProtectedRoute → ProfilePage)
├── /history (ProtectedRoute → HistoryPage)
├── /admin/dashboard (AdminRoute → AdminDashboard)
├── /admin/users (AdminRoute → AdminUsers)
├── /admin/contact-messages (AdminRoute → AdminContactMessages)
├── /admin/cookies (AdminRoute → AdminCookies)
└── * (NotFoundPage)
```

All routes use React.lazy() for code-splitting.

### State Management

- **Auth State**: React Context (`AuthContext`) holding JWT tokens, user profile, login/logout methods
- **API State**: Local component state with Axios interceptors for token refresh
- **No global store**: Redux/Zustand not needed given the API-first architecture

### Component Library

The `components/ui/` directory provides a consistent design system:

| Component | Description |
|-----------|-------------|
| `Button` | Primary, secondary, outline, danger variants with loading states |
| `Card` | Elevated content container with optional header/footer |
| `Modal` | Animated overlay dialog with focus trap |
| `Badge` | Status indicators (success, warning, danger, info) |
| `ProgressBar` | Animated progress with color variants |
| `Skeleton` | Loading placeholder with shimmer animation |
| `OtpInput` | 6-digit OTP code input with auto-focus |
| `MetricCard` | Dashboard-style metric display with trend indicator |
| `SvgCaptcha` | SVG-based CAPTCHA with distortion and refresh |
