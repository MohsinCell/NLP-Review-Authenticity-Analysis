const API_BASE = 'https://reviewiq.website';
const SCRAPER_BASE = `${API_BASE}/scraper`;
const BACKEND_BASE = `${API_BASE}/api/v1`;

const SUPPORTED_DOMAINS = [
  { pattern: /amazon\.(com|in|co\.uk|ca|de|fr|it|es|com\.au|co\.jp)/, name: 'Amazon' },
  { pattern: /flipkart\.com/, name: 'Flipkart' },
  { pattern: /myntra\.com/, name: 'Myntra' },
  { pattern: /ajio\.com/, name: 'Ajio' },
  { pattern: /nykaa\.com|nykaafashion\.com/, name: 'Nykaa' },
];

let state = {
  phase: 'loading',
  url: '',
  siteName: '',
  maxReviews: 20,
  jobId: null,
  pollTimer: null,
  productMeta: null,
  scrapedReviews: [],
  analyzedReviews: [],
  analysisProgress: { done: 0, total: 0 },
  aggregates: null,
  trustReport: null,
  expandedReview: null,
  errorMsg: '',
};

const $ = (id) => document.getElementById(id);

function show(id) { $(id)?.classList.remove('hidden'); }
function hide(id) { $(id)?.classList.add('hidden'); }

function detectSite(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const d of SUPPORTED_DOMAINS) {
      if (d.pattern.test(hostname)) return d.name;
    }
  } catch {}
  return null;
}

function initPills() {
  const pills = document.querySelectorAll('.pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      pills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.maxReviews = parseInt(pill.dataset.count, 10);
    });
  });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.text();
      if (body) msg += `: ${body.substring(0, 200)}`;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function detectCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    showNotSupported();
    return;
  }

  state.url = tab.url;
  const site = detectSite(tab.url);

  if (!site) {
    showNotSupported();
    return;
  }

  state.siteName = site;
  showDetection(site);
}

function showNotSupported() {
  state.phase = 'not_supported';
  hide('detection');
  hide('progress');
  hide('results');
  hide('error');
  hide('product-card');
  show('not-supported');
}

function showDetection(site) {
  state.phase = 'detected';
  hide('not-supported');
  hide('progress');
  hide('results');
  hide('error');
  show('detection');

  // Product card is now a top-level element; hide it until metadata arrives
  if (!state.productMeta) hide('product-card');

  $('site-name').textContent = `${site} Detected`;
  $('site-badge').classList.remove('hidden');
  $('analyze-btn').disabled = false;
}

function showProgress(title, msg) {
  state.phase = 'progress';
  hide('detection');
  hide('not-supported');
  hide('results');
  hide('error');
  show('progress');

  // Keep the product card visible if metadata already exists
  if (state.productMeta) show('product-card');

  $('progress-title').textContent = title;
  $('progress-msg').textContent = msg;
  $('progress-bar').style.width = '0%';
  $('progress-count').textContent = '0 reviews';
}

function showError(msg) {
  state.phase = 'error';
  hide('detection');
  hide('not-supported');
  hide('progress');
  hide('results');
  hide('product-card');
  show('error');

  $('error-msg').textContent = msg || 'Something went wrong';
}

function showResults() {
  state.phase = 'results';
  hide('detection');
  hide('not-supported');
  hide('progress');
  hide('error');
  show('results');

  // Keep product card visible in results phase
  if (state.productMeta) show('product-card');
}

