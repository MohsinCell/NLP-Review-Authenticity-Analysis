from __future__ import annotations

import json
import re
from typing import Optional
from urllib.parse import urlparse

from review_scraper.core.parser_base import BaseParser, ProductMeta, Review


class NykaaParser(BaseParser):
    name = "nykaa"
    domains = ("nykaa.com", "nykaafashion.com")
    requires_js = False
    has_api = True

    # Nykaa's internal review API.
    _API_BASE = "https://www.nykaa.com/gateway-api/products/{product_id}/reviews"

    # Extract product ID from Nykaa URLs:
    #   /product-name/p/12345  →  12345
    #   /product-name/p/12345?...  →  12345
    _PRODUCT_ID_RE = re.compile(r"/p/(\d+)")

    # Also handle Nykaa Fashion URLs:
    #   /brand-name/p/12345678  →  12345678
    _FASHION_ID_RE = re.compile(r"/p/(\d+)")

    # Nykaa sometimes uses SKU IDs in the URL:
    #   ?productId=12345  →  12345
    _QS_ID_RE = re.compile(r"[?&]productId=(\d+)")

    _MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*"
    _DATE_RE = re.compile(
        rf"({_MONTH}\s+\d{{1,2}},?\s+\d{{4}}"
        rf"|\d{{1,2}}\s+{_MONTH},?\s+\d{{4}}"
        rf"|\d{{4}}-\d{{2}}-\d{{2}})",
        re.IGNORECASE,
    )

    @classmethod
    def _extract_product_id(cls, url: str) -> str:
        """Extract product ID from a Nykaa URL."""
        m = cls._PRODUCT_ID_RE.search(url)
        if m:
            return m.group(1)
        m = cls._QS_ID_RE.search(url)
        if m:
            return m.group(1)
        return ""

    # ------------------------------------------------------------------
    # URL helpers
    # ------------------------------------------------------------------

    def normalize_url(self, url: str) -> str:
        return url

    def get_review_url_batches(self, url: str) -> list[str]:
        return [url]

    # ------------------------------------------------------------------
    # Product metadata extraction
    # ------------------------------------------------------------------

    def parse_product_meta(self, html: str, *, url: str):
        """Extract product metadata from a Nykaa page.

        Works from:
          1. JSON-LD (``application/ld+json``)
          2. Open Graph meta tags
          3. Nykaa API JSON response (if text is JSON)
        """
        from typing import Optional

        # If the text is JSON (API response), try extracting from it.
        stripped = html.strip()
        if stripped.startswith("{"):
            try:
                data = json.loads(stripped)
                meta = self._meta_from_api(data)
                if meta:
                    return meta
            except json.JSONDecodeError:
                pass

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

        if not name:
            return None

        return ProductMeta(
            name=name,
            brand=brand,
            price=price,
            image_url=image_url,
            overall_rating=overall_rating,
            platform="Nykaa",
        )

    @classmethod
    def _meta_from_api(cls, data: dict):
        """Try to extract product metadata from a Nykaa API response.

        Some Nykaa API responses include product-level fields like
        productName, brandName, imageUrl, averageRating alongside reviews.
        """
        if not isinstance(data, dict):
            return None

        # Check top level and nested response/data wrappers.
        candidates = [data]
        for k in ("response", "data", "result", "payload"):
            sub = data.get(k)
            if isinstance(sub, dict):
                candidates.append(sub)

        for d in candidates:
            name = d.get("productName") or d.get("name") or d.get("title") or ""
            if not name:
                continue

            brand = d.get("brandName") or d.get("brand") or ""
            price_val = d.get("price") or d.get("mrp") or ""
            price = f"INR {price_val}" if price_val else ""
            image_url = d.get("imageUrl") or d.get("image") or ""
            avg = d.get("averageRating") or d.get("overallRating")
            overall_rating = None
            if avg is not None:
                try:
                    overall_rating = float(avg)
                    if not (0 <= overall_rating <= 5):
                        overall_rating = None
                except (ValueError, TypeError):
                    pass

            return ProductMeta(
                name=name,
                brand=brand if isinstance(brand, str) else "",
                price=price,
                image_url=image_url if isinstance(image_url, str) else "",
                overall_rating=overall_rating,
                platform="Nykaa",
            )

        return None

    # ------------------------------------------------------------------
    # API-first methods
    # ------------------------------------------------------------------

    def get_api_request(self, url: str, page: int = 1) -> Optional[dict]:
        """Build a Nykaa review API request."""
        pid = self._extract_product_id(url)
        if not pid:
            return None

        return {
            "url": self._API_BASE.format(product_id=pid),
            "params": {
                "pageNo": str(page),
                "pageSize": "20",
                "sortBy": "MOST_RECENT",
            },
            "headers": {
                "Origin": "https://www.nykaa.com",
                "X-Requested-With": "XMLHttpRequest",
            },
            "referer": url,
        }

    def parse_api_response(self, text: str, *, url: str) -> list[Review]:
        """Parse reviews from Nykaa's JSON API response."""
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return []

        # Nykaa wraps reviews in response.reviews or response.data or just reviews.
        review_list = self._find_review_list(data)
        if not review_list:
            return self._deep_find_reviews(data)

        reviews: list[Review] = []
        for item in review_list:
            if not isinstance(item, dict):
                continue

            text_val = self._extract_text(item)
            rating = self._extract_rating(item)
            if not text_val or rating is None:
                continue

            review_id = ""
            for k in ("id", "reviewId", "review_id", "_id"):
                v = item.get(k)
                if v:
                    review_id = str(v)
                    break

            date = ""
            for k in ("createdAt", "createdOn", "date", "reviewDate", "created_at"):
                v = item.get(k)
                if v:
                    s = str(v)
                    if "T" in s:
                        s = s.split("T")[0]
                    date = s
                    break

            reviews.append(Review(text=text_val, rating=rating, review_id=review_id, date=date))

        return self._dedupe(reviews)

    def api_has_next_page(self, text: str, current_page: int) -> bool:
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return False
        return self._check_has_more(data, current_page)

    @classmethod
    def _check_has_more(cls, data, current_page: int) -> bool:
        """Check pagination in Nykaa API response."""
        if not isinstance(data, dict):
            return False

        # Direct pagination fields.
        total = (
            data.get("reviewCount") or data.get("totalCount")
            or data.get("total") or data.get("totalReviews")
        )
        if isinstance(total, int) and total > 0:
            page_size = data.get("pageSize") or data.get("size") or 20
            if isinstance(page_size, int):
                return current_page * page_size < total

        has_more = data.get("hasMore") or data.get("hasNextPage")
        if has_more is True:
            return True

        # Check nested response/data wrapper.
        for k in ("response", "data", "result", "payload"):
            sub = data.get(k)
            if isinstance(sub, dict):
                result = cls._check_has_more(sub, current_page)
                if result:
                    return True

        return False

    @staticmethod
    def _find_review_list(data) -> list | None:
        """Locate the reviews array in the JSON response."""
        _KEYS = ("reviewData", "reviews", "data", "results", "items", "userReviews", "reviewList")

        if isinstance(data, list) and data:
            return data

        if isinstance(data, dict):
            for key in _KEYS:
                val = data.get(key)
                if isinstance(val, list) and val:
                    return val
            # One level of nesting (e.g. response.reviewData).
            for outer in ("response", "result", "data", "payload", "body"):
                sub = data.get(outer)
                if isinstance(sub, dict):
                    for key in _KEYS:
                        val = sub.get(key)
                        if isinstance(val, list) and val:
                            return val
                elif isinstance(sub, list) and sub:
                    return sub
        return None

    def _extract_text(self, item: dict) -> str:
        # Nykaa API uses "description" as the main review body text and
        # "title" as a short heading.  Try description first.
        for k in (
            "description", "text", "reviewText", "body", "content",
            "review", "comment", "reviewBody", "reviewContent",
        ):
            v = item.get(k)
            if isinstance(v, str) and len(v.strip()) >= 10:
                return self._clean_text(v)
        # Combine title + description if both exist but description alone is short.
        title = item.get("title", "")
        desc = item.get("description", "")
        if isinstance(title, str) and isinstance(desc, str):
            combined = f"{title.strip()} {desc.strip()}".strip()
            if len(combined) >= 10:
                return self._clean_text(combined)
        # Fall back to title alone if long enough.
        if isinstance(title, str) and len(title.strip()) >= 10:
            return self._clean_text(title)
        return ""

    def _extract_rating(self, item: dict) -> Optional[float]:
        # Nested reviewRating (JSON-LD style).
        rr = item.get("reviewRating")
        if isinstance(rr, dict):
            rv = rr.get("ratingValue")
            if rv is not None:
                return self._parse_rating(str(rv))
        for k in (
            "rating", "userRating", "overallRating", "stars",
            "ratingValue", "starRating", "score",
        ):
            v = item.get(k)
            if v is not None and not isinstance(v, (dict, list)):
                r = self._parse_rating(str(v))
                if r is not None:
                    return r
        return None

    # ------------------------------------------------------------------
    # HTML fallback
    # ------------------------------------------------------------------

    def parse(self, html: str, *, url: str) -> list[Review]:
        # Try JSON first.
        stripped = html.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                return self.parse_api_response(html, url=url)
            except Exception:
                pass

        soup = self._soup(html)

        # Strategy 1: Embedded script JSON.
        reviews = self._extract_from_embedded_scripts(soup)
        if reviews:
            return reviews

        # Strategy 2: JSON-LD.
        reviews = self._extract_reviews_from_json_ld(soup)
        if reviews:
            return reviews

        # Strategy 3: HTML selectors.
        _CONTAINER_SELS = (
            'div[class*="review-card"]',
            'div[class*="reviewCard"]',
            'div[class*="userReview"]',
            'div[class*="review-item"]',
            'div[class*="ReviewItem"]',
            'li[class*="review"]',
        )
        containers = []
        for sel in _CONTAINER_SELS:
            containers = soup.select(sel)
            if containers:
                break

        out: list[Review] = []
        for card in containers:
            text_val = self._first_text(
                card,
                [
                    '*[class*="reviewText"]',
                    '*[class*="review-text"]',
                    '*[class*="reviewBody"]',
                    '*[class*="review-content"]',
                    '*[class*="ReviewText"]',
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
                ],
            )
            rating = self._parse_rating(rating_text)
            if text_val and rating is not None:
                out.append(Review(text=text_val, rating=rating))

        return self._dedupe(out)
