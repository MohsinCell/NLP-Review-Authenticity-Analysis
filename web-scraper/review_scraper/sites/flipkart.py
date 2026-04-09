from __future__ import annotations

import json
import re
from typing import Optional
from urllib.parse import urlparse

from review_scraper.core.parser_base import BaseParser, ProductMeta, Review


class FlipkartParser(BaseParser):
    name = "flipkart"
    domains = ("flipkart.com",)
    requires_js = True
    has_api = True

    # Flipkart's internal review API (GraphQL-like marketplace endpoint).
    _API_BASE = "https://www.flipkart.com/api/3/page/dynamic/product-reviews"

    _STAR_RATINGS = (5, 4, 3, 2, 1)

    # Month pattern for date extraction (legacy absolute dates).
    _MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*"
    _DATE_RE = re.compile(
        rf"({_MONTH}\s+\d{{1,2}},?\s+\d{{4}}"
        rf"|{_MONTH},?\s+\d{{4}}"
        rf"|\d{{1,2}}\s+{_MONTH},?\s+\d{{4}})",
        re.IGNORECASE,
    )
    # Relative date pattern (React Native layout: "4 months ago").
    _RELATIVE_DATE_RE = re.compile(
        r"(\d+\s+(?:months?|days?|years?|weeks?|hours?|minutes?)\s+ago)",
        re.IGNORECASE,
    )
    # Rating value: "5", "5.0", "4.5", etc. -- standalone or as prefix
    # in the React Native layout ("5.0 • Perfect product!").
    _RE_RATING_VALUE = re.compile(r"^([1-5](?:\.\d)?)$")
    _RE_RATING_PREFIX = re.compile(r"^([1-5](?:\.\d)?)\s*[•·\u2022\u00B7]")

    # ------------------------------------------------------------------
    # Product metadata extraction
    # ------------------------------------------------------------------

    def parse_product_meta(self, html: str, *, url: str):
        """Extract product metadata from a Flipkart product/review page.

        Flipkart's React Native layout makes CSS-based extraction fragile.
        We prefer JSON-LD (``application/ld+json``) first, then fall back
        to Open Graph meta tags which are reliably present.
        """
        from typing import Optional
        soup = self._soup(html)

        name = ""
        brand = ""
        price = ""
        image_url = ""
        overall_rating: Optional[float] = None

        # --- JSON-LD (most reliable on product pages) ---
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
                    currency = offers.get("priceCurrency", "")
                    if p:
                        price = f"{currency} {p}".strip() if currency else str(p)
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
            platform="Flipkart",
        )

    # ------------------------------------------------------------------
    # URL helpers
    # ------------------------------------------------------------------

    def normalize_url(self, url: str) -> str:
        """Convert a Flipkart product page URL to its reviews page URL."""
        parsed = urlparse(url)
        path = parsed.path
        # /p/itmXXX  ->  /product-reviews/itmXXX
        new_path = re.sub(r"/p/(itm\w+)", r"/product-reviews/\1", path)
        if new_path != path:
            from urllib.parse import urlunparse

            return urlunparse(parsed._replace(path=new_path))
        return url

    def get_review_url_batches(self, url: str) -> list[str]:
        """Return unfiltered URL + per-star-filter URLs in two sort orders.

          Batch 0:     all ratings, default sort (most helpful)
          Batch 1-5:   per-star filter (5→1), most recent
          Batch 6-10:  per-star filter (5→1), most helpful

        11 batches total, matching Amazon's strategy.
        """
        base = self.normalize_url(url)
        base = self._update_query_param(base, "page", "1")

        urls = [base]  # Batch 0: all ratings, default sort.

        # Batches 1-5: per-star, most recent.
        for star in self._STAR_RATINGS:
            u = self._update_query_param(base, "rating", str(star))
            u = self._update_query_param(u, "sortOrder", "MOST_RECENT")
            urls.append(u)

        # Batches 6-10: per-star, most helpful.
        for star in self._STAR_RATINGS:
            u = self._update_query_param(base, "rating", str(star))
            u = self._update_query_param(u, "sortOrder", "MOST_HELPFUL")
            urls.append(u)

        return urls

    # Flipkart product-reviews URL → product ID (pid) extraction.
    _PID_RE = re.compile(r"/product-reviews/(itm\w+)")
    _PRODUCT_PID_RE = re.compile(r"pid=([A-Z0-9]+)")

    def _extract_pid(self, url: str) -> str:
        """Extract the Flipkart product ID from a URL."""
        # Try the /product-reviews/itmXXX pattern first.
        m = self._PID_RE.search(url)
        if m:
            return m.group(1)
        # Try pid= query param.
        m = self._PRODUCT_PID_RE.search(url)
        if m:
            return m.group(1)
        return ""

    # ------------------------------------------------------------------
    # API-first methods
    # ------------------------------------------------------------------

    def get_api_request(self, url: str, page: int = 1) -> Optional[dict]:
        """Build a Flipkart API request for reviews."""
        pid = self._extract_pid(url)
        if not pid:
            return None

        # Flipkart's review listing page URL -- used as referer and for
        # the marketplace API's requestContext.
        normalized = self.normalize_url(url)

        return {
            "url": self._API_BASE,
            "params": {
                "requestContext": json.dumps({
                    "productId": pid,
                    "pageNumber": page,
                    "sortOrder": "MOST_RECENT",
                }, separators=(",", ":")),
            },
            "headers": {
                "X-User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Origin": "https://www.flipkart.com",
            },
            "referer": normalized,
        }

    def parse_api_response(self, text: str, *, url: str) -> list[Review]:
        """Parse reviews from Flipkart's API JSON response."""
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return []

        # Flipkart API nests reviews deeply. Use the generic deep-find.
        reviews = self._deep_find_reviews(data)
        if reviews:
            return self._dedupe(reviews)

        # Fallback: maybe the response is HTML after all.
        return self.parse(text, url=url)

    def api_has_next_page(self, text: str, current_page: int) -> bool:
        """Check if more review pages exist in Flipkart API response."""
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return False

        # Walk the response looking for pagination info.
        return self._check_pagination_deep(data, current_page)

    @classmethod
    def _check_pagination_deep(cls, data, current_page: int, depth: int = 0) -> bool:
        if depth > 8 or data is None:
            return False
        if isinstance(data, dict):
            # Check for common pagination keys.
            total = data.get("totalCount") or data.get("totalPages") or data.get("total")
            page_count = data.get("pageCount") or data.get("totalPages")
            if isinstance(page_count, int) and page_count > current_page:
                return True
            if isinstance(total, int) and total > 0:
                page_size = data.get("pageSize") or data.get("count") or 10
                if isinstance(page_size, int) and current_page * page_size < total:
                    return True
            for val in data.values():
                if isinstance(val, (dict, list)):
                    if cls._check_pagination_deep(val, current_page, depth + 1):
                        return True
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, (dict, list)):
                    if cls._check_pagination_deep(item, current_page, depth + 1):
                        return True
        return False

    def get_next_page_url(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """Increment the ``page`` parameter for server-side pagination."""
        return self._update_query_param(current_url, "page", str(current_page + 1))

    # ------------------------------------------------------------------
    # Date extraction
    # ------------------------------------------------------------------

    @classmethod
    def _extract_date(cls, container) -> str:
        """Extract the review date from a Flipkart review container.

        Handles both legacy absolute dates ("Dec 16, 2024") and the
        React Native relative format ("4 months ago").
        """
        for el in container.find_all(["p", "span", "div"]):
            txt = el.get_text(strip=True)
            if not txt or len(txt) > 50:
                continue
            # Try relative date first (current layout).
            m = cls._RELATIVE_DATE_RE.search(txt)
            if m:
                return m.group(1).strip()
            # Legacy absolute date.
            m = cls._DATE_RE.search(txt)
            if m:
                return m.group(1).strip()
        return ""

    # ------------------------------------------------------------------
    # Main parse
    # ------------------------------------------------------------------

    def parse(self, html: str, *, url: str) -> list[Review]:
        soup = self._soup(html)
        reviews: list[Review] = []

        # Strategy 1: React Native Web layout (2025+ inline-style cards).
        reviews = self._parse_react_native(soup)
        if reviews:
            return self._dedupe(reviews)

        # Strategy 2: CSS selectors (legacy class names).
        reviews = self._parse_with_selectors(soup)
        if reviews:
            return self._dedupe(reviews)

        # Strategy 3: Structural / heuristic parsing.
        reviews = self._parse_structural(soup)
        if reviews:
            return self._dedupe(reviews)

        # Strategy 4: Embedded script JSON (INITIAL_STATE, NEXT_DATA, etc.).
        reviews = self._extract_from_embedded_scripts(soup)
        if reviews:
            return reviews

        # Strategy 5: JSON-LD structured data.
        reviews = self._extract_reviews_from_json_ld(soup)
        return reviews

    # ------------------------------------------------------------------
    # Strategy 1: React Native Web (inline-style matching)
    # ------------------------------------------------------------------

    # Patterns that identify non-review page elements misdetected as cards.
    _GARBAGE_RE = re.compile(
        r"Contact Us|About Us|Careers|Corporate Information|"
        r"GROUP COMPANIES|Flipkart Stories|MAIL US|REGISTERED OFFICE|"
        r"Become a Seller|Help Centre|Gift Cards|CONSUMER COMPLAINTS|"
        r"Payments|Shipping|Cancellation|Returns|^\s*Ratings?\s*&\s*Reviews?\s*$",
        re.IGNORECASE,
    )
    # Rating distribution bar pattern: "1 ★ 218 2 ★ 80 ..."
    _RATING_DIST_RE = re.compile(
        r"\d\s*[\u2605\u2606\u2B50★]\s*[\d,]+\s+\d\s*[\u2605\u2606\u2B50★]"
    )
    # "Verified Purchase" meta line (not actual review text).
    _META_LINE_RE = re.compile(
        r"^(Verified Purchase|Certified Buyer)", re.IGNORECASE
    )

    def _parse_react_native(self, soup):
        """Parse reviews from Flipkart's React Native Web layout.

        The page uses generic CSS classes (css-175oi2r, css-1rynq56) with
        inline styles as the only structural differentiator.  Review cards
        are identified by their padding pattern, ratings by the first
        numeric text in the top row, and body text by padding markers.
        """
        reviews: list[Review] = []

        for card in soup.find_all("div", style=True):
            style = card.get("style", "")
            if not (
                "padding-left: 16px" in style
                and "padding-top: 16px" in style
                and "padding-bottom: 16px" in style
            ):
                continue

            # Direct div children of the card.
            children = [
                c for c in card.children if getattr(c, "name", None) == "div"
            ]
            if len(children) < 2:
                continue

            # --- Rating (first child row) ---
            rating = self._extract_rating_rn(children[0])
            if rating is None:
                continue

            # --- Body text ---
            body = self._extract_body_rn(children)
            if not body or len(body) < 2:
                continue
            # Skip rating-summary bars misdetected as review cards.
            if "\u2605" in body or "\u2606" in body or "\u2B50" in body:
                continue
            if self._RATING_DIST_RE.search(body):
                continue
            # Skip footer / navigation blocks.
            if self._GARBAGE_RE.search(body):
                continue
            # Skip "Verified Purchase" meta lines masquerading as review body.
            if self._META_LINE_RE.match(body.strip()):
                continue

            # --- Date ---
            date = self._extract_date(card)

            reviews.append(
                Review(text=self._clean_text(body), rating=rating, date=date)
            )

        # Remove near-duplicate entries caused by nested cards.
        # Flipkart's React Native layout can match both the outer card
        # (which includes "5.0 • Title  Review for: variant  body text")
        # and an inner child card (which contains just "body text").
        # Keep the longer version and drop shorter substrings.
        return self._remove_substring_reviews(reviews)

    @staticmethod
    def _remove_substring_reviews(reviews: list[Review]) -> list[Review]:
        """Remove reviews whose text is a substring of another review's text.

        Flipkart's nested React Native cards often produce two entries per
        review: a longer one (with "5.0 • Title  Review for: ... body")
        and a shorter one (just the body).  We keep the longer version.
        """
        if len(reviews) <= 1:
            return reviews

        # Normalize for comparison (lowercase, strip whitespace).
        texts = [r.text.lower().strip() for r in reviews]
        keep = [True] * len(reviews)

        for i in range(len(reviews)):
            if not keep[i]:
                continue
            for j in range(len(reviews)):
                if i == j or not keep[j]:
                    continue
                # If review j's text is contained within review i's text
                # (and j is shorter), drop j.
                if len(texts[j]) < len(texts[i]) and texts[j] in texts[i]:
                    keep[j] = False

        return [r for r, k in zip(reviews, keep) if k]

    def _extract_rating_rn(self, row):
        """Extract rating number from the first row of a React Native card.

        Handles two Flipkart formats:
          - Isolated rating: "5.0" in its own element
          - Combined rating + title: "5.0 • Perfect product!" in a single element
        """
        for el in row.find_all(["div", "span"]):
            txt = el.get_text(strip=True)
            if not txt:
                continue
            # Exact match: "5", "4.5", etc.
            m = self._RE_RATING_VALUE.match(txt)
            if m:
                return float(m.group(1))
            # Prefix match: "5.0 • Great product", "4.5·Nice"
            m = self._RE_RATING_PREFIX.match(txt)
            if m:
                return float(m.group(1))
        return None

    def _extract_title_rn(self, row) -> str:
        """Extract review title from the first row of a React Native card.

        When Flipkart uses the combined "5.0 • Title" format, the title
        is the text after the bullet separator.
        """
        for el in row.find_all(["div", "span"]):
            txt = el.get_text(strip=True)
            if not txt:
                continue
            # Look for "5.0 • Title" pattern and extract the title part.
            m = re.match(r"^[1-5](?:\.\d)?\s*[•·\u2022\u00B7]\s*(.+)$", txt)
            if m:
                return m.group(1).strip()
        return ""

    def _extract_body_rn(self, children):
        """Extract review body text from React Native card children.

        Flipkart's card structure (2025):
          children[0]: Rating + title row ("5.0 • Perfect product!")
          children[1]: Variant info ("Review for: Quantity 100 ml") -- grey text
          children[2]: Review body text -- dark text
          children[3]: Meta info (author, date, helpful count, verified)

        The body may be in a div with padding-top:8px + padding-bottom:16px,
        or it may be a plain div with just text content.
        """
        for child in children[1:]:
            style = child.get("style", "")

            # The body text container has specific padding.
            if "padding-top: 8px" in style and "padding-bottom: 16px" in style:
                return self._get_span_text(child)

            # Truncated reviews: wrapped in cursor:pointer div.
            wrapper = child.find(
                "div", style=lambda s: s and "cursor: pointer" in s
            )
            if wrapper:
                inner = wrapper.find(
                    "div",
                    style=lambda s: s and "padding-top: 8px" in s,
                )
                if inner:
                    return self._get_span_text(inner)

            # Nested body div.
            inner = child.find(
                "div",
                style=lambda s: (
                    s
                    and "padding-top: 8px" in s
                    and "padding-bottom: 16px" in s
                ),
            )
            if inner:
                return self._get_span_text(inner)

        # Fallback: if no padding-based match, look for the longest text
        # block among children[1:] that isn't the meta row (last child).
        # Skip children[0] (rating row) and typically skip last child (meta).
        body_candidates = children[1:-1] if len(children) > 2 else children[1:]
        best_text = ""
        for child in body_candidates:
            txt = self._get_span_text(child)
            if not txt:
                txt = child.get_text(strip=True)
            # Skip short variant-info lines ("Review for: Quantity 100 ml").
            if txt and len(txt) > len(best_text):
                # Skip lines that look like variant info.
                if re.match(r"^Review for:", txt, re.IGNORECASE):
                    continue
                best_text = txt

        return best_text

    @staticmethod
    def _get_span_text(container):
        """Get text from spans, excluding 'more'/'less' link elements."""
        spans = container.find_all("span")
        parts: list[str] = []
        for span in spans:
            span_style = span.get("style", "")
            # Skip blue "more"/"less" links.
            if "color: rgb(42, 85, 229)" in span_style:
                continue
            txt = span.get_text(strip=True)
            if txt and txt.lower() not in ("more", "less"):
                parts.append(txt)
        return " ".join(parts).strip()

    # ------------------------------------------------------------------
    # Strategy 2: CSS selectors (legacy)
    # ------------------------------------------------------------------

    _CONTAINER_SELECTORS = (
        "div.col._2wzgFH",
        "div._27M-vq",
        "div._16PBlm",
        "div.EKFha-",
        "div.cPHDOP",
        "div.RcXBOT",
        "div[class*='review-card']",
    )

    _RATING_SELECTORS = (
        "div._3LWZlK",
        "div.XQDdHH",
        "span._3LWZlK",
        "div._3Ay6sb",
        "div.Ga3i8K",
        "div[class*='hGSR59']",
    )

    _TEXT_SELECTORS = (
        "div.t-ZTKy div",
        "div.ZmyHeo div",
        "div._11pzQk",
        "div._6K-7Co",
        "div.t-ZTKy",
        "div.ZmyHeo",
        "div[class*='review-text']",
    )

    def _parse_with_selectors(self, soup):
        containers = []
        for sel in self._CONTAINER_SELECTORS:
            containers = soup.select(sel)
            if containers:
                break

        if not containers:
            return []

        reviews: list[Review] = []
        for card in containers:
            rating_text = self._first_text(card, self._RATING_SELECTORS)
            text = self._first_text(card, self._TEXT_SELECTORS)
            rating = self._parse_rating(rating_text)
            date = self._extract_date(card)
            if text and rating is not None:
                reviews.append(Review(text=text, rating=rating, date=date))
        return reviews

    # ------------------------------------------------------------------
    # Strategy 3: Structural / heuristic parsing
    # ------------------------------------------------------------------

    _RE_SINGLE_RATING = re.compile(r"^[1-5](?:\.\d)?$")
    _RE_COMBINED_RATING = re.compile(r"^([1-5](?:\.\d)?)\s*[•·\u2022\u00B7]")

    def _parse_structural(self, soup):
        """Find reviews via structural HTML patterns instead of class names.

        Flipkart review cards have a recognizable structure:
          - A small element containing a rating (1-5 or 1.0-5.0),
            typically next to a star icon (SVG, canvas, or image).
          - Or a combined "5.0 • Title" element.
          - A larger sibling/parent block containing the review body text.
        """
        reviews: list[Review] = []
        seen_texts: set[str] = set()

        for el in soup.find_all(["div", "span"]):
            txt = el.get_text(strip=True)

            # Try isolated rating first, then combined "N.N • Title".
            rating = None
            if self._RE_SINGLE_RATING.match(txt):
                rating = float(txt)
            else:
                m = self._RE_COMBINED_RATING.match(txt)
                if m:
                    rating = float(m.group(1))

            if rating is None:
                continue

            if not self._is_rating_badge(el):
                continue

            container = self._find_review_container(el)
            if container is None:
                continue

            body = self._extract_body_text(container)
            if not body or len(body) < 10 or body in seen_texts:
                continue

            # --- Garbage filters (same as Strategy 1) ---
            # Skip rating distribution bars.
            if "\u2605" in body or "\u2606" in body or "\u2B50" in body:
                continue
            if self._RATING_DIST_RE.search(body):
                continue
            # Skip footer / navigation blocks.
            if self._GARBAGE_RE.search(body):
                continue
            # Skip "Verified Purchase" meta lines.
            if self._META_LINE_RE.match(body.strip()):
                continue

            seen_texts.add(body)
            date = self._extract_date(container)
            reviews.append(Review(text=self._clean_text(body), rating=rating, date=date))

        return self._remove_substring_reviews(reviews)

    @staticmethod
    def _is_rating_badge(el) -> bool:
        """Check whether an element looks like a Flipkart rating badge."""
        parent = el.parent
        if parent is None:
            return False
        # SVG or canvas star icons.
        if parent.find("svg") or parent.find("canvas"):
            return True
        if parent.find("img", src=lambda s: s and "star" in s.lower()):
            return True
        for ancestor in [el, parent]:
            cls = " ".join(ancestor.get("class", []))
            if re.search(r"(rating|star)", cls, re.IGNORECASE):
                return True
        if parent.get_text(strip=True) != el.get_text(strip=True):
            return True
        return False

    @staticmethod
    def _find_review_container(rating_el):
        """Walk up from a rating badge to find the review card container."""
        node = rating_el
        for _ in range(6):
            node = node.parent
            if node is None or node.name in ("body", "html", "[document]"):
                return None
            text_len = len(node.get_text(strip=True))
            if text_len > 40:
                return node
        return None

    @staticmethod
    def _extract_body_text(container) -> str:
        """Return the longest text block from a container, likely the review body."""
        best = ""
        for child in container.find_all(["div", "p", "span"], recursive=True):
            txt = child.get_text(" ", strip=True)
            if len(txt) > len(best) and len(txt) > 15:
                best = txt
        return best
