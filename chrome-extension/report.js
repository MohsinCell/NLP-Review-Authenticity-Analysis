const $ = (id) => document.getElementById(id);

function show(id) { $(id)?.classList.remove('hidden'); }
function hide(id) { $(id)?.classList.add('hidden'); }

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function getAuthColor(label) {
  const l = (label || '').toLowerCase();
  if (l === 'likely genuine') return 'success';
  if (l === 'suspicious') return 'warning';
  return 'danger';
}

function getSentimentClass(sentiment) {
  const s = (sentiment || '').toLowerCase();
  if (s === 'positive') return 'success';
  if (s === 'negative') return 'danger';
  if (s === 'neutral') return 'warning';
  return '';
}

let reportData = null;
let currentFilter = 'all';

async function init() {
  const result = await chrome.storage.local.get('reportData');
  reportData = result.reportData;

  if (!reportData || !reportData.analyzedReviews || reportData.analyzedReviews.length === 0) {
    show('empty-state');
    return;
  }

  if (reportData.generatedAt) {
    const d = new Date(reportData.generatedAt);
    $('report-date').textContent = `Generated ${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;
  }

  renderProduct();
  renderOverview();
  renderSentiment();
  renderTrust();
  renderReviews();
  initFilters();
}

function renderProduct() {
  const meta = reportData.productMeta;
  if (!meta || !meta.name) return;

  show('product-section');

  const img = $('product-image');
  if (meta.image_url) {
    img.src = meta.image_url;
    img.alt = meta.name;
    img.classList.remove('hidden');
  }

  $('product-brand').textContent = meta.brand || '';
  $('product-name').textContent = meta.name;
  $('product-platform').textContent = meta.platform || reportData.siteName || '';

  const priceEl = $('product-price');
  if (meta.price) {
    priceEl.textContent = meta.price;
    priceEl.classList.remove('hidden');
  }

  const ratingBadge = $('product-rating-badge');
  if (meta.overall_rating !== null && meta.overall_rating !== undefined) {
    $('product-rating-val').textContent = Number(meta.overall_rating).toFixed(1);
    ratingBadge.classList.remove('hidden');
  }

  if (reportData.url) {
    $('product-url').textContent = reportData.url;
  }
}

function renderOverview() {
  const agg = reportData.aggregates;
  if (!agg) return;

  show('overview-section');

  $('metric-total').textContent = agg.total || 0;
  $('metric-rating').textContent = (agg.avgRating || 0).toFixed(1);
  const stars = Math.round(agg.avgRating || 0);
  $('metric-rating-stars').textContent =
    '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars);

  const aiProb = agg.avgAiProb || 0;
  const aiEl = $('metric-ai');
  aiEl.textContent = `${aiProb.toFixed(1)}%`;
  aiEl.className = `metric-value-large ${aiProb > 50 ? 'danger' : 'success'}`;
  const aiBar = $('metric-ai-bar')?.querySelector('.progress-bar-fill');
  if (aiBar) {
    aiBar.style.width = `${aiProb}%`;
    aiBar.style.background = aiProb > 50 ? 'var(--danger)' : 'var(--success)';
  }

  const authEl = $('metric-auth-label');
  authEl.textContent = agg.authLabel || 'Unknown';
  authEl.className = `metric-value-large ${getAuthColor(agg.authLabel)}`;
  $('metric-auth-score').textContent = `${(agg.avgAuth || 0).toFixed(1)} / 100`;
}

function renderSentiment() {
  const agg = reportData.aggregates;
  if (!agg) return;

  show('sentiment-section');

  const total = agg.total || 1;
  const posPct = agg.positivePercent || 0;
  const negPct = agg.negativePercent || 0;
  const neuPct = agg.neutralPercent || 0;

  $('sentiment-pos-pct').textContent = `${posPct.toFixed(0)}%`;
  $('sentiment-pos-count').textContent = `${Math.round((posPct / 100) * total)} reviews`;
  $('sentiment-pos-bar').style.width = `${posPct}%`;

  $('sentiment-neg-pct').textContent = `${negPct.toFixed(0)}%`;
  $('sentiment-neg-count').textContent = `${Math.round((negPct / 100) * total)} reviews`;
  $('sentiment-neg-bar').style.width = `${negPct}%`;

  $('sentiment-neu-pct').textContent = `${neuPct.toFixed(0)}%`;
  $('sentiment-neu-count').textContent = `${Math.round((neuPct / 100) * total)} reviews`;
  $('sentiment-neu-bar').style.width = `${neuPct}%`;
}

function renderTrust() {
  const report = reportData.trustReport;
  if (!report) return;

  show('trust-section');

  const score = report.trustScore ?? 0;
  const scoreEl = $('trust-score-val');
  scoreEl.textContent = score;
  scoreEl.style.color = score >= 70
    ? 'var(--success)'
    : score >= 45
      ? 'var(--warning)'
      : 'var(--danger)';

  const badge = $('trust-badge');
  badge.textContent = report.trustLabel || 'Unknown';
  badge.className = `badge ${score >= 70 ? 'success' : score >= 45 ? 'warning' : 'danger'}`;

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

function renderReviews() {
  const reviews = reportData.analyzedReviews;
  if (!reviews || reviews.length === 0) return;

  show('reviews-section');
  $('reviews-count').textContent = reviews.length;

  applyFilter();
}

function applyFilter() {
  const reviews = reportData.analyzedReviews;
  const container = $('reviews-container');
  container.innerHTML = '';

  const filtered = reviews.filter((r) => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'ai') return r.aiGeneratedProbability > 0.5;
    return (r.sentiment || '').toLowerCase() === currentFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px;">No reviews match this filter.</p>';
    return;
  }

  filtered.forEach((review, idx) => {
    const originalIdx = reviews.indexOf(review);
    const card = document.createElement('div');
    card.className = 'review-card-full';

    const sentBadge = review.error
      ? '<span class="badge danger">Error</span>'
      : `<span class="badge ${getSentimentClass(review.sentiment)}">${capitalize(review.sentiment)}</span>`;

    const aiBadge = !review.error && review.aiGeneratedProbability > 0.5
      ? '<span class="badge danger">AI Generated</span>'
      : '';

    const authBadge = !review.error
      ? `<span class="badge ${getAuthColor(review.authenticityLabel)}">${review.authenticityLabel}</span>`
      : '';

    const metricsHtml = review.error
      ? `<p style="color: var(--danger); font-size: 12px;">${escapeHtml(review.error)}</p>`
      : `<div class="review-card-metrics">
          <div class="review-metric">
            <p class="review-metric-label">Sentiment</p>
            <p class="review-metric-val ${getSentimentClass(review.sentiment)}">${capitalize(review.sentiment)}</p>
          </div>
          <div class="review-metric">
            <p class="review-metric-label">Rating</p>
            <p class="review-metric-val">${review.scraperRating || '-'} / ${review.predictedRating ? review.predictedRating.toFixed(1) : '-'}</p>
          </div>
          <div class="review-metric">
            <p class="review-metric-label">AI Probability</p>
            <p class="review-metric-val ${review.aiGeneratedProbability > 0.5 ? 'danger' : 'success'}">${(review.aiGeneratedProbability * 100).toFixed(1)}%</p>
          </div>
          <div class="review-metric">
            <p class="review-metric-label">Authenticity</p>
            <p class="review-metric-val ${getAuthColor(review.authenticityLabel)}">${review.authenticityLabel}</p>
          </div>
        </div>`;

    card.innerHTML = `
      <div class="review-card-header">
        <span class="review-num">${originalIdx + 1}</span>
        <div class="review-card-badges">${sentBadge}${aiBadge}${authBadge}</div>
      </div>
      <p class="review-card-text">${escapeHtml(review.text || 'No text')}</p>
      ${metricsHtml}
    `;

    container.appendChild(card);
  });
}

function initFilters() {
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilter();
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