async function startAnalysis() {
  const btn = $('analyze-btn');
  if (btn.disabled) return;
  btn.disabled = true;

  showProgress('Starting Scraper...', 'Connecting to ReviewIQ...');

  try {
    const data = await fetchJson(`${SCRAPER_BASE}/scrape`, {
      method: 'POST',
      body: JSON.stringify({
        url: state.url,
        max_pages: 0,
        max_reviews: state.maxReviews,
        min_delay: 3,
        max_delay: 6,
        render_js: true,
      }),
    });

    state.jobId = data.job_id;
    $('progress-title').textContent = 'Scraping Reviews...';
    $('progress-msg').textContent = 'Looking for reviews...';
    startPolling();
  } catch (err) {
    $('analyze-btn').disabled = false;
    showError('Failed to start scraping. Check your connection.');
  }
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);

  const MAX_POLLS = 75;
  let pollCount = 0;
  let consecutiveErrors = 0;

  state.pollTimer = setInterval(async () => {
    pollCount++;

    if (pollCount > MAX_POLLS) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
      showError('Scraping timed out. The page may have too many reviews or the server is busy.');
      return;
    }

    try {
      const data = await fetchJson(`${SCRAPER_BASE}/status/${state.jobId}`);
      consecutiveErrors = 0;

      if (data.product && data.product.name) {
        state.productMeta = data.product;
        renderProductCard(data.product);
      }

      const count = data.total_reviews || 0;
      const pct = state.maxReviews > 0 ? Math.min((count / state.maxReviews) * 100, 100) : 0;
      $('progress-bar').style.width = `${pct}%`;
      $('progress-count').textContent = `${count} reviews found`;
      $('progress-msg').textContent = count > 0
        ? `Found ${count} reviews so far...`
        : 'Searching for reviews...';

      if (data.status === 'completed') {
        clearInterval(state.pollTimer);
        state.pollTimer = null;

        if (data.reviews && data.reviews.length > 0) {
          state.scrapedReviews = data.reviews;
          analyzeReviews(data.reviews);
        } else {
          showError('No reviews found on this page.');
        }
      } else if (data.status === 'failed') {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        showError(data.error || 'Scraping failed.');
      }
    } catch {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        showError('Lost connection to ReviewIQ server.');
      }
    }
  }, 2000);
}

async function analyzeReviews(reviews) {
  $('progress-title').textContent = 'Analyzing Reviews...';
  $('progress-msg').textContent = 'Running NLP analysis...';
  $('progress-bar').style.width = '0%';
  $('progress-count').textContent = `0 / ${reviews.length}`;

  state.analyzedReviews = [];
  state.analysisProgress = { done: 0, total: reviews.length };

  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];

    if (!review.text || !review.text.trim()) {
      state.analyzedReviews.push({
        text: review.text || '',
        scraperRating: review.rating,
        date: review.date,
        sentiment: 'unknown',
        confidence: 0,
        predictedRating: 0,
        aiGeneratedProbability: 0,
        authenticityScore: 0,
        authenticityLabel: 'Skipped',
        detectedLanguage: '',
        error: 'Empty review',
      });
      updateAnalysisProgress(i + 1, reviews.length);
      continue;
    }

    let analyzed = false;
    for (let attempt = 0; attempt < 3 && !analyzed; attempt++) {
      try {
        if (attempt > 0) await sleep(1500 * attempt);
        const ml = await fetchJson(`${BACKEND_BASE}/reviews/analyze`, {
          method: 'POST',
          body: JSON.stringify({ reviewText: review.text }),
        });
        state.analyzedReviews.push({
          text: review.text,
          scraperRating: review.rating,
          date: review.date,
          sentiment: ml.sentiment,
          confidence: ml.confidence,
          predictedRating: ml.predictedRating,
          aiGeneratedProbability: ml.aiGeneratedProbability,
          authenticityScore: ml.authenticityScore,
          authenticityLabel: ml.authenticityLabel,
          detectedLanguage: ml.languageName || ml.language,
        });
        analyzed = true;
      } catch {
        if (attempt === 2) {
          state.analyzedReviews.push({
            text: review.text,
            scraperRating: review.rating,
            date: review.date,
            sentiment: 'unknown',
            confidence: 0,
            predictedRating: 0,
            aiGeneratedProbability: 0,
            authenticityScore: 0,
            authenticityLabel: 'Error',
            detectedLanguage: '',
            error: 'Analysis failed',
          });
        }
      }
    }

    if (i < reviews.length - 1) await sleep(300);
    updateAnalysisProgress(i + 1, reviews.length);
  }

  computeAggregates();
  showResults();
  renderResults();
  fetchTrustReport();
}

function updateAnalysisProgress(done, total) {
  state.analysisProgress = { done, total };
  const pct = total > 0 ? (done / total) * 100 : 0;
  $('progress-bar').style.width = `${pct}%`;
  $('progress-count').textContent = `${done} / ${total} analyzed`;
  $('progress-msg').textContent = getAnalyzingMsg(done);
}

