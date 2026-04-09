from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from review_scraper.core.parser_base import BaseParser, ProductMeta, Review


class MyntraParser(BaseParser):
    name = "myntra"
    domains = ("myntra.com",)
    requires_js = True
    # "API" here means SSR page fetch -- not a real JSON API.  Myntra's
    # internal v1/v2 review APIs are dead (401/404), but the SSR reviews
    # page at /reviews/{pid}?page=N embeds review data in window.__myx.
    has_api = True

    # Product ID is a numeric string (6-15 digits) in the URL path.
    _PRODUCT_ID_RE = re.compile(r"/(\d{6,15})(?:/buy|/reviews|$|[?#])")

    # Reviews per SSR page load.
    _PAGE_SIZE = 12

    # Pattern to extract window.__myx JSON from SSR HTML.
    _MYX_RE = re.compile(r"window\.__myx\s*=\s*({.+?})\s*;?\s*</script>", re.DOTALL)

    _MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*"
    _DATE_RE = re.compile(
        rf"({_MONTH}\s+\d{{1,2}},?\s+\d{{4}}"
        rf"|{_MONTH},?\s+\d{{4}}"
        rf"|\d{{1,2}}\s+{_MONTH},?\s+\d{{4}}"
        rf"|\d{{4}}-\d{{2}}-\d{{2}})",
        re.IGNORECASE,
    )

    # ------------------------------------------------------------------
    # URL helpers
    # ------------------------------------------------------------------

    @classmethod
    def _extract_product_id(cls, url: str) -> str:
        m = cls._PRODUCT_ID_RE.search(url)
        return m.group(1) if m else ""

    def normalize_url(self, url: str) -> str:
        """Convert any Myntra product URL to the dedicated reviews page."""
        pid = self._extract_product_id(url)
        if not pid:
            return url
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}/reviews/{pid}"

    def get_review_url_batches(self, url: str) -> list[str]:
        """Return the Myntra reviews page URL for browser fallback."""
        return [self.normalize_url(url)]

    # ------------------------------------------------------------------
    # Product metadata extraction
    # ------------------------------------------------------------------

    def parse_product_meta(self, html: str, *, url: str):
        """Extract product metadata from Myntra's window.__myx SSR data.

        The pdpData object in __myx contains:
          - name, brand, mrp/price, searchImage, ratings.averageRating
        """
        myx = self._extract_myx(html)
        if not myx:
            return None

        pdp = myx.get("pdpData", {})
        if not isinstance(pdp, dict):
            return None

        name = pdp.get("name", "") or pdp.get("productName", "")
        brand = ""
        brand_obj = pdp.get("brand", {})
        if isinstance(brand_obj, dict):
            brand = brand_obj.get("name", "") or brand_obj.get("brandName", "")
        elif isinstance(brand_obj, str):
            brand = brand_obj
        if not brand:
            brand = pdp.get("brandName", "")

        price = ""
        p = pdp.get("mrp") or pdp.get("price", {})
        if isinstance(p, dict):
            mrp = p.get("mrp") or p.get("value")
            currency = p.get("currency", "INR")
            if mrp:
                price = f"{currency} {mrp}".strip()
        elif p:
            price = f"INR {p}"
        # Also check discounted price.
        dp = pdp.get("discountedPrice") or pdp.get("price")
        if isinstance(dp, (int, float)) and dp > 0 and not price:
            price = f"INR {dp}"

        image_url = pdp.get("searchImage", "") or pdp.get("image", "")
        # Myntra sometimes nests images in various structures.
        if not image_url:
            media = pdp.get("media", {})
            if isinstance(media, dict):
                albums = media.get("albums", [])
                if isinstance(albums, list) and albums:
                    first = albums[0]
                    if isinstance(first, dict):
                        image_url = first.get("image", "") or first.get("url", "")
                # media.images -- another variant seen on some pages
                if not image_url:
                    images = media.get("images", [])
                    if isinstance(images, list) and images:
                        first = images[0]
                        if isinstance(first, dict):
                            image_url = first.get("imageURL", "") or first.get("src", "") or first.get("url", "")
                        elif isinstance(first, str):
                            image_url = first
        # Try defaultImage, thumbnailImage, landingPageImage fields.
        if not image_url:
            for img_key in ("defaultImage", "thumbnailImage", "landingPageImage",
                            "styleImages", "productImage"):
                v = pdp.get(img_key)
                if isinstance(v, str) and v:
                    image_url = v
                    break
                if isinstance(v, dict):
                    # styleImages can be {"default": {"imageURL": "..."}}
                    for sub_v in v.values():
                        if isinstance(sub_v, dict):
                            url_val = sub_v.get("imageURL", "") or sub_v.get("url", "")
                            if url_val:
                                image_url = url_val
                                break
                        elif isinstance(sub_v, str) and sub_v.startswith("http"):
                            image_url = sub_v
                            break
                    if image_url:
                        break
        # Construct from Myntra CDN pattern if we have style ID but no image.
        if not image_url:
            style_id = pdp.get("id") or pdp.get("styleId")
            if style_id:
                # Myntra CDN pattern: https://assets.myntassets.com/h_720,q_90,w_540/{styleId}/{n}.jpg
                image_url = f"https://assets.myntassets.com/h_720,q_90,w_540/{style_id}/1.jpg"

        # Fall back to OG tags from the full HTML.
        if not image_url and html:
            soup = self._soup(html)
            og_img = soup.select_one('meta[property="og:image"]')
            if og_img:
                image_url = og_img.get("content", "").strip()

        overall_rating = None
        ratings = pdp.get("ratings", {})
        if isinstance(ratings, dict):
            avg = ratings.get("averageRating")
            if avg is not None:
                overall_rating = self._parse_rating(str(avg))

        if not name:
            return None

        return ProductMeta(
            name=name,
            brand=brand,
            price=price,
            image_url=image_url,
            overall_rating=overall_rating,
            platform="Myntra",
        )

    # ------------------------------------------------------------------
    # API-first methods (SSR page fetch with window.__myx parsing)
    # ------------------------------------------------------------------

    def get_api_request(self, url: str, page: int = 1) -> Optional[dict]:
        """Build a request for the Myntra SSR reviews page.

        Myntra's /reviews/{pid}?page=N page embeds review data in the
        ``window.__myx`` JavaScript object.  We fetch this as a normal
        HTML page via httpx (no browser needed) and parse the embedded JSON.
        """
        pid = self._extract_product_id(url)
        if not pid:
            return None

        api_url = f"https://www.myntra.com/reviews/{pid}"
        params = {}
        if page > 1:
            params["page"] = str(page)

        return {
            "url": api_url,
            "params": params if params else None,
            "headers": {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-IN,en;q=0.9",
            },
            "referer": f"https://www.myntra.com/reviews/{pid}",
        }

    def parse_api_response(self, text: str, *, url: str) -> list[Review]:
        """Parse reviews from Myntra SSR page HTML (window.__myx).

        Two sources of reviews in __myx:
          1. reviewsData.reviews -- primary list (~12 per page)
          2. pdpData.ratings.reviewInfo.topReviews -- top reviews (page 1 only)
        """
        # Try as JSON first (in case someone passes raw JSON).
        stripped = text.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                data = json.loads(stripped)
                reviews = self._parse_json_reviews(data)
                if reviews:
                    return self._dedupe(reviews)
            except json.JSONDecodeError:
                pass

        # Extract window.__myx from HTML.
        myx = self._extract_myx(text)
        if not myx:
            return []

        all_reviews: list[Review] = []

        # Source 1: reviewsData.reviews (primary, 12 per page)
        rd = myx.get("reviewsData", {})
        if isinstance(rd, dict):
            review_list = rd.get("reviews", [])
            if isinstance(review_list, list):
                for item in review_list:
                    rev = self._parse_myx_review(item)
                    if rev:
                        all_reviews.append(rev)

        # Source 2: pdpData.ratings.reviewInfo.topReviews (supplementary)
        pdp = myx.get("pdpData", {})
        if isinstance(pdp, dict):
            ratings = pdp.get("ratings", {})
            if isinstance(ratings, dict):
                ri = ratings.get("reviewInfo", {})
                if isinstance(ri, dict):
                    for item in ri.get("topReviews", []):
                        rev = self._parse_top_review(item)
                        if rev:
                            all_reviews.append(rev)

        return self._dedupe(all_reviews)

    def api_has_next_page(self, text: str, current_page: int) -> bool:
        """Check if more review pages exist.

        Uses reviewsCount from pdpData.ratings.reviewInfo (total reviews
        with text) and the known page size of 12.
        """
        myx = self._extract_myx(text)
        if not myx:
            # If we can't parse __myx, check if the response had any reviews
            # via the parsed result (conservative: stop).
            return False

        total = self._get_total_reviews(myx)
        if total <= 0:
            return False
        return current_page * self._PAGE_SIZE < total

    # ------------------------------------------------------------------
    # __myx extraction and review parsing
    # ------------------------------------------------------------------

    @classmethod
    def _extract_myx(cls, html: str) -> dict | None:
        """Extract and parse the window.__myx JSON from HTML."""
        m = cls._MYX_RE.search(html)
        if not m:
            return None
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            return None

    @classmethod
    def _get_total_reviews(cls, myx: dict) -> int:
        """Get total review count (reviews with text) from __myx."""
        pdp = myx.get("pdpData", {})
        if not isinstance(pdp, dict):
            return 0
        ratings = pdp.get("ratings", {})
        if not isinstance(ratings, dict):
            return 0
        ri = ratings.get("reviewInfo", {})
        if isinstance(ri, dict):
            rc = ri.get("reviewsCount", 0)
            if rc:
                try:
                    return int(rc)
                except (ValueError, TypeError):
                    pass
        # Fallback to totalCount (total ratings, not just reviews with text).
        tc = ratings.get("totalCount", 0)
        if isinstance(tc, int) and tc > 0:
            return tc
        return 0

    def _parse_myx_review(self, item) -> Review | None:
        """Parse a review from reviewsData.reviews entry.

        Fields: id, userRating, review, userName, updatedAt, images, ...
        """
        if not isinstance(item, dict):
            return None

        text = ""
        for k in ("review", "reviewText", "text", "description", "content"):
            v = item.get(k)
            if isinstance(v, str) and len(v.strip()) >= 2:
                text = self._clean_text(v)
                break

        if not text:
            return None

        rating = None
        for k in ("userRating", "rating", "overallRating", "stars"):
            v = item.get(k)
            if v is not None and not isinstance(v, (dict, list)):
                rating = self._parse_rating(str(v))
                if rating is not None:
                    break

        if rating is None:
            return None

        review_id = ""
        for k in ("id", "reviewId", "review_id"):
            v = item.get(k)
            if v:
                review_id = str(v)
                break

        date = self._parse_myx_date(item)

        return Review(text=text, rating=rating, review_id=review_id, date=date)

    def _parse_top_review(self, item) -> Review | None:
        """Parse a review from pdpData.ratings.reviewInfo.topReviews.

        Fields: reviewId, userName, reviewText, userRating, timestamp, ...
        """
        if not isinstance(item, dict):
            return None

        text = ""
        for k in ("reviewText", "review", "text", "description"):
            v = item.get(k)
            if isinstance(v, str) and len(v.strip()) >= 2:
                text = self._clean_text(v)
                break

        if not text:
            return None

        rating = None
        for k in ("userRating", "rating"):
            v = item.get(k)
            if v is not None and not isinstance(v, (dict, list)):
                rating = self._parse_rating(str(v))
                if rating is not None:
                    break

        if rating is None:
            return None

        review_id = str(item.get("reviewId", ""))
        date = self._parse_myx_date(item)

        return Review(text=text, rating=rating, review_id=review_id, date=date)

    @staticmethod
    def _parse_myx_date(item: dict) -> str:
        """Extract date from a __myx review item.

        Myntra uses epoch millisecond timestamps (e.g. "1759734483000")
        in the ``timestamp`` or ``updatedAt`` field.
        """
        for k in ("timestamp", "updatedAt", "createdAt", "date", "createdOn"):
            v = item.get(k)
            if not v:
                continue
            s = str(v)
            # Epoch milliseconds
            if s.isdigit() and len(s) >= 13:
                try:
                    dt = datetime.fromtimestamp(int(s) / 1000, tz=timezone.utc)
                    return dt.strftime("%Y-%m-%d")
                except (ValueError, OSError):
                    pass
            # ISO date
            if "T" in s:
                return s.split("T")[0]
            # Already formatted
            if re.match(r"\d{4}-\d{2}-\d{2}", s):
                return s
        return ""

    # ------------------------------------------------------------------
    # Legacy JSON API parsing (kept for compatibility)
    # ------------------------------------------------------------------

    def _parse_json_reviews(self, data) -> list[Review]:
        """Parse reviews from a legacy JSON API response."""
        review_list = self._find_review_list(data)

        if not review_list:
            return self._deep_find_reviews(data)

        reviews: list[Review] = []
        for item in review_list:
            if not isinstance(item, dict):
                continue

            text = self._extract_json_text(item)
            rating = self._extract_json_rating(item)
            review_id = self._extract_json_id(item)
            date = self._extract_json_date(item)

            if text and rating is not None:
                reviews.append(
                    Review(text=text, rating=rating, review_id=review_id, date=date)
                )

        return reviews

    @staticmethod
    def _find_review_list(data) -> list | None:
        """Locate the reviews array in a JSON response."""
        _KEYS = ("reviews", "data", "results", "items", "userReviews", "ratings")

        if isinstance(data, list) and data:
            return data

        if isinstance(data, dict):
            for key in _KEYS:
                val = data.get(key)
                if isinstance(val, list) and val:
                    return val
            # One level of nesting.
            for outer in ("response", "result", "body", "payload"):
                sub = data.get(outer)
                if isinstance(sub, dict):
                    for key in _KEYS:
                        val = sub.get(key)
                        if isinstance(val, list) and val:
                            return val
        return None

    def _extract_json_text(self, item: dict) -> str:
        for k in (
            "text", "reviewText", "description", "body", "content",
            "review", "comment", "reviewBody", "reviewContent", "value",
        ):
            v = item.get(k)
            if isinstance(v, str) and len(v.strip()) >= 10:
                return self._clean_text(v)
        return ""

    def _extract_json_rating(self, item: dict) -> float | None:
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

    @staticmethod
    def _extract_json_id(item: dict) -> str:
        for k in ("id", "reviewId", "review_id", "uid"):
            v = item.get(k)
            if v:
                return str(v)
        return ""

    @staticmethod
    def _extract_json_date(item: dict) -> str:
        for k in (
            "createdAt", "date", "reviewDate", "created",
            "timestamp", "postedOn", "createdOn",
        ):
            v = item.get(k)
            if v:
                s = str(v)
                if "T" in s:
                    s = s.split("T")[0]
                return s
        return ""

    # ------------------------------------------------------------------
    # URL pagination helpers
    # ------------------------------------------------------------------

    def normalize_url(self, url: str) -> str:
        """Convert any Myntra product URL to the dedicated reviews page."""
        pid = self._extract_product_id(url)
        if not pid:
            return url
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}/reviews/{pid}"

    def get_next_page_url(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """Pagination is handled by the API phase via ?page=N."""
        return None

    def get_next_page_selenium_selector(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """Find a clickable "Next" pagination control (browser fallback)."""
        soup = self._soup(html)

        _NEXT_SELECTORS = (
            '[class*="pagination-next"]',
            '[class*="paginationNext"]',
            '[class*="arrowRight"]',
            '[class*="arrow-right"]',
            'a[aria-label="Next"]',
            'button[aria-label="Next"]',
            '[class*="pagination"] [class*="next"]',
        )
        for sel in _NEXT_SELECTORS:
            el = soup.select_one(sel)
            if el and not el.get("disabled"):
                return sel

        for nav in soup.find_all(["nav", "div", "ul"]):
            nav_cls = " ".join(nav.get("class", []))
            if not re.search(r"(pagination|paging|page-nav)", nav_cls, re.IGNORECASE):
                continue
            for child in nav.find_all(["a", "button", "li"]):
                child_text = child.get_text(strip=True).lower()
                if child_text in ("next", ">", "›", "»", "next page"):
                    child_cls = child.get("class")
                    if child_cls:
                        return f"{child.name}.{'.'.join(child_cls)}"
                    return None

        return None

    # ------------------------------------------------------------------
    # HTML parsing (browser fallback -- parse rendered page)
    # ------------------------------------------------------------------

    def parse(self, html: str, *, url: str) -> list[Review]:
        # Try as JSON first (direct API response).
        stripped = html.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                data = json.loads(stripped)
                reviews = self._parse_json_reviews(data)
                if reviews:
                    return self._dedupe(reviews)
            except json.JSONDecodeError:
                pass

        # Try window.__myx extraction (SSR page).
        myx = self._extract_myx(html)
        if myx:
            reviews = self.parse_api_response(html, url=url)
            if reviews:
                return reviews

        soup = self._soup(html)

        # Strategy 1: Embedded script JSON (other patterns).
        reviews = self._extract_from_embedded_scripts(soup)
        if reviews:
            return reviews

        # Strategy 2: JSON-LD structured data.
        reviews = self._extract_reviews_from_json_ld(soup)
        if reviews:
            return reviews

        # Strategy 3: HTML selectors (multiple class-name generations).
        reviews = self._parse_with_selectors(soup)
        if reviews:
            return self._dedupe(reviews)

        # Strategy 4: Structural heuristic parsing.
        reviews = self._parse_structural(soup)
        return self._dedupe(reviews)

    # ------------------------------------------------------------------
    # Strategy 3: CSS selectors
    # ------------------------------------------------------------------

    _CONTAINER_SELECTORS = (
        'div[class*="detailed-reviews-userReview"]',
        'div[class*="userReview"]',
        'div[class*="user-review"]',
        'div[class*="reviewCard"]',
        'div[class*="review-card"]',
        'div[class*="ReviewCard"]',
        'div[class*="userReviewCard"]',
        'div[class*="review-container"]',
        'div[class*="detailed-reviews"] > div > div',
    )

    _TEXT_SELECTORS = (
        '*[class*="reviewText"]',
        '*[class*="review-text"]',
        '*[class*="reviewBody"]',
        '*[class*="review-body"]',
        '*[class*="ReviewText"]',
        '*[class*="reviewContent"]',
        '*[class*="review-content"]',
        '*[class*="user-review-reviewTextWrapper"]',
        "p",
    )

    _RATING_SELECTORS = (
        '*[class*="userRating"]',
        '*[class*="user-rating"]',
        '*[class*="rating"]',
        '*[class*="Rating"]',
        '*[class*="star"]',
        '*[class*="Star"]',
    )

    _DATE_SELECTORS = (
        '*[class*="reviewDate"]',
        '*[class*="review-date"]',
        '*[class*="posted"]',
        '*[class*="Posted"]',
        '*[class*="date"]',
        '*[class*="Date"]',
        "time",
    )

    def _parse_with_selectors(self, soup) -> list[Review]:
        containers = []
        for sel in self._CONTAINER_SELECTORS:
            containers = soup.select(sel)
            if containers:
                break

        if not containers:
            return []

        out: list[Review] = []
        for card in containers:
            text = self._first_text(card, self._TEXT_SELECTORS)
            rating_text = self._first_text(card, self._RATING_SELECTORS)
            date_text = self._first_text(card, self._DATE_SELECTORS)
            rating = self._parse_rating(rating_text)
            if text and rating is not None:
                out.append(Review(text=text, rating=rating, date=date_text))

        return out

    # ------------------------------------------------------------------
    # Strategy 4: Structural / heuristic parsing
    # ------------------------------------------------------------------

    _RE_SINGLE_RATING = re.compile(r"^[1-5]$")

    def _parse_structural(self, soup) -> list[Review]:
        """Find reviews by structural patterns."""
        reviews: list[Review] = []
        seen: set[str] = set()

        for el in soup.find_all(["div", "span"]):
            txt = el.get_text(strip=True)
            if not self._RE_SINGLE_RATING.match(txt):
                continue

            parent = el.parent
            if parent is None:
                continue

            cls = " ".join(el.get("class", []) + (parent.get("class", []) if parent else []))
            has_star = (
                parent.find("svg") is not None
                or re.search(r"(rating|star)", cls, re.IGNORECASE) is not None
            )
            if not has_star:
                continue

            rating = float(txt)

            node = el
            for _ in range(6):
                node = node.parent
                if node is None or node.name in ("body", "html", "[document]"):
                    break
                if len(node.get_text(strip=True)) > 40:
                    break

            if node is None or node.name in ("body", "html", "[document]"):
                continue

            best = ""
            for child in node.find_all(["div", "p", "span"], recursive=True):
                t = child.get_text(" ", strip=True)
                if len(t) > len(best) and len(t) > 15:
                    best = t

            if not best or best in seen:
                continue
            seen.add(best)

            date = ""
            for child in node.find_all(["p", "span", "div", "time"]):
                t = child.get_text(strip=True)
                if t and len(t) < 40:
                    m = self._DATE_RE.search(t)
                    if m:
                        date = m.group(1)
                        break

            reviews.append(Review(text=self._clean_text(best), rating=rating, date=date))

        return reviews
