# API Reference

Complete REST API documentation for ReviewIQ.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Reviews](#reviews)
  - [Users](#users)
  - [Admin](#admin)
  - [Contact](#contact)
  - [ML Service (Internal)](#ml-service-internal)
  - [Scraper Service](#scraper-service)

---

## Base URL

```
Production: https://reviewiq.website/api/v1
Development: http://localhost:8080/api/v1
```

## Authentication

ReviewIQ uses JWT bearer token authentication.

### Token Flow

1. Authenticate via `POST /auth/login` to receive an `accessToken` and `refreshToken`
2. Include the access token in all subsequent requests: `Authorization: Bearer <accessToken>`
3. When the access token expires (15 minutes), refresh it via `POST /auth/refresh`
4. Refresh tokens are valid for 7 days and are single-use (rotated on each refresh)

### Example

```bash
# Login
curl -X POST https://reviewiq.website/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "captchaToken": "..."}'

# Response
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "a1b2c3d4-e5f6-...",
  "tokenType": "Bearer",
  "expiresIn": 900000
}

# Use the token
curl https://reviewiq.website/api/v1/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9..."
```

## Error Responses

All errors follow a consistent format:

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "fieldErrors": [
    {
      "field": "email",
      "message": "must be a valid email address"
    }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate email) |
| 429 | Too Many Requests (rate limit exceeded) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (ML/scraper down) |

## Rate Limiting

Requests are rate-limited using a token-bucket algorithm:

| User Type | Limit |
|-----------|-------|
| Anonymous | 20 requests/minute |
| Authenticated | 60 requests/minute |

When rate-limited, the API returns `429 Too Many Requests`.

---

## Endpoints

### Auth

#### `POST /auth/signup`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "password": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "message": "Account created successfully. Please verify your email."
}
```

---

#### `POST /auth/login`

Authenticate and receive JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "captchaToken": "base64-encoded-captcha-verification"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "uuid-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 900000
}
```

---

#### `POST /auth/refresh`

Refresh an expired access token.

**Request Body:**
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "new-uuid-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 900000
}
```

---

#### `POST /auth/logout`

Revoke a refresh token.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### `POST /auth/verify-otp`

Verify email OTP code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

---

#### `POST /auth/resend-otp`

Resend OTP verification email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

---

#### `POST /auth/change-password`

Change the authenticated user's password.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

---

### Reviews

#### `POST /reviews/analyze`

Analyze a single review text. Available to both anonymous and authenticated users.

**Request Body:**
```json
{
  "reviewText": "This product is absolutely amazing! Best purchase ever!",
  "language": "en"
}
```

**Response (200):**
```json
{
  "sentiment": "positive",
  "confidence": 0.94,
  "predictedRating": 5,
  "aiGeneratedProbability": 0.12,
  "authenticityScore": 85,
  "detectedLanguage": "en",
  "translatedText": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sentiment` | string | `positive`, `negative`, or `neutral` |
| `confidence` | float | Model confidence (0.0 - 1.0) |
| `predictedRating` | int | Predicted star rating (1-5) |
| `aiGeneratedProbability` | float | Probability review is AI-generated (0.0 - 1.0) |
| `authenticityScore` | int | Composite authenticity score (0-100, higher = more authentic) |
| `detectedLanguage` | string | ISO language code |
| `translatedText` | string | English translation if non-English, null otherwise |

---

#### `GET /reviews/history`

Get the authenticated user's review analysis history.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 0 | Page number (0-indexed) |
| `size` | int | 10 | Items per page |

**Response (200):**
```json
{
  "content": [
    {
      "id": "uuid",
      "reviewText": "...",
      "sentiment": "positive",
      "predictedRating": 5,
      "aiGeneratedProbability": 0.12,
      "authenticityScore": 85,
      "confidence": 0.94,
      "detectedLanguage": "en",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "page": 0,
  "size": 10,
  "totalElements": 42,
  "totalPages": 5
}
```

---

#### `POST /reviews/save-link-analysis`

Save a product link analysis result. Requires authentication.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "productUrl": "https://www.amazon.in/dp/B0EXAMPLE",
  "totalReviewsAnalyzed": 50,
  "positivePercentage": 72.0,
  "negativePercentage": 14.0,
  "neutralPercentage": 14.0,
  "averagePredictedRating": 4.2,
  "aiGeneratedPercentage": 8.5,
  "languagesDetected": "en, hi"
}
```

---

#### `GET /reviews/link-history`

Get the authenticated user's product analysis history.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:** Same as `/reviews/history`

---

### Users

#### `GET /users/profile`

Get the authenticated user's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "USER",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

#### `PUT /users/profile`

Update the authenticated user's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "fullName": "Jane Doe"
}
```

---

### Admin

All admin endpoints require `ADMIN` role.

#### `GET /admin/users`

List all users with pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 0 | Page number |
| `size` | int | 20 | Items per page |
| `search` | string | | Filter by email or name |

---

#### `PUT /admin/users/{id}/role`

Change a user's role.

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

---

#### `GET /admin/analytics`

Get platform analytics (total analyses, user counts, popular domains, etc.).

---

#### `GET /admin/contact-messages`

List contact form submissions.

---

### Contact

#### `POST /contact`

Submit a contact form message. No authentication required.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "subject": "Question about the platform",
  "message": "I'd like to know more about..."
}
```

---

### ML Service (Internal)

These endpoints are internal (backend → ML service). Not exposed to the frontend directly.

**Base URL:** `http://localhost:5001`

#### `POST /ml/analyze`

Run full ML inference pipeline on a review.

**Request Body:**
```json
{
  "reviewText": "Great product, highly recommend!",
  "language": "en"
}
```

**Response:**
```json
{
  "sentiment": "positive",
  "confidence": 0.94,
  "predictedRating": 5,
  "aiGeneratedProbability": 0.08,
  "authenticityScore": 88,
  "detectedLanguage": "en"
}
```

---

#### `POST /ml/extract-keywords`

Extract keyphrases from review text(s).

**Request Body:**
```json
{
  "reviews": ["This laptop has amazing battery life and a brilliant display"]
}
```

**Response:**
```json
{
  "keywords": [
    {"keyword": "battery life", "score": 0.82},
    {"keyword": "brilliant display", "score": 0.76}
  ]
}
```

---

#### `POST /ml/detect-red-flags`

Detect suspicious patterns in review text.

**Request Body:**
```json
{
  "reviewText": "I received this product for free in exchange for an honest review..."
}
```

**Response:**
```json
{
  "redFlags": [
    {
      "type": "incentivized",
      "description": "Review mentions receiving the product for free",
      "severity": "high"
    }
  ],
  "riskLevel": "high"
}
```

---

#### `POST /ml/product-trust-report`

Generate a comprehensive trust report for a batch of reviews.

**Request Body:**
```json
{
  "reviews": [
    {
      "text": "Amazing product!",
      "rating": 5,
      "sentiment": "positive",
      "confidence": 0.92,
      "predictedRating": 5,
      "aiGeneratedProbability": 0.05,
      "authenticityScore": 90
    }
  ]
}
```

**Response:**
```json
{
  "overallTrustScore": 78,
  "totalReviews": 50,
  "suspiciousReviewCount": 4,
  "duplicateCount": 2,
  "burstDetected": false,
  "ratingAnomalyScore": 0.15,
  "lengthUniformityScore": 0.32,
  "phraseRepetitionScore": 0.08,
  "sentimentMismatchRate": 0.06
}
```

---

### Scraper Service

**Base URL:** `http://localhost:5000/api` (accessed via Nginx at `/scraper/`)

#### `POST /api/scrape`

Start a new scrape job for a product URL.

**Request Body:**
```json
{
  "url": "https://www.amazon.in/dp/B0EXAMPLE",
  "max_pages": 0,
  "max_reviews": 50,
  "min_delay": 3,
  "max_delay": 6,
  "render_js": true
}
```

**Response (200):**
```json
{
  "job_id": "uuid-job-id",
  "status": "started",
  "message": "Scraping started for amazon.in"
}
```

---

#### `GET /api/status/<job_id>`

Poll the status of a scrape job.

**Response (in progress):**
```json
{
  "job_id": "uuid",
  "status": "scraping",
  "progress": {
    "reviews_found": 23,
    "pages_scraped": 2
  }
}
```

**Response (completed):**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "reviews": [
    {
      "review_id": "R123ABC",
      "text": "Great product, fast delivery...",
      "rating": 5,
      "author": "John D.",
      "date": "2025-01-15",
      "verified_purchase": true
    }
  ],
  "total_reviews": 50,
  "platform": "amazon.in"
}
```

---

#### `GET /api/health`

Service health check with cookie store status.

**Response:**
```json
{
  "status": "running",
  "uptime_seconds": 86400,
  "active_jobs": 0,
  "cookie_store": {
    "total_sites": 5,
    "healthy_sites": 4,
    "sites": {
      "amazon.in": {"status": "fresh", "age_minutes": 12},
      "flipkart.com": {"status": "stale", "age_minutes": 45}
    }
  }
}
```

---

#### `GET /api/cookies/status`

Get cookie freshness status for all domains.

---

#### `POST /api/cookies/import`

Import cookies from Netscape or JSON format.

**Form Data:**
- `file`: Cookie file (Netscape .txt or JSON)
- `site`: Target domain (e.g., `amazon.in`)

---

#### `GET /api/cookies/export/<site>`

Export cookies for a specific domain.

**Response:** Cookie file download (JSON format).