const ANALYZING_MSGS = [
  'Analyzing sentiment patterns...',
  'Detecting writing style markers...',
  'Evaluating authenticity signals...',
  'Predicting star ratings...',
  'Running deep language analysis...',
  'Cross-referencing linguistic patterns...',
  'Assessing review quality...',
  'Processing natural language features...',
];

function getAnalyzingMsg(idx) {
  return ANALYZING_MSGS[idx % ANALYZING_MSGS.length];
}

function computeAggregates() {
  const valid = state.analyzedReviews.filter((r) => !r.error);
  if (valid.length === 0) {
    state.aggregates = null;
    return;
  }

  const total = valid.length;
  const positive = valid.filter((r) => r.sentiment === 'positive').length;
  const negative = valid.filter((r) => r.sentiment === 'negative').length;
  const neutral = valid.filter((r) => r.sentiment === 'neutral').length;
  const avgRating = valid.reduce((s, r) => s + r.predictedRating, 0) / total;
  const avgAiProb = (valid.reduce((s, r) => s + r.aiGeneratedProbability, 0) / total) * 100;
  const avgAuth = valid.reduce((s, r) => s + r.authenticityScore, 0) / total;

  let authLabel = 'Likely Genuine';
  if (avgAuth > 70) authLabel = 'Highly Suspicious';
  else if (avgAuth > 40) authLabel = 'Suspicious';

  state.aggregates = {
    total,
    positivePercent: (positive / total) * 100,
    negativePercent: (negative / total) * 100,
    neutralPercent: (neutral / total) * 100,
    avgRating,
    avgAiProb,
    avgAuth,
    authLabel,
  };
}

function renderProductCard(meta) {
  const card = $('product-card');
  if (!meta || !meta.name) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  const img = $('product-image');
  if (meta.image_url) {
    img.src = meta.image_url;
    img.alt = meta.name;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }

  $('product-brand').textContent = meta.brand || '';
  $('product-name').textContent = meta.name;
  $('product-platform').textContent = meta.platform || state.siteName;

  const priceEl = $('product-price');
  if (meta.price) {
    priceEl.textContent = meta.price;
    priceEl.classList.remove('hidden');
  } else {
    priceEl.classList.add('hidden');
  }

  const ratingBadge = $('product-rating-badge');
  if (meta.overall_rating !== null && meta.overall_rating !== undefined) {
    $('product-rating-val').textContent = Number(meta.overall_rating).toFixed(1);
    ratingBadge.classList.remove('hidden');
  } else {
    ratingBadge.classList.add('hidden');
  }
}

function renderResults() {
  const agg = state.aggregates;
  if (!agg) return;

  $('results-count').textContent = `${agg.total} reviews`;

  $('metric-rating').textContent = agg.avgRating.toFixed(1);
  $('metric-rating-stars').textContent =
    '\u2605'.repeat(Math.round(agg.avgRating)) + '\u2606'.repeat(5 - Math.round(agg.avgRating));

  const aiEl = $('metric-ai');
  aiEl.textContent = `${agg.avgAiProb.toFixed(1)}%`;
  aiEl.className = `metric-value ${agg.avgAiProb > 50 ? 'danger' : 'success'}`;
  const aiBar = $('metric-ai-bar').querySelector('.mini-bar-fill');
  aiBar.style.width = `${agg.avgAiProb}%`;
  aiBar.style.background = agg.avgAiProb > 50 ? 'var(--danger)' : 'var(--success)';

  const authEl = $('metric-auth-label');
  authEl.textContent = agg.authLabel;
  authEl.className = `metric-value ${getAuthColor(agg.authLabel)}`;
  $('metric-auth-score').textContent = `${agg.avgAuth.toFixed(1)} / 100`;

  renderSentiment(agg);
  renderReviewsList();
}

function getAuthColor(label) {
  const l = (label || '').toLowerCase();
  if (l === 'likely genuine') return 'success';
  if (l === 'suspicious') return 'warning';
  return 'danger';
}

