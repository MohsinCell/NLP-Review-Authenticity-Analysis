from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from bs4 import BeautifulSoup


_RE_FIRST_NUMBER = re.compile(r"(\d+(?:\.\d+)?)")

# Patterns for common embedded JSON data blocks in script tags.
_EMBEDDED_JSON_PATTERNS = [
    re.compile(r"window\.__INITIAL_STATE__\s*=\s*"),
    re.compile(r"window\.__NEXT_DATA__\s*=\s*"),
    re.compile(r"window\.__data\s*=\s*"),
    re.compile(r"__PRELOADED_STATE__\s*=\s*"),
    re.compile(r"window\.pageDataV4\s*=\s*"),
    re.compile(r"window\.__STORE_STATE__\s*=\s*"),
    re.compile(r"window\.__APOLLO_STATE__\s*=\s*"),
    re.compile(r"window\.__myx\s*=\s*"),
]

# Keys in JSON that likely hold review text.
_REVIEW_TEXT_KEYS = (
    "reviewBody", "body", "text", "review_text", "reviewText",
    "comment", "description", "content", "review_comment",
    "reviewDescription", "value", "reviewContent",
)

# Keys in JSON that likely hold a numeric rating.
_REVIEW_RATING_KEYS = (
    "rating", "ratingValue", "stars", "star_rating", "starRating",
    "overall_rating", "overallRating", "score", "overall",
)


@dataclass(frozen=True)
class Review:
    """A single product review."""

    text: str
    rating: float
    review_id: str = ""
    date: str = ""


@dataclass
class ProductMeta:
    """Product metadata extracted during scraping.

    The Chrome extension renders a product card from these fields.
    All fields are optional -- parsers fill in what they can.
    """

    name: str = ""
    brand: str = ""
    price: str = ""
    image_url: str = ""
    overall_rating: Optional[float] = None
    platform: str = ""

    def to_dict(self) -> dict:
        """Serialize to the JSON shape the Chrome extension expects."""
        return {
            "name": self.name,
            "brand": self.brand,
            "price": self.price,
            "image_url": self.image_url,
            "overall_rating": self.overall_rating,
            "platform": self.platform,
        }


