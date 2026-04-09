from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from review_scraper.core.parser_base import BaseParser, ProductMeta, Review


class AjioParser(BaseParser):
    name = "ajio"
    domains = ("ajio.com",)
    requires_js = True
    # AJIO has its own review API at /api/ratings/allReviews (POST).
    # Requires a browser session first (Akamai WAF blocks raw API calls
    # from datacenter IPs), but with proxy it should work.
    has_api = True

    # AJIO's own review API (POST endpoint with JSON body).
    _API_URL = "https://www.ajio.com/api/ratings/allReviews"
    _API_PAGE_SIZE = 20

    # Extract product code from Ajio URLs.
    # IMPORTANT: The review API requires the FULL code including color suffix.
    #   /p/461542908_black  →  461542908_black   (NOT just 461542908)
    #   /p/443098308_olivegreen  →  443098308_olivegreen
    # Numeric-only SKU returns {"size":0,"timeout":15000} (broken response).
    _PRODUCT_CODE_FULL_RE = re.compile(r"/p/(\d+_[A-Za-z0-9]+)")
    _PRODUCT_CODE_NUM_RE = re.compile(r"/p/(\d+)")

    @classmethod
    def _extract_product_code(cls, url: str) -> str:
        # Prefer full code with color suffix (required by the API).
        m = cls._PRODUCT_CODE_FULL_RE.search(url)
        if m:
            return m.group(1)
        # Fallback to numeric-only (will likely fail, but better than empty).
        m = cls._PRODUCT_CODE_NUM_RE.search(url)
        return m.group(1) if m else ""

    # ------------------------------------------------------------------
    # Product metadata extraction
    # ------------------------------------------------------------------

    def parse_product_meta(self, html: str, *, url: str):
        """Extract product metadata from an AJIO product page.

        AJIO is a React app. We extract from:
          1. JSON-LD (``application/ld+json``) -- most reliable
          2. Open Graph meta tags (``og:title``, ``og:image``)
          3. Embedded ``__PRELOADED_STATE__`` or similar SSR data
        """
        from typing import Optional
        soup = self._soup(html)

        name = ""
        brand = ""
        price = ""
        image_url = ""
        overall_rating: Optional[float] = None

        # --- JSON-LD ---
        for script in soup.select('script[type="application/ld+json"]'):
            raw = (script.string or "").strip()
            if not raw:
                continue
            try:
                ld = json.loads(raw)
            except json.JSONDecodeError:
                continue
            items = ld if isinstance(ld, list) else [ld]
            for obj in items:
                if not isinstance(obj, dict):
                    continue
                otype = obj.get("@type", "")
                if otype not in ("Product", "product"):
                    continue
                name = name or obj.get("name", "")
                b = obj.get("brand")
                if isinstance(b, dict):
                    brand = brand or b.get("name", "")
                elif isinstance(b, str):
                    brand = brand or b
                img = obj.get("image")
                if isinstance(img, list) and img:
                    image_url = image_url or str(img[0])
                elif isinstance(img, str):
                    image_url = image_url or img
                offers = obj.get("offers")
                if isinstance(offers, dict) and not price:
                    p = offers.get("price") or offers.get("lowPrice")
                    currency = offers.get("priceCurrency", "INR")
                    if p:
                        price = f"{currency} {p}".strip()
                ar = obj.get("aggregateRating")
                if isinstance(ar, dict) and overall_rating is None:
                    rv = ar.get("ratingValue")
                    if rv is not None:
                        overall_rating = self._parse_rating(str(rv))

        # --- Open Graph fallbacks ---
        if not name:
            el = soup.select_one('meta[property="og:title"]')
            if el:
                name = el.get("content", "").strip()
        if not image_url:
            el = soup.select_one('meta[property="og:image"]')
            if el:
                image_url = el.get("content", "").strip()
        if not brand:
            el = soup.select_one('meta[property="product:brand"]')
            if el:
                brand = el.get("content", "").strip()
        if not price:
            el = soup.select_one('meta[property="product:price:amount"]')
            if el:
                p = el.get("content", "").strip()
                if p:
                    currency_el = soup.select_one('meta[property="product:price:currency"]')
                    cur = currency_el.get("content", "INR") if currency_el else "INR"
                    price = f"{cur} {p}".strip()

        if not name:
            return None

        return ProductMeta(
            name=name,
            brand=brand,
            price=price,
            image_url=image_url,
            overall_rating=overall_rating,
            platform="AJIO",
        )

    # ------------------------------------------------------------------
    # API-first methods (AJIO's own /api/ratings/allReviews)
    # ------------------------------------------------------------------

    def get_api_request(self, url: str, page: int = 1) -> Optional[dict]:
        """Build an AJIO review API request (POST with JSON body)."""
        code = self._extract_product_code(url)
        if not code:
            return None

        return {
            "url": self._API_URL,
            "method": "POST",
            "json_body": {
                "skuId": code,
                "pageNumber": page,
                "reviewWithPhotos": False,
                "verifiedPurchase": False,
                "sortBy": None,
            },
            "headers": {
                "Content-Type": "application/json",
                "Origin": "https://www.ajio.com",
            },
            "referer": url,
        }

    def parse_api_response(self, text: str, *, url: str) -> list[Review]:
        """Parse reviews from AJIO's /api/ratings/allReviews JSON response.

        Response structure:
        {
            "reviewData": {
                "productReviews": [...],
                "totalReviews": 42,
                ...
            }
        }
        """
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return []

        # Navigate to productReviews array.
        review_list = self._find_review_list(data)
        if not review_list:
            return self._deep_find_reviews(data)

        reviews: list[Review] = []
        for item in review_list:
            if not isinstance(item, dict):
                continue

            # Extract review text -- AJIO API uses "reviewText" as the primary key.
            # AJIO reviews are often very short (e.g. "nice", "good"), so use a
            # low minimum length of 2 to avoid dropping valid reviews.
            text_val = ""
            for k in (
                "reviewText", "review", "description", "text", "body",
                "content", "comment", "reviewBody",
            ):
                v = item.get(k)
                if isinstance(v, str) and len(v.strip()) >= 2:
                    text_val = self._clean_text(v)
                    break

            # Combine title + review body if title exists.
            if not text_val:
                title = item.get("title", "")
                desc = item.get("reviewText", "") or item.get("review", "") or item.get("description", "")
                if isinstance(title, str) and isinstance(desc, str):
                    combined = f"{title.strip()} {desc.strip()}".strip()
                    if len(combined) >= 2:
                        text_val = self._clean_text(combined)

            if not text_val:
                continue

            # Extract rating.
            rating = None
            for k in ("rating", "overallRating", "stars", "ratingValue", "score"):
                v = item.get(k)
                if v is not None and not isinstance(v, (dict, list)):
                    rating = self._parse_rating(str(v))
                    if rating is not None:
                        break

            if rating is None:
                continue

            # Extract review ID and date.
            review_id = ""
            for k in ("id", "reviewId", "review_id", "_id"):
                v = item.get(k)
                if v:
                    review_id = str(v)
                    break

            date = ""
            for k in ("createdDate", "createdAt", "createdOn", "date", "posted", "postedDate"):
                v = item.get(k)
                if v:
                    s = str(v)
                    # AJIO returns epoch milliseconds (e.g. "1775543610244").
                    if s.isdigit() and len(s) >= 13:
                        try:
                            dt = datetime.fromtimestamp(int(s) / 1000, tz=timezone.utc)
                            s = dt.strftime("%Y-%m-%d")
                        except (ValueError, OSError):
                            pass
                    elif "T" in s:
                        s = s.split("T")[0]
                    date = s
                    break

            reviews.append(Review(
                text=text_val, rating=rating, review_id=review_id, date=date,
            ))

        return self._dedupe(reviews)

    def api_has_next_page(self, text: str, current_page: int) -> bool:
        """Check if more review pages exist in AJIO API response."""
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return False

        # Total reviews can be in reviewData.totalReviews or top-level.
        total = self._find_total_reviews(data)
        if total <= 0:
            return False
        return current_page * self._API_PAGE_SIZE < total

    @classmethod
    def _find_total_reviews(cls, data) -> int:
        """Find total review count from AJIO API response."""
        if not isinstance(data, dict):
            return 0
        for key in ("totalReviews", "totalCount", "total", "reviewCount"):
            v = data.get(key)
            if isinstance(v, int) and v > 0:
                return v
        # Check inside reviewData wrapper.
        rd = data.get("reviewData")
        if isinstance(rd, dict):
            for key in ("totalReviews", "totalCount", "total"):
                v = rd.get(key)
                if isinstance(v, int) and v > 0:
                    return v
        return 0

    @staticmethod
    def _find_review_list(data) -> list | None:
        """Locate the reviews array in the AJIO API response.

        Expected structure: { "reviewData": { "productReviews": [...] } }
        """
        _KEYS = (
            "productReviews", "reviews", "reviewData", "data",
            "results", "items",
        )

        if isinstance(data, list) and data:
            return data

        if isinstance(data, dict):
            # Direct keys.
            for key in _KEYS:
                val = data.get(key)
                if isinstance(val, list) and val:
                    return val
            # One level of nesting (reviewData.productReviews).
            for outer in ("reviewData", "response", "result", "data", "body"):
                sub = data.get(outer)
                if isinstance(sub, dict):
                    for key in _KEYS:
                        val = sub.get(key)
                        if isinstance(val, list) and val:
                            return val
        return None

    # ------------------------------------------------------------------
    # HTML parsing (fallback when API fails)
    # ------------------------------------------------------------------

    def parse(self, html: str, *, url: str) -> list[Review]:
        # Try as JSON first (in case the response is from an API).
        stripped = html.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                return self.parse_api_response(html, url=url)
            except Exception:
                pass

        soup = self._soup(html)

        # Strategy 1: Embedded script JSON (AJIO uses React + SSR data).
        reviews = self._extract_from_embedded_scripts(soup)
        if reviews:
            return reviews

        # Strategy 2: JSON-LD structured data.
        reviews = self._extract_reviews_from_json_ld(soup)
        if reviews:
            return reviews

        # Strategy 3: HTML selectors.
        # AJIO uses CSS Modules with hashed class names. These selectors
        # target semantic patterns that are more stable across deployments.
        cards = soup.select(
            'div[class*="review"], '
            'li[class*="review"], '
            'div[data-testid*="review"], '
            'div[data-testid="review"], '
            'div[class*="Review"], '
            'div[class*="review-card"], '
            'div[class*="reviewCard"]'
        )

        out: list[Review] = []
        for card in cards:
            text_val = self._first_text(
                card,
                [
                    '*[class*="reviewText"]',
                    '*[class*="review-text"]',
                    '*[class*="reviewBody"]',
                    '*[class*="review-body"]',
                    '*[class*="ReviewText"]',
                    '*[class*="reviewContent"]',
                    '*[class*="review-content"]',
                    '*[class*="details-text"]',
                    '*[data-testid*="review-text"]',
                    "p",
                ],
            )
            rating_text = self._first_text(
                card,
                [
                    '*[class*="rating"]',
                    '*[class*="Rating"]',
                    '*[class*="star"]',
                    '*[class*="Star"]',
                    '*[data-testid*="rating"]',
                ],
            )
            rating = self._parse_rating(rating_text)
            if text_val and rating is not None:
                out.append(Review(text=text_val, rating=rating))

        return self._dedupe(out)