function renderSentiment(agg) {
  const container = $('metric-sentiment');
  container.innerHTML = '';

  const rows = [
    { label: 'Pos', val: agg.positivePercent, cls: 'pos' },
    { label: 'Neg', val: agg.negativePercent, cls: 'neg' },
    { label: 'Neu', val: agg.neutralPercent, cls: 'neu' },
  ];

  rows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'sentiment-row';
    row.innerHTML = `
      <span class="sentiment-label">${r.label}</span>
      <div class="sentiment-bar-track">
        <div class="sentiment-bar-fill ${r.cls}" style="width: ${r.val}%"></div>
      </div>
      <span class="sentiment-val">${r.val.toFixed(0)}%</span>
    `;
    container.appendChild(row);
  });
}

function renderReviewsList() {
  const reviews = state.analyzedReviews;
  if (reviews.length === 0) {
    hide('reviews-list');
    return;
  }

  show('reviews-list');
  $('reviews-list-count').textContent = reviews.length;

  const container = $('reviews-container');
  container.innerHTML = '';

  reviews.forEach((review, idx) => {
    const item = document.createElement('div');
    item.className = 'review-item';
    item.dataset.idx = idx;

    const sentBadge = review.error
      ? '<span class="badge danger">Error</span>'
      : `<span class="badge ${getSentimentClass(review.sentiment)}">${capitalize(review.sentiment)}</span>`;

    const aiBadge = !review.error && review.aiGeneratedProbability > 0.5
      ? '<span class="badge danger">AI</span>'
      : '';

    item.innerHTML = `
      <span class="review-num">${idx + 1}</span>
      <span class="review-text">${escapeHtml(review.text || 'No text')}</span>
      <div class="review-badges">${sentBadge}${aiBadge}</div>
    `;

    item.addEventListener('click', () => toggleReviewDetail(idx));
    container.appendChild(item);
  });
}

function toggleReviewDetail(idx) {
  const container = $('reviews-container');
  const existing = container.querySelector(`.review-detail[data-detail="${idx}"]`);

  if (existing) {
    existing.remove();
    state.expandedReview = null;
    return;
  }

  container.querySelectorAll('.review-detail').forEach((el) => el.remove());
  state.expandedReview = idx;

  const review = state.analyzedReviews[idx];
  if (!review) return;

  const items = container.querySelectorAll('.review-item');
  const targetItem = items[idx];
  if (!targetItem) return;

  const detail = document.createElement('div');
  detail.className = 'review-detail';
  detail.dataset.detail = idx;

  if (review.error) {
    detail.innerHTML = `<p style="color: var(--danger); font-size: 11px;">${escapeHtml(review.error)}</p>`;
  } else {
    detail.innerHTML = `
      <p class="review-detail-text">${escapeHtml(review.text)}</p>
      <div class="review-detail-grid">
        <div class="review-detail-item">
          <p class="review-detail-label">Sentiment</p>
          <p class="review-detail-val ${getSentimentColor(review.sentiment)}">${capitalize(review.sentiment)}</p>
        </div>
        <div class="review-detail-item">
          <p class="review-detail-label">Rating</p>
          <p class="review-detail-val">${review.scraperRating} / ${review.predictedRating}</p>
        </div>
        <div class="review-detail-item">
          <p class="review-detail-label">AI Probability</p>
          <p class="review-detail-val ${review.aiGeneratedProbability > 0.5 ? 'danger' : 'success'}">${(review.aiGeneratedProbability * 100).toFixed(1)}%</p>
        </div>
        <div class="review-detail-item">
          <p class="review-detail-label">Authenticity</p>
          <p class="review-detail-val ${getAuthColor(review.authenticityLabel)}">${review.authenticityLabel}</p>
        </div>
      </div>
    `;
  }

  targetItem.after(detail);
}