class BaseParser(ABC):
    """Base class for per-site review parsers."""

    #: Human-readable site name.
    name: str = "base"
    #: Hostname suffixes (e.g., ("flipkart.com",)).
    domains: tuple[str, ...] = ()
    #: If True, prefer Selenium-rendered HTML.
    requires_js: bool = False
    #: If True, the site uses infinite scroll instead of URL/click pagination.
    uses_infinite_scroll: bool = False
    #: If True, this parser supports direct API fetching (try before Selenium).
    has_api: bool = False

    def match(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return any(host == d or host.endswith("." + d) for d in self.domains)

    def parse_product_meta(self, html: str, *, url: str) -> Optional[ProductMeta]:
        """Extract product metadata (name, brand, price, image, rating) from HTML.

        Override in subclasses.  Returns None if metadata cannot be extracted.
        The ``platform`` field is auto-filled from ``self.name`` if not set.
        """
        return None

    @abstractmethod
    def parse(self, html: str, *, url: str) -> list[Review]:
        """Extract reviews from a single fetched HTML page."""

    def normalize_url(self, url: str) -> str:
        """Convert a product page URL to the optimal reviews URL.

        Override in subclasses for site-specific URL transformations.
        """
        return url

    def get_next_page_url(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """Return the URL for the next page of reviews, or None."""
        return None

    def get_next_page_selenium_selector(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """Return a CSS selector for a "next page" control (Selenium mode).

        Some sites only paginate reliably when navigating via in-page controls
        (e.g., clicking "Next"), rather than doing a fresh `driver.get(next_url)`.
        When provided, callers can click this selector on the currently loaded
        page and then re-parse the updated DOM.
        """

        return None

    def get_api_request(
        self, url: str, page: int = 1
    ) -> Optional[dict]:
        """Return API request parameters for direct HTTP fetching.

        Returns a dict with keys:
          - url: the API endpoint
          - headers: (optional) extra headers
          - params: (optional) query parameters
          - referer: (optional) referer URL

        Returns None if this parser does not support API fetching.
        """
        return None

    def parse_api_response(self, text: str, *, url: str) -> list["Review"]:
        """Parse reviews from an API response (usually JSON).

        Default implementation delegates to parse() which handles JSON
        via embedded-script / JSON-LD fallbacks.  Override for site-specific
        API response formats.
        """
        return self.parse(text, url=url)

    def api_has_next_page(self, text: str, current_page: int) -> bool:
        """Return True if the API response indicates more pages exist."""
        return False

    def get_review_url_batches(self, url: str) -> list[str]:
        """Return base URLs to scrape for comprehensive review coverage.

        By default returns just the normalized URL.  Override in subclasses
        to add extra URLs (e.g. per-star-rating filters) for sites that cap
        pagination depth.
        """
        return [self.normalize_url(url)]

    # ------------------------------------------------------------------
    # Soup helpers
    # ------------------------------------------------------------------

    def _soup(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "html.parser")

    @staticmethod
    def _clean_text(text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        # Drop common UI affordances that sometimes get included in extracted text.
        text = re.sub(r"\b(read more|read less)\b", "", text, flags=re.IGNORECASE).strip()
        return text

    @staticmethod
    def _first_text(node: Any, selectors: Iterable[str]) -> str:
        """Return the first non-empty text for any of the selectors."""

        for sel in selectors:
            el = node.select_one(sel)
            if el is None:
                continue
            txt = el.get_text(" ", strip=True)
            txt = BaseParser._clean_text(txt)
            if txt:
                return txt
        return ""

    @staticmethod
    def _parse_rating(text: str) -> Optional[float]:
        """Best-effort rating parsing from strings like '4.5 out of 5'."""

        if not text:
            return None
        m = _RE_FIRST_NUMBER.search(text)
        if not m:
            return None
        try:
            rating = float(m.group(1))
        except ValueError:
            return None
        # Most sites use a 1-5 scale. Keep only plausible values.
        if 0.0 <= rating <= 5.0:
            return rating
        return None

    # ------------------------------------------------------------------
    # JSON-LD extraction (existing)
    # ------------------------------------------------------------------

    def _extract_reviews_from_json_ld(self, soup: BeautifulSoup) -> list[Review]:
        """Extract reviews from JSON-LD blocks when present."""

        reviews: list[Review] = []
        for script in soup.select('script[type="application/ld+json"]'):
            raw = (script.string or "").strip()
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            for obj in self._iter_json(payload):
                reviews.extend(self._reviews_from_json_obj(obj))
        return self._dedupe(reviews)

    def _iter_json(self, payload: Any) -> Iterable[dict[str, Any]]:
        """Yield dict objects from JSON payloads (list/object/graph)."""

        if isinstance(payload, dict):
            yield payload
            graph = payload.get("@graph")
            if isinstance(graph, list):
                for item in graph:
                    if isinstance(item, dict):
                        yield item
            return
        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict):
                    yield item

    def _reviews_from_json_obj(self, obj: dict[str, Any]) -> list[Review]:
        raw_reviews = obj.get("review")
        if raw_reviews is None:
            return []

        candidates: list[dict[str, Any]] = []
        if isinstance(raw_reviews, dict):
            candidates = [raw_reviews]
        elif isinstance(raw_reviews, list):
            candidates = [r for r in raw_reviews if isinstance(r, dict)]

        out: list[Review] = []
        for r in candidates:
            text = r.get("reviewBody") or r.get("description") or r.get("text")
            if isinstance(text, dict):
                text = next((v for v in text.values() if isinstance(v, str)), "")

            rating_val: Any = None
            rr = r.get("reviewRating")
            if isinstance(rr, dict):
                rating_val = rr.get("ratingValue")
            elif isinstance(r.get("reviewRating"), (int, float, str)):
                rating_val = r.get("reviewRating")

            text_s = self._clean_text(str(text)) if isinstance(text, str) else ""
            rating_s = str(rating_val) if rating_val is not None else ""
            rating = self._parse_rating(rating_s)
            if text_s and rating is not None:
                out.append(Review(text=text_s, rating=rating))
        return out

    # ------------------------------------------------------------------
    # Embedded-script JSON extraction (new)
    # ------------------------------------------------------------------

    def _extract_from_embedded_scripts(self, soup: BeautifulSoup) -> list[Review]:
        """Search <script> tags for embedded JSON containing review data."""

        reviews: list[Review] = []
        for script in soup.find_all("script"):
            raw = script.string or ""
            if not raw or len(raw) < 100:
                continue

            # Named script tags with JSON content (e.g. __NEXT_DATA__).
            script_id = str(script.get("id") or "").lower()
            if script_id in ("__next_data__", "jsonld", "productschema", "is_script"):
                stripped = raw.strip()
                try:
                    data = json.loads(stripped)
                    reviews.extend(self._deep_find_reviews(data))
                except json.JSONDecodeError:
                    pass
                continue

            # Known embedded-JSON assignment patterns.
            for pattern in _EMBEDDED_JSON_PATTERNS:
                match = pattern.search(raw)
                if match:
                    json_str = self._extract_json_value(raw, match.end())
                    if json_str:
                        try:
                            data = json.loads(json_str)
                            reviews.extend(self._deep_find_reviews(data))
                        except json.JSONDecodeError:
                            pass

        return self._dedupe(reviews)

    @staticmethod
    def _extract_json_value(text: str, start: int) -> Optional[str]:
        """Extract a JSON object or array starting at *start* in *text*."""

        # Skip whitespace.
        while start < len(text) and text[start] in " \t\n\r":
            start += 1
        if start >= len(text):
            return None

        opener = text[start]
        if opener not in ("{", "["):
            return None
        closer = "}" if opener == "{" else "]"

        depth = 0
        in_string = False
        escape_next = False
        # Cap search to avoid scanning megabytes of minified JS.
        end = min(start + 5_000_000, len(text))
        for i in range(start, end):
            c = text[i]
            if escape_next:
                escape_next = False
                continue
            if c == "\\" and in_string:
                escape_next = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == opener:
                depth += 1
            elif c == closer:
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
        return None

    def _deep_find_reviews(self, data: Any, depth: int = 0) -> list[Review]:
        """Recursively search a JSON structure for review-like objects."""

        if depth > 12 or data is None:
            return []
        reviews: list[Review] = []
        if isinstance(data, dict):
            rev = self._try_as_review(data)
            if rev:
                reviews.append(rev)
            for val in data.values():
                if isinstance(val, (dict, list)) and len(reviews) < 500:
                    reviews.extend(self._deep_find_reviews(val, depth + 1))
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, (dict, list)) and len(reviews) < 500:
                    reviews.extend(self._deep_find_reviews(item, depth + 1))
        return reviews

    def _try_as_review(self, d: dict) -> Optional[Review]:
        """Attempt to interpret a single dict as a review."""

        text: Optional[str] = None
        for k in _REVIEW_TEXT_KEYS:
            v = d.get(k)
            if isinstance(v, str) and len(v.strip()) >= 10:
                text = self._clean_text(v)
                break

        rating: Optional[float] = None
        # Nested reviewRating (JSON-LD style).
        rr = d.get("reviewRating")
        if isinstance(rr, dict):
            rv = rr.get("ratingValue")
            if rv is not None:
                rating = self._parse_rating(str(rv))
        # Flat rating keys.
        if rating is None:
            for k in _REVIEW_RATING_KEYS:
                v = d.get(k)
                if v is not None and not isinstance(v, (dict, list)):
                    rating = self._parse_rating(str(v))
                    if rating is not None:
                        break

        if text and rating is not None:
            return Review(text=text, rating=rating)
        return None

    # ------------------------------------------------------------------
    # URL helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _update_query_param(url: str, param: str, value: str) -> str:
        """Update or add a query parameter to a URL."""

        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)
        params[param] = [value]
        new_query = urlencode(params, doseq=True)
        return urlunparse(parsed._replace(query=new_query))

    # ------------------------------------------------------------------
    # Deduplication
    # ------------------------------------------------------------------

    @staticmethod
    def _text_fingerprint(text: str) -> str:
        """Normalize text for fuzzy dedup (catches truncation & whitespace diffs)."""
        return re.sub(r"[^a-z0-9]", "", text.lower())[:150]

    @staticmethod
    def _dedupe(reviews: list[Review]) -> list[Review]:
        seen_ids: set[str] = set()
        seen_fp: set[tuple[str, float]] = set()
        out: list[Review] = []
        for r in reviews:
            # Prefer review_id (unique per customer) for dedup.
            # Fall back to fingerprint(text, rating) when no id is available.
            if r.review_id:
                if r.review_id in seen_ids:
                    continue
                seen_ids.add(r.review_id)
            else:
                key = (BaseParser._text_fingerprint(r.text), r.rating)
                if key in seen_fp:
                    continue
                seen_fp.add(key)
            out.append(r)
        return out
