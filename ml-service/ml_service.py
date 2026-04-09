import os
import sys
import json
import logging
import importlib.util
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SENTIMENT_DIR = os.path.join(BASE_DIR, "models", "sentiment")
RATING_DIR = os.path.join(BASE_DIR, "models", "rating")
AI_GENERATED_DIR = os.path.join(BASE_DIR, "models", "ai-generated")


def _load_module_from_file(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# ML model globals
# ---------------------------------------------------------------------------
_sentiment_predictor = None
_rating_predictor = None
_ai_predictor = None
_keybert_model = None
_models_loaded = False


def load_models():
    global _sentiment_predictor, _rating_predictor, _ai_predictor, _keybert_model, _models_loaded

    if _models_loaded:
        return

    logger.info("Loading ML models...")

    try:
        logger.info("Loading sentiment model...")
        os.chdir(SENTIMENT_DIR)
        sentiment_module = _load_module_from_file(
            "predict_sentiment",
            os.path.join(SENTIMENT_DIR, "predict_sentiment.py")
        )
        _sentiment_predictor = sentiment_module.predict_sentiment
        logger.info("Sentiment model loaded successfully")
    except Exception as e:
        logger.error("Failed to load sentiment model: %s", e)
        _sentiment_predictor = None

    try:
        logger.info("Loading rating model...")
        os.chdir(RATING_DIR)
        rating_module = _load_module_from_file(
            "predict_rating",
            os.path.join(RATING_DIR, "predict.py")
        )
        _rating_predictor = rating_module.predict_review
        logger.info("Rating model loaded successfully")
    except Exception as e:
        logger.error("Failed to load rating model: %s", e)
        _rating_predictor = None

    try:
        logger.info("Loading AI-generated detector...")
        os.chdir(AI_GENERATED_DIR)
        ai_module = _load_module_from_file(
            "predict_ai",
            os.path.join(AI_GENERATED_DIR, "predict.py")
        )
        _ai_predictor = ai_module.predict_text
        logger.info("AI-generated detector loaded successfully")
    except Exception as e:
        logger.error("Failed to load AI-generated detector: %s", e)
        _ai_predictor = None

    try:
        logger.info("Loading KeyBERT model for keyword extraction...")
        from keybert import KeyBERT
        _keybert_model = KeyBERT(model='all-MiniLM-L6-v2')
        logger.info("KeyBERT model loaded successfully")
    except Exception as e:
        logger.error("Failed to load KeyBERT model: %s", e)
        _keybert_model = None

    _models_loaded = True
    logger.info("Model loading complete")


# ═══════════════════════════════════════════════════════════════════════════
# ML model inference helpers
# ═══════════════════════════════════════════════════════════════════════════

def _ml_analyze(review_text: str) -> dict:
    """Run all ML models and return their predictions."""
    result = {
        "sentiment": "neutral",
        "sentiment_conf": 0.5,
        "rating": 3,
        "rating_conf": 0.5,
        "ai_probability": 0.0,
        "ai_conf": 0.5,
    }

    if _sentiment_predictor:
        try:
            label, conf = _sentiment_predictor(review_text)
            result["sentiment"] = label.lower()
            result["sentiment_conf"] = float(conf)
        except Exception as e:
            logger.error("Sentiment prediction failed: %s", e)

    if _rating_predictor:
        try:
            rating, conf = _rating_predictor(review_text)
            result["rating"] = int(rating)
            result["rating_conf"] = float(conf)
        except Exception as e:
            logger.error("Rating prediction failed: %s", e)

    if _ai_predictor:
        try:
            label, conf = _ai_predictor(review_text)
            if label == "AI Generated":
                result["ai_probability"] = float(conf)
            else:
                result["ai_probability"] = 1.0 - float(conf)
            result["ai_conf"] = float(conf)
        except Exception as e:
            logger.error("AI detection failed: %s", e)

    return result


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/ml/analyze", methods=["POST"])
def analyze():
    data = request.get_json()

    if not data or "reviewText" not in data:
        return jsonify({"error": "reviewText is required"}), 400

    review_text = data["reviewText"].strip()
    if not review_text:
        return jsonify({"error": "reviewText cannot be empty"}), 400

    load_models()

    ml_result = _ml_analyze(review_text)

    confidences = [v for k, v in ml_result.items() if k.endswith("_conf")]
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.5

    result = {
        "sentiment": ml_result["sentiment"],
        "rating": ml_result["rating"],
        "aiProbability": round(ml_result["ai_probability"], 4),
        "confidence": round(avg_conf, 4),
    }

    logger.info(
        "Analysis complete: sentiment=%s, rating=%s, aiProb=%.4f",
        result["sentiment"], result["rating"], result["aiProbability"],
    )

    return jsonify(result)


@app.route("/ml/extract-keywords", methods=["POST"])
def extract_keywords():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    reviews = []
    if "reviews" in data and isinstance(data["reviews"], list):
        reviews = [r.strip() for r in data["reviews"] if r and r.strip()]
    elif "reviewText" in data:
        reviews = [data["reviewText"].strip()]
    else:
        return jsonify({"error": "Either 'reviews' (array) or 'reviewText' (string) is required"}), 400

    if not reviews:
        return jsonify({"error": "At least one non-empty review is required"}), 400

    load_models()

    if _keybert_model is None:
        return jsonify({"error": "Keyword extraction model not available"}), 503

    try:
        combined_text = " ".join(reviews)

        logger.info("Extracting keywords from %d reviews...", len(reviews))
        keywords_result = _keybert_model.extract_keywords(
            combined_text,
            keyphrase_ngram_range=(1, 2),
            stop_words='english',
            use_maxsum=True,
            nr_candidates=20,
            top_n=15
        )

        key_phrases_result = _keybert_model.extract_keywords(
            combined_text,
            keyphrase_ngram_range=(2, 3),
            stop_words='english',
            use_maxsum=True,
            nr_candidates=15,
            top_n=10
        )

        all_keywords = {}

        for item in keywords_result:
            if isinstance(item, tuple) and len(item) == 2:
                keyword, score = item
            elif isinstance(item, dict):
                keyword = item.get('keyword', item.get('word', ''))
                score = item.get('score', item.get('probability', 0))
            else:
                continue
            if keyword:
                keyword_lower = keyword.lower()
                if keyword_lower not in all_keywords or float(score) > float(all_keywords[keyword_lower].get('score', 0)):
                    all_keywords[keyword_lower] = {
                        "keyword": keyword,
                        "score": round(float(score), 4)
                    }

        for item in key_phrases_result:
            if isinstance(item, tuple) and len(item) == 2:
                keyword, score = item
            elif isinstance(item, dict):
                keyword = item.get('keyword', item.get('word', ''))
                score = item.get('score', item.get('probability', 0))
            else:
                continue
            if keyword:
                keyword_lower = keyword.lower()
                if keyword_lower not in all_keywords or float(score) > float(all_keywords[keyword_lower].get('score', 0)):
                    all_keywords[keyword_lower] = {
                        "keyword": keyword,
                        "score": round(float(score), 4)
                    }

        sorted_keywords = sorted(all_keywords.values(), key=lambda x: x["score"], reverse=True)[:15]

        topics = _extract_topics(sorted_keywords)

        result = {
            "keywords": sorted_keywords,
            "topics": topics,
            "wordCount": len(combined_text.split()),
            "reviewCount": len(reviews)
        }

        logger.info("Keyword extraction complete: %d keywords, %d topics", len(sorted_keywords), len(topics))
        return jsonify(result)

    except Exception as e:
        logger.error("Keyword extraction failed: %s", e)
        return jsonify({"error": f"Keyword extraction failed: {str(e)}"}), 500


def _extract_topics(keywords):
    topic_categories = {
        "Product Quality": ["quality", "good", "bad", "excellent", "poor", "amazing", "worst", "best", "perfect", "terrible", "awesome"],
        "Price & Value": ["price", "cheap", "expensive", "worth", "value", "money", "affordable", "cost", "deal", "budget"],
        "Delivery & Shipping": ["delivery", "shipping", "fast", "slow", "arrived", "package", "delivery", "courier", "tracking"],
        "Battery & Performance": ["battery", "charge", "performance", "speed", "fast", "slow", "power", "drain", "lasting"],
        "Camera & Display": ["camera", "photo", "video", "display", "screen", "picture", "quality", "resolution", "bright"],
        "Customer Service": ["service", "support", "help", "response", "seller", "customer", "refund", "return"],
        "Build & Design": ["build", "design", "look", "feel", "material", "plastic", "metal", "glass", "sleek", "heavy", "lightweight"],
        "Sound & Audio": ["sound", "audio", "speaker", "music", "bass", "volume", "headphone", "voice"],
        "Ease of Use": ["easy", "simple", "setup", "use", "interface", "app", "install", "connect", "friendly"]
    }

    topics_found = []
    for topic_name, topic_keywords in topic_categories.items():
        matching = [kw for kw in keywords if any(tk in kw["keyword"].lower() for tk in topic_keywords)]
        if matching:
            topics_found.append({
                "topic": topic_name,
                "count": len(matching),
                "keywords": [m["keyword"] for m in matching[:3]]
            })

    topics_found.sort(key=lambda x: x["count"], reverse=True)
    return topics_found[:5]


@app.route("/ml/detect-red-flags", methods=["POST"])
def detect_red_flags():
    data = request.get_json()

    if not data or "reviewText" not in data:
        return jsonify({"error": "reviewText is required"}), 400

    review_text = data["reviewText"].strip()
    if not review_text:
        return jsonify({"error": "reviewText cannot be empty"}), 400

    result = _heuristic_red_flags(review_text)

    logger.info("Red flag detection complete: %d flags, level=%s",
                result["totalFlags"], result["suspicionLevel"])
    return jsonify(result)


def _heuristic_red_flags(review_text: str) -> dict:
    """Original rule-based red flag detection."""
    import re

    red_flags = []
    text_lower = review_text.lower()
    words = review_text.split()

    alpha_chars = [c for c in review_text if c.isalpha()]
    if alpha_chars:
        upper_ratio = sum(1 for c in alpha_chars if c.isupper()) / len(alpha_chars)
        if upper_ratio > 0.3 and len(alpha_chars) > 5:
            red_flags.append({
                "type": "EXCESSIVE_CAPS",
                "severity": "high",
                "description": "Excessive use of capital letters",
                "evidence": f"{upper_ratio:.0%} of letters are uppercase"
            })

    exclamation_count = review_text.count('!')
    if exclamation_count >= 5:
        red_flags.append({
            "type": "EXCESSIVE_EXCLAMATIONS",
            "severity": "medium",
            "description": "Excessive use of exclamation marks",
            "evidence": f"Contains {exclamation_count} exclamation marks"
        })

    question_count = review_text.count('?')
    if question_count >= 3:
        red_flags.append({
            "type": "EXCESSIVE_QUESTIONS",
            "severity": "low",
            "description": "Excessive use of question marks",
            "evidence": f"Contains {question_count} question marks"
        })

    generic_patterns = [
        (r'\b(good|bad|great|awesome|terrible|worst|best|amazing)\s+(product|item|quality|service)\b', "Vague generic praise/criticism"),
    ]

    for pattern, description in generic_patterns:
        if re.search(pattern, text_lower):
            words_in_review = len(words)
            if words_in_review < 8:
                red_flags.append({
                    "type": "GENERIC_LANGUAGE",
                    "severity": "low",
                    "description": description,
                    "evidence": "Review contains only generic/vague phrases without detail"
                })
            break

    suspicious_phrases = [
        (r'\b(only|just)\s+\d+\s+(left|remaining)\b', "Fake urgency - 'Only X left!'"),
        (r'\b(order|sell|buy)\s+(fast|quick|now)\b', "Fake urgency"),
        (r'\b(first\s+time\s+(buyer|user|customer))\b', "Fake first-timer claims"),
        (r'\b(5\s*star|five\s*star|one\s*star|1\s*star)\s+(rating|review)\b', "Explicit star claims"),
    ]

    for pattern, description in suspicious_phrases:
        if re.search(pattern, text_lower):
            red_flags.append({
                "type": "SUSPICIOUS_PHRASE",
                "severity": "medium",
                "description": description,
                "evidence": "Contains suspicious marketing language"
            })
            break

    words_lower = text_lower.split()
    if len(words_lower) >= 4:
        bigrams = [f"{words_lower[i]} {words_lower[i+1]}" for i in range(len(words_lower)-1)]
        unique_bigrams = len(set(bigrams))
        if unique_bigrams / len(bigrams) < 0.5:
            red_flags.append({
                "type": "REPETITIVE_TEXT",
                "severity": "high",
                "description": "Repetitive or templated text",
                "evidence": "High repetition of phrases detected"
            })

    detail_indicators = [
        r'\d+\s*(gb|mb|kg|cm|mm|inch|hour|minute|day|week|month|year)',
        r'\$\d+',
        r'\b\d{4}\b',
        r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b',
    ]

    has_details = any(re.search(p, text_lower) for p in detail_indicators)
    if not has_details and len(words) < 15:
        red_flags.append({
            "type": "LACKS_SPECIFICS",
            "severity": "low",
            "description": "Lacks specific details",
            "evidence": "No specific measurements, prices, dates, or specifications mentioned"
        })

    severity_weights = {"high": 30, "medium": 15, "low": 5}
    suspicion_score = min(100, sum(severity_weights.get(flag["severity"], 10) for flag in red_flags))

    if suspicion_score >= 60:
        suspicion_level = "high"
    elif suspicion_score >= 30:
        suspicion_level = "medium"
    else:
        suspicion_level = "low"

    return {
        "redFlags": red_flags,
        "totalFlags": len(red_flags),
        "suspicionLevel": suspicion_level,
        "score": suspicion_score,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Product-level trust report -- batch analysis for fake review detection
# ═══════════════════════════════════════════════════════════════════════════

def _detect_review_bursts(reviews: list[dict]) -> dict:
    """Detect suspicious spikes in review posting dates."""
    from datetime import datetime, timedelta
    from collections import Counter

    dates = []
    for i, r in enumerate(reviews):
        try:
            d = r.get("date", "")
            if not d:
                continue
            # Try common formats
            for fmt in ("%Y-%m-%d", "%d %B %Y", "%B %d, %Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
                try:
                    dates.append((datetime.strptime(d.strip(), fmt).date(), i))
                    break
                except ValueError:
                    continue
            else:
                # dateutil fallback
                try:
                    from dateutil import parser as dateparser
                    dates.append((dateparser.parse(d.strip()).date(), i))
                except Exception:
                    pass
        except Exception:
            continue

    if len(dates) < 5:
        return {"detected": False, "severity": "low", "score": 90,
                "details": "Not enough dated reviews for burst analysis",
                "flaggedIndices": []}

    dates.sort(key=lambda x: x[0])
    daily_counts = Counter(d for d, _ in dates)

    # Sliding window: 3-day burst detection
    all_days = sorted(daily_counts.keys())
    threshold = max(3, len(dates) * 0.3)
    worst_burst = 0
    burst_start = None

    for i, day in enumerate(all_days):
        window_end = day + timedelta(days=2)
        window_count = sum(c for d, c in daily_counts.items() if day <= d <= window_end)
        if window_count > worst_burst:
            worst_burst = window_count
            burst_start = day

    if worst_burst < threshold:
        return {"detected": False, "severity": "low", "score": 85,
                "details": "No unusual review posting patterns detected",
                "flaggedIndices": []}

    burst_end = burst_start + timedelta(days=2)
    flagged = [idx for d, idx in dates if burst_start <= d <= burst_end]
    concentration = worst_burst / len(dates)

    if concentration > 0.6:
        severity = "high"
    elif concentration > 0.4:
        severity = "medium"
    else:
        severity = "low"

    score = max(0, 100 - int(concentration * 120))
    return {
        "detected": True, "severity": severity, "score": score,
        "details": f"{worst_burst} of {len(dates)} reviews posted within 3 days ({burst_start} to {burst_end})",
        "flaggedIndices": flagged,
    }


def _detect_rating_anomaly(reviews: list[dict]) -> dict:
    """Detect abnormal rating distributions."""
    from collections import Counter
    import math

    ratings = [int(r.get("rating", 0)) for r in reviews if r.get("rating")]
    ratings = [r for r in ratings if 1 <= r <= 5]

    if len(ratings) < 5:
        return {"detected": False, "severity": "low", "score": 85,
                "details": "Not enough ratings for distribution analysis",
                "distribution": {}}

    dist = Counter(ratings)
    distribution = {str(i): dist.get(i, 0) for i in range(1, 6)}
    total = len(ratings)
    freqs = [dist.get(i, 0) / total for i in range(1, 6)]

    # Check for bimodal pattern (high at 1 AND 5, low middle)
    extreme = (freqs[0] + freqs[4])
    middle = (freqs[1] + freqs[2] + freqs[3])
    bimodal = extreme > 0.7 and freqs[0] > 0.15 and freqs[4] > 0.15

    # Check for extreme skew (>85% one rating)
    max_freq = max(freqs)
    extreme_skew = max_freq > 0.85

    # Check for near-uniform (all ratings roughly equal)
    std_dev = (sum((f - 0.2) ** 2 for f in freqs) / 5) ** 0.5
    uniform = std_dev < 0.06 and total >= 10

    if bimodal:
        score = max(10, 100 - int(extreme * 100))
        return {"detected": True, "severity": "high", "score": score,
                "details": f"Bimodal distribution -- {dist.get(5, 0)} five-star and {dist.get(1, 0)} one-star reviews ({extreme:.0%} at extremes)",
                "distribution": distribution}
    elif extreme_skew:
        dominant = max(dist, key=dist.get)
        score = max(20, 100 - int(max_freq * 80))
        return {"detected": True, "severity": "medium", "score": score,
                "details": f"Heavily skewed -- {max_freq:.0%} of reviews are {dominant}-star",
                "distribution": distribution}
    elif uniform:
        score = 45
        return {"detected": True, "severity": "medium", "score": score,
                "details": "Unusually uniform distribution across all ratings",
                "distribution": distribution}
    else:
        return {"detected": False, "severity": "low", "score": 85,
                "details": "Rating distribution appears natural",
                "distribution": distribution}


def _detect_rating_sentiment_mismatch(reviews: list[dict]) -> dict:
    """Flag reviews where star rating contradicts detected sentiment."""
    flagged = []
    for i, r in enumerate(reviews):
        rating = int(r.get("rating", 0))
        sentiment = (r.get("sentiment") or "").lower()
        conf = float(r.get("confidence", 0))
        if conf < 0.55:
            continue
        if rating >= 4 and sentiment == "negative":
            flagged.append(i)
        elif rating <= 2 and sentiment == "positive":
            flagged.append(i)

    total = len(reviews)
    mismatch_rate = len(flagged) / total if total > 0 else 0

    if not flagged:
        return {"detected": False, "severity": "low", "score": 90,
                "details": "Ratings and sentiments are consistent",
                "flaggedIndices": []}

    if mismatch_rate > 0.25:
        severity = "high"
    elif mismatch_rate > 0.1:
        severity = "medium"
    else:
        severity = "low"

    score = max(10, 100 - int(mismatch_rate * 300))
    return {
        "detected": True, "severity": severity, "score": score,
        "details": f"{len(flagged)} of {total} reviews have star ratings contradicting their sentiment",
        "flaggedIndices": flagged,
    }


def _detect_duplicates(reviews: list[dict]) -> dict:
    """Find near-duplicate reviews using TF-IDF cosine similarity."""
    texts = [r.get("text", "") for r in reviews]
    valid = [(i, t) for i, t in enumerate(texts) if len(t.split()) >= 5]

    if len(valid) < 3:
        return {"detected": False, "severity": "low", "score": 90,
                "details": "Not enough reviews for duplicate analysis",
                "flaggedIndices": [], "clusters": []}

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        return {"detected": False, "severity": "low", "score": 85,
                "details": "Duplicate detection unavailable (missing sklearn)",
                "flaggedIndices": [], "clusters": []}

    indices, valid_texts = zip(*valid)
    tfidf = TfidfVectorizer(max_features=5000, stop_words="english")
    matrix = tfidf.fit_transform(valid_texts)
    sim = cosine_similarity(matrix)

    # Union-find for clustering
    parent = {i: i for i in range(len(indices))}
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(a, b):
        parent[find(a)] = find(b)

    threshold = 0.75
    for i in range(len(indices)):
        for j in range(i + 1, len(indices)):
            if sim[i][j] > threshold:
                union(i, j)

    clusters_map = {}
    for i in range(len(indices)):
        root = find(i)
        if root not in clusters_map:
            clusters_map[root] = []
        clusters_map[root].append(indices[i])

    dup_clusters = [c for c in clusters_map.values() if len(c) > 1]
    flagged = [idx for cluster in dup_clusters for idx in cluster]

    if not dup_clusters:
        return {"detected": False, "severity": "low", "score": 90,
                "details": "No duplicate or near-duplicate reviews found",
                "flaggedIndices": [], "clusters": []}

    total_duped = len(flagged)
    severity = "high" if total_duped > len(reviews) * 0.2 else "medium" if total_duped > 3 else "low"
    score = max(10, 100 - int((total_duped / len(reviews)) * 200))

    cluster_info = []
    for c in dup_clusters:
        preview = texts[c[0]][:80] + "..." if len(texts[c[0]]) > 80 else texts[c[0]]
        cluster_info.append({"reviewIndices": c, "preview": preview, "count": len(c)})

    return {
        "detected": True, "severity": severity, "score": score,
        "details": f"{total_duped} reviews found in {len(dup_clusters)} duplicate cluster(s)",
        "flaggedIndices": flagged, "clusters": cluster_info,
    }


def _detect_length_uniformity(reviews: list[dict]) -> dict:
    """Check if review lengths are suspiciously uniform."""
    lengths = [len(r.get("text", "").split()) for r in reviews if r.get("text")]
    lengths = [l for l in lengths if l > 0]

    if len(lengths) < 5:
        return {"detected": False, "severity": "low", "score": 85,
                "details": "Not enough reviews for length analysis",
                "stats": {}}

    import math
    mean = sum(lengths) / len(lengths)
    variance = sum((l - mean) ** 2 for l in lengths) / len(lengths)
    std = math.sqrt(variance)
    cv = std / mean if mean > 0 else 0

    stats = {"mean": round(mean, 1), "std": round(std, 1), "cv": round(cv, 2)}

    if cv < 0.2:
        return {"detected": True, "severity": "high", "score": 25,
                "details": f"Review lengths are suspiciously uniform (CV={cv:.2f}, avg {mean:.0f} words)",
                "stats": stats}
    elif cv < 0.35:
        return {"detected": True, "severity": "medium", "score": 55,
                "details": f"Review lengths show low variance (CV={cv:.2f}, avg {mean:.0f} words)",
                "stats": stats}
    else:
        return {"detected": False, "severity": "low", "score": 85,
                "details": f"Review lengths show natural variance (CV={cv:.2f})",
                "stats": stats}


def _detect_phrase_repetition(reviews: list[dict]) -> dict:
    """Find suspiciously repeated phrases across different reviews."""
    import re
    from collections import Counter, defaultdict

    # Extract 3-grams and 4-grams per review
    stopwords = {"the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
                 "have", "has", "had", "do", "does", "did", "will", "would", "could",
                 "should", "may", "might", "shall", "can", "to", "of", "in", "for",
                 "on", "with", "at", "by", "from", "as", "into", "through", "and",
                 "but", "or", "so", "if", "it", "its", "this", "that", "i", "my", "me"}

    phrase_reviews = defaultdict(set)  # phrase -> set of review indices

    for i, r in enumerate(reviews):
        text = r.get("text", "").lower()
        words = re.findall(r'\b[a-z]+\b', text)
        words = [w for w in words if w not in stopwords and len(w) > 2]

        # 3-grams and 4-grams
        for n in (3, 4):
            for j in range(len(words) - n + 1):
                phrase = " ".join(words[j:j + n])
                phrase_reviews[phrase].add(i)

    # Filter: phrases in 3+ different reviews
    min_reviews = max(3, len(reviews) // 5)
    repeated = [(phrase, indices) for phrase, indices in phrase_reviews.items()
                if len(indices) >= min_reviews]
    repeated.sort(key=lambda x: len(x[1]), reverse=True)

    # Deduplicate overlapping phrases (keep longer ones)
    seen_words = set()
    final_phrases = []
    for phrase, indices in repeated[:20]:
        words_set = frozenset(phrase.split())
        if not words_set.issubset(seen_words):
            final_phrases.append({
                "phrase": phrase,
                "count": len(indices),
                "reviewIndices": sorted(indices),
            })
            seen_words.update(words_set)
        if len(final_phrases) >= 8:
            break

    if not final_phrases:
        return {"detected": False, "severity": "low", "score": 90,
                "details": "No suspicious phrase repetition detected",
                "repeatedPhrases": []}

    max_count = max(p["count"] for p in final_phrases)
    repeat_rate = max_count / len(reviews) if reviews else 0

    if repeat_rate > 0.5:
        severity = "high"
    elif repeat_rate > 0.3:
        severity = "medium"
    else:
        severity = "low"

    score = max(15, 100 - int(repeat_rate * 150) - len(final_phrases) * 5)
    flagged = sorted(set(idx for p in final_phrases for idx in p["reviewIndices"]))

    return {
        "detected": True, "severity": severity, "score": score,
        "details": f"{len(final_phrases)} phrase(s) repeated across multiple reviews",
        "flaggedIndices": flagged,
        "repeatedPhrases": final_phrases,
    }


def _compute_trust_score(detections: dict) -> tuple[int, str]:
    """Weighted average of detection scores -> overall trust score & label."""
    weights = {
        "reviewBurst": 0.20,
        "ratingDistribution": 0.20,
        "duplicateContent": 0.20,
        "ratingSentimentMismatch": 0.15,
        "phraseRepetition": 0.15,
        "lengthUniformity": 0.10,
    }
    total_score = sum(detections[k]["score"] * w for k, w in weights.items())
    trust = round(total_score)

    if trust >= 80:
        label = "High Trust"
    elif trust >= 60:
        label = "Moderate Trust"
    elif trust >= 40:
        label = "Low Trust"
    else:
        label = "Very Low Trust"

    return trust, label


@app.route("/ml/product-trust-report", methods=["POST"])
def product_trust_report():
    data = request.get_json()
    if not data or "reviews" not in data or not isinstance(data["reviews"], list):
        return jsonify({"error": "reviews array is required"}), 400

    reviews = data["reviews"]
    if len(reviews) < 3:
        return jsonify({"error": "At least 3 reviews required for trust analysis"}), 400

    logger.info("Generating product trust report for %d reviews...", len(reviews))

    detections = {
        "reviewBurst": _detect_review_bursts(reviews),
        "ratingDistribution": _detect_rating_anomaly(reviews),
        "ratingSentimentMismatch": _detect_rating_sentiment_mismatch(reviews),
        "duplicateContent": _detect_duplicates(reviews),
        "lengthUniformity": _detect_length_uniformity(reviews),
        "phraseRepetition": _detect_phrase_repetition(reviews),
    }

    trust_score, trust_label = _compute_trust_score(detections)

    logger.info("Trust report complete: score=%d, label=%s", trust_score, trust_label)

    return jsonify({
        "trustScore": trust_score,
        "trustLabel": trust_label,
        "totalReviews": len(reviews),
        "detections": detections,
    })


@app.route("/health", methods=["GET"])
def health():
    load_models()
    return jsonify({
        "status": "UP",
        "models": {
            "sentiment": _sentiment_predictor is not None,
            "rating": _rating_predictor is not None,
            "aiGenerated": _ai_predictor is not None,
            "keywords": _keybert_model is not None,
        },
    })


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 5001))
    logger.info("Starting ML inference service on port %d", port)
    load_models()
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