async function fetchTrustReport() {
  const valid = state.analyzedReviews.filter((r) => !r.error);
  if (valid.length < 3) return;

  show('trust-report');
  $('trust-badge').textContent = 'Loading...';
  $('trust-badge').className = 'badge';
  $('trust-score-val').textContent = '--';
  $('trust-detections').innerHTML = '<p style="color: var(--text-muted); font-size: 11px;">Generating trust report...</p>';

  const payload = valid.map((r) => ({
    text: r.text,
    rating: r.scraperRating,
    date: r.date,
    sentiment: r.sentiment,
    confidence: r.confidence,
    predictedRating: r.predictedRating,
    aiGeneratedProbability: r.aiGeneratedProbability,
    authenticityScore: r.authenticityScore,
  }));

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(2000);
      const report = await fetchJson(`${BACKEND_BASE}/ml-service/product-trust-report`, {
        method: 'POST',
        body: JSON.stringify({ reviews: payload }),
      });

      state.trustReport = report;
      renderTrustReport(report);
      return;
    } catch (err) {
      if (attempt === 1) {
        $('trust-detections').innerHTML = `<p style="color: var(--danger); font-size: 11px;">Failed to load trust report</p>`;
        $('trust-badge').textContent = 'Error';
        $('trust-badge').className = 'badge danger';
      }
    }
  }
}

function renderTrustReport(report) {
  const scoreEl = $('trust-score-val');
  scoreEl.textContent = report.trustScore;
  scoreEl.style.color = report.trustScore >= 70
    ? 'var(--success)'
    : report.trustScore >= 45
      ? 'var(--warning)'
      : 'var(--danger)';

  const badge = $('trust-badge');
  badge.textContent = report.trustLabel;
  badge.className = `badge ${report.trustScore >= 70 ? 'success' : report.trustScore >= 45 ? 'warning' : 'danger'}`;

  const container = $('trust-detections');
  container.innerHTML = '';

  const detectionNames = {
    reviewBurst: 'Review Burst',
    ratingDistribution: 'Rating Distribution',
    ratingSentimentMismatch: 'Rating vs Sentiment',
    duplicateContent: 'Duplicate Content',
    lengthUniformity: 'Length Uniformity',
    phraseRepetition: 'Phrase Repetition',
  };

  const detections = report.detections || {};
  for (const [key, label] of Object.entries(detectionNames)) {
    const d = detections[key];
    if (!d) continue;

    const row = document.createElement('div');
    row.className = 'detection-row';

    const severityClass = d.detected
      ? d.severity === 'high' ? 'danger' : d.severity === 'medium' ? 'warning' : ''
      : 'success';
    const severityLabel = d.detected ? capitalize(d.severity) : 'Clean';

    row.innerHTML = `
      <span class="detection-name">${label}</span>
      <span class="badge ${severityClass}">${severityLabel}</span>
    `;
    container.appendChild(row);
  }
}

function getSentimentClass(sentiment) {
  const s = (sentiment || '').toLowerCase();
  if (s === 'positive') return 'success';
  if (s === 'negative') return 'danger';
  if (s === 'neutral') return 'warning';
  return '';
}

function getSentimentColor(sentiment) {
  const s = (sentiment || '').toLowerCase();
  if (s === 'positive') return 'success';
  if (s === 'negative') return 'danger';
  return 'warning';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resetToDetection() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  state.jobId = null;
  state.productMeta = null;
  state.scrapedReviews = [];
  state.analyzedReviews = [];
  state.analysisProgress = { done: 0, total: 0 };
  state.aggregates = null;
  state.trustReport = null;
  state.expandedReview = null;
  state.errorMsg = '';

  $('product-card').classList.add('hidden');
  $('product-image').classList.add('hidden');
  $('product-price').classList.add('hidden');
  $('product-rating-badge').classList.add('hidden');

  hide('trust-report');
  hide('reviews-list');

  if (state.siteName) {
    showDetection(state.siteName);
  } else {
    showNotSupported();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPills();

  $('analyze-btn').addEventListener('click', startAnalysis);
  $('btn-retry').addEventListener('click', () => resetToDetection());
  $('btn-new').addEventListener('click', () => resetToDetection());

  $('btn-open-full').addEventListener('click', async () => {
    await chrome.storage.local.set({
      reportData: {
        url: state.url,
        siteName: state.siteName,
        productMeta: state.productMeta,
        analyzedReviews: state.analyzedReviews,
        aggregates: state.aggregates,
        trustReport: state.trustReport,
        generatedAt: new Date().toISOString(),
      },
    });
    chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
  });

  detectCurrentTab();
});
