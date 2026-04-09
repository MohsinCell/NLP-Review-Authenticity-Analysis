from __future__ import annotations

import csv
import io
import itertools
import threading
import uuid
from pathlib import Path
from typing import Optional

from flask import Flask, Response, jsonify, render_template, request
from flask_cors import CORS

from review_scraper.core.fetcher import (
    FetchConfig,
    Fetcher,
)
from review_scraper.core.parser_base import BaseParser, ProductMeta, Review
from review_scraper.core.playwright_config import load_proxy_from_env, load_site_proxy_from_env
from review_scraper.sites import get_parser_for_url
from review_scraper.utils.cookies import (
    cookies_for_playwright,
    cookies_for_url,
    find_cookie_file,
    load_netscape_cookies,
)
from review_scraper.utils.robots_checker import RobotsChecker
from review_scraper.web import cookie_manager

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_COOKIES_DIR = _PROJECT_ROOT / "cookies"

cookie_manager.init(_COOKIES_DIR)

_DEFAULT_UA = ""  # Empty = Fetcher will pick a random UA from the pool.

# Load proxy configuration from PROXY_URL env var (if set).
_PROXY_CONFIG = load_proxy_from_env()

# Sites where the proxy should NOT be used.
# - Flipkart: Web Unlocker's MITM breaks React hydration ("Something went wrong").
# - Amazon: Web Unlocker returns 502 for amazon.in; Playwright stealth works fine.
_PROXY_SKIP_SITES: frozenset[str] = frozenset({"flipkart", "amazon"})

app = Flask(__name__)
CORS(app)

_jobs: dict[str, ScrapeJob] = {}


class ScrapeJob:

    def __init__(self, url: str, options: dict) -> None:
        self.job_id: str = uuid.uuid4().hex[:8]
        self.url: str = url
        self.options: dict = options
        self.status: str = "pending"
        self.current_page: int = 0
        self.max_pages: int = int(options.get("max_pages", 0))
        self.max_reviews: int = int(options.get("max_reviews", 0))
        self.total_reviews: int = 0
        self.message: str = "Queued..."
        self.reviews: list[Review] = []
        self.error: Optional[str] = None
        self.site_name: str = ""
        self.product_meta: Optional[ProductMeta] = None

    def run(self) -> None:
        self.status = "running"
        self.message = "Detecting site..."

        try:
            parser = get_parser_for_url(self.url)
            if parser is None:
                raise ValueError(f"Unsupported site: {self.url}")

            self.site_name = parser.name
            url_batches = parser.get_review_url_batches(self.url)

            # Determine effective proxy for this site.
            # Sites in _PROXY_SKIP_SITES use no proxy at all.
            # Other sites check for PROXY_URL_<SITE> first, then PROXY_URL.
            import logging as _logging
            _app_logger = _logging.getLogger("review_scraper.app")
            if parser.name in _PROXY_SKIP_SITES:
                _app_logger.info(
                    "Skipping proxy for %s (in PROXY_SKIP_SITES)", parser.name,
                )
                effective_proxy = None
            else:
                effective_proxy = load_site_proxy_from_env(parser.name)
                if effective_proxy:
                    _app_logger.info(
                        "Using proxy for %s: %s", parser.name, effective_proxy.server,
                    )
                else:
                    _app_logger.info("No proxy configured for %s", parser.name)

            self.message = "Loading cookies..."
            http_cookies: dict[str, str] = {}
            browser_cookies: list[dict] = []

            cookie_path: Optional[Path] = None
            custom = self.options.get("cookies_path")
            if custom:
                cookie_path = Path(custom)
            else:
                cookie_path = find_cookie_file(_COOKIES_DIR, url_batches[0])

            if cookie_path and cookie_path.is_file():
                all_cookies = load_netscape_cookies(cookie_path)
                http_cookies = cookies_for_url(all_cookies, url_batches[0])
                browser_cookies = cookies_for_playwright(all_cookies, url_batches[0])
                self.message = f"Loaded {len(http_cookies)} cookies"

            robots = RobotsChecker(
                proxy_url=effective_proxy.httpx_url if effective_proxy else None,
            )
            cfg = FetchConfig(
                min_delay_s=float(self.options.get("min_delay", 2.0)),
                max_delay_s=float(self.options.get("max_delay", 4.0)),
            )

            with Fetcher(
                user_agent=_DEFAULT_UA,
                config=cfg,
                robots_checker=robots,
                cookies=http_cookies,
                browser_cookies=browser_cookies,
                proxy=effective_proxy,
            ) as fetcher:

                # ----------------------------------------------------------
                # Pre-fetch: Try to extract product metadata from the
                # original product page URL.  This is a lightweight HTTP
                # GET that runs before scraping.  If the page requires JS
                # rendering or is behind a proxy, we'll try again from the
                # first browser-rendered page in the scraping phases.
                # ----------------------------------------------------------
                if self.product_meta is None:
                    self._prefetch_product_meta(fetcher, parser)

                # ----------------------------------------------------------
                # Phase 1: Try API-first (fast, no browser, low memory).
                # If the parser supports it, we try to get all reviews via
                # direct HTTP API calls before touching browser rendering at all.
                # ----------------------------------------------------------
                api_succeeded = False
                # ScraperAPI proxy corrupts POST JSON bodies (returns HTTP 400).
                # Only disable API-first mode for parsers that use POST APIs
                # when routed through ScraperAPI.  GET-based APIs (Nykaa,
                # Myntra) work fine through ScraperAPI.
                use_api = parser.has_api
                use_browser_api = False
                if use_api and effective_proxy:
                    proxy_host = effective_proxy.server.lower()
                    if "scraperapi" in proxy_host:
                        # Check if this parser's API uses POST
                        sample_req = parser.get_api_request(self.url, page=1)
                        uses_post = (
                            sample_req is not None
                            and sample_req.get("method", "GET").upper() == "POST"
                        )
                        if uses_post:
                            _app_logger.info(
                                "Disabling httpx API for %s (ScraperAPI corrupts POST bodies); "
                                "will try browser-mediated API instead",
                                parser.name,
                            )
                            use_api = False
                            use_browser_api = True
                        else:
                            _app_logger.info(
                                "Keeping API mode for %s (GET-based API works through ScraperAPI)",
                                parser.name,
                            )
                if use_api:
                    api_succeeded = self._run_api_phase(fetcher, parser)

                # ----------------------------------------------------------
                # Phase 1b: Browser-mediated API (for POST-based APIs
                # through ScraperAPI where httpx can't be used).
                # ----------------------------------------------------------
                if not api_succeeded and use_browser_api:
                    api_succeeded = self._run_browser_api_phase(fetcher, parser)

                # ----------------------------------------------------------
                # Phase 2: Playwright/HTML fallback (only if API failed or
                # didn't get enough reviews).
                # ----------------------------------------------------------
                if not api_succeeded:
                    self._run_browser_phase(fetcher, parser, url_batches)

            if self.reviews:
                self.status = "completed"
                self.message = f"Done! {self.total_reviews} unique reviews extracted"
            else:
                self.status = "completed"
                self.message = (
                    "No reviews found. This could mean: "
                    "(1) The product has no reviews, "
                    "(2) Cookies are expired. Try refreshing them in Admin > Cookies, or "
                    "(3) The site is blocking automated access."
                )

        except Exception as exc:
            exc_msg = str(exc).lower()
            if self.reviews:
                self.total_reviews = len(self.reviews)
                self.status = "completed"
                self.message = (
                    f"Stopped early ({type(exc).__name__}). "
                    f"{self.total_reviews} reviews saved"
                )
            elif "sign-in" in exc_msg or "signin" in exc_msg:
                self.status = "failed"
                self.error = str(exc)
                self.message = (
                    "Blocked: redirected to sign-in page. "
                    "Your cookies are likely expired. "
                    "Go to Admin > Cookies to refresh them."
                )
            elif "blocked" in exc_msg or "captcha" in exc_msg or "robot" in exc_msg:
                self.status = "failed"
                self.error = str(exc)
                self.message = (
                    "Blocked by site (captcha/rate limit). "
                    "Try again later or refresh cookies in Admin > Cookies."
                )
            else:
                self.status = "failed"
                self.error = str(exc)
                self.message = f"Error: {exc}"

    # ------------------------------------------------------------------
    # Pre-fetch: lightweight product metadata extraction
    # ------------------------------------------------------------------

    def _prefetch_product_meta(self, fetcher, parser) -> None:
        """Try to extract product metadata from the original product page URL.

        This is a lightweight HTTP GET that runs before the scraping phases.
        It fetches the *original* product page (not the normalized review
        listing URL) which typically contains JSON-LD, Open Graph, and other
        structured metadata.

        This is critical for sites where the scraping path doesn't visit the
        product page at all:
          - Flipkart: scraping goes to /product-reviews/ (no metadata)
          - Nykaa: scraping uses the review API (no product info)

        The method is best-effort: failures are logged and silently ignored.
        If metadata extraction fails here, the scraping phases will try again
        from the first rendered page (browser phase) or API response.

        NOTE: This bypasses the robots.txt check intentionally.  We're
        reading publicly available HTML meta tags (JSON-LD, OG), not
        scraping review content.  Many sites (e.g. Flipkart) disallow
        their product pages in robots.txt for SEO bots, but the pages
        are freely accessible to browsers.
        """
        import logging
        from urllib.parse import urljoin
        logger = logging.getLogger("review_scraper.meta")

        try:
            self.message = "Extracting product info..."
            logger.info("Pre-fetching product metadata from: %s", self.url)

            # Use fetcher's httpx client directly -- bypasses robots.txt check
            # and rate-limit sleep (metadata fetch is a single lightweight GET,
            # not part of the scraping loop).  We follow redirects manually
            # to handle Flipkart's SSR redirects.
            current_url = self.url
            html = ""
            for _ in range(5):  # max redirects
                try:
                    resp = fetcher._client.get(current_url)
                except Exception as req_exc:
                    logger.info("Pre-fetch HTTP error: %s", req_exc)
                    return

                if resp.status_code in (301, 302, 303, 307, 308):
                    loc = resp.headers.get("Location", "")
                    if loc:
                        current_url = urljoin(current_url, loc)
                        logger.info("Pre-fetch redirect → %s", current_url)
                        continue
                    break

                if resp.status_code == 200:
                    html = resp.text or ""
                    break
                else:
                    logger.info("Pre-fetch HTTP %d for %s", resp.status_code, current_url)
                    return

            if not html or len(html) < 200:
                logger.info("Pre-fetch returned too little content (%d bytes)", len(html))
                return

            meta = parser.parse_product_meta(html, url=self.url)
            if meta:
                self.product_meta = meta
                logger.info(
                    "Pre-fetch metadata OK: name=%s, brand=%s, rating=%s",
                    (meta.name or "")[:50],
                    meta.brand or "(none)",
                    meta.overall_rating,
                )
            else:
                logger.info("Pre-fetch: no metadata extracted from product page")

        except Exception as exc:
            # Best-effort -- never let metadata extraction break scraping.
            logger.info("Pre-fetch metadata failed (non-fatal): %s: %s", type(exc).__name__, exc)

    # ------------------------------------------------------------------
    # JS-based product metadata extraction (browser fallback)
    # ------------------------------------------------------------------

    def _extract_meta_via_js(self, page, parser, logger) -> None:
        """Extract product metadata directly from the live browser DOM.

        This is a last-resort fallback for sites like AJIO where:
        - The pre-fetch returns a React shell with no metadata.
        - page.content() might not serialize JSON-LD correctly.

        We use page.evaluate() to read metadata directly from the DOM:
        - JSON-LD ``<script type="application/ld+json">`` (most reliable)
        - Open Graph meta tags (``og:title``, ``og:image``)
        - ``document.title`` (always available -- parsed to extract name/brand)
        """
        try:
            js_extract = """
                () => {
                    const meta = {};

                    // 1. Try JSON-LD
                    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
                    for (const s of ldScripts) {
                        try {
                            const ld = JSON.parse(s.textContent);
                            const items = Array.isArray(ld) ? ld : [ld];
                            for (const obj of items) {
                                if (obj['@type'] === 'Product' || obj['@type'] === 'product') {
                                    meta.name = meta.name || obj.name || '';
                                    if (obj.brand) {
                                        meta.brand = typeof obj.brand === 'string'
                                            ? obj.brand
                                            : (obj.brand.name || '');
                                    }
                                    if (obj.image) {
                                        meta.image_url = Array.isArray(obj.image)
                                            ? obj.image[0]
                                            : obj.image;
                                    }
                                    if (obj.offers) {
                                        const p = obj.offers.price || obj.offers.lowPrice;
                                        const c = obj.offers.priceCurrency || 'INR';
                                        if (p) meta.price = c + ' ' + p;
                                    }
                                    if (obj.aggregateRating) {
                                        meta.rating = parseFloat(obj.aggregateRating.ratingValue) || null;
                                    }
                                }
                            }
                        } catch(e) {}
                    }

                    // 2. OG tag fallbacks
                    if (!meta.name) {
                        const og = document.querySelector('meta[property="og:title"]');
                        if (og) meta.name = og.content || '';
                    }
                    if (!meta.image_url) {
                        const og = document.querySelector('meta[property="og:image"]');
                        if (og) meta.image_url = og.content || '';
                    }
                    if (!meta.brand) {
                        const og = document.querySelector('meta[property="product:brand"]');
                        if (og) meta.brand = og.content || '';
                    }

                    // 3. document.title fallback for name
                    if (!meta.name) {
                        // AJIO pattern: "Buy Grey Leggings... by BRAND Online | Ajio.com"
                        let t = document.title || '';
                        t = t.replace(/^Buy\s+/i, '').replace(/\s+Online\s*\|.*$/i, '').trim();
                        if (t.length > 5) meta.name = t;
                    }

                    // 4. Extract brand from title if still missing
                    if (!meta.brand && meta.name) {
                        // AJIO pattern: "...for Women by BRAND NAME"
                        const byMatch = meta.name.match(/\sby\s+(.+)$/i);
                        if (byMatch) {
                            meta.brand = byMatch[1].trim();
                            // Clean name: remove "by BRAND" suffix
                            meta.name = meta.name.replace(/\s+by\s+.+$/i, '').trim();
                        }
                    }

                    // 5. Try to get price from visible DOM
                    if (!meta.price) {
                        const priceEl = document.querySelector('[class*="prod-sp"], [class*="product-price"], [class*="price-container"] [class*="price"]');
                        if (priceEl) {
                            const priceText = priceEl.textContent.trim();
                            if (priceText) meta.price = priceText;
                        }
                    }

                    return meta;
                }
            """
            result = page.evaluate(js_extract)
            if result and result.get("name"):
                self.product_meta = ProductMeta(
                    name=result.get("name", ""),
                    brand=result.get("brand", ""),
                    price=result.get("price", ""),
                    image_url=result.get("image_url", ""),
                    overall_rating=result.get("rating"),
                    platform=parser.name.upper(),
                )
                logger.info(
                    "Extracted product meta via JS fallback: name=%s, brand=%s, price=%s, image=%s",
                    (self.product_meta.name or "")[:50],
                    self.product_meta.brand or "(none)",
                    self.product_meta.price or "(none)",
                    "yes" if self.product_meta.image_url else "no",
                )
            else:
                logger.info("JS fallback: no usable metadata found (result=%s)", result)

        except Exception as exc:
            logger.info("JS metadata fallback failed: %s", exc)

    # ------------------------------------------------------------------
    # Phase 1: API-first scraping (no browser needed)
    # ------------------------------------------------------------------

    def _run_api_phase(self, fetcher, parser) -> bool:
        """Try to scrape reviews via direct API calls.

        Returns True if the API produced enough reviews (≥1) and we should
        skip the browser phase. Returns False to signal fallback.
        """
        import logging
        logger = logging.getLogger("review_scraper.api")

        self.message = f"Trying {parser.name} API (fast mode)..."
        seen_ids: set[str] = set()
        seen_text: set[tuple[str, float]] = set()
        max_api_pages = self.max_pages if self.max_pages > 0 else 50

        try:
            for page in range(1, max_api_pages + 1):
                req = parser.get_api_request(self.url, page=page)
                if req is None:
                    logger.debug("Parser returned no API request for page %d", page)
                    return False

                self.message = f"API page {page}..."
                self.current_page = page

                try:
                    text = fetcher.fetch_api(
                        req["url"],
                        headers=req.get("headers"),
                        params=req.get("params"),
                        referer=req.get("referer"),
                        method=req.get("method", "GET"),
                        json_body=req.get("json_body"),
                    )
                except Exception as exc:
                    logger.info("API fetch failed on page %d: %s", page, exc)
                    if page == 1:
                        return False  # API doesn't work at all -- fall back.
                    break  # Got some reviews, stop here.

                page_reviews = parser.parse_api_response(text, url=self.url)

                # Try to extract product metadata from the first API response.
                if page == 1 and self.product_meta is None:
                    try:
                        meta = parser.parse_product_meta(text, url=self.url)
                        if meta:
                            self.product_meta = meta
                            logger.info(
                                "Extracted product meta from API: %s",
                                meta.name[:60],
                            )
                    except Exception as meta_exc:
                        logger.debug("Product meta extraction failed: %s", meta_exc)

                new_reviews: list[Review] = []
                for r in page_reviews:
                    if r.review_id:
                        if r.review_id in seen_ids:
                            continue
                        seen_ids.add(r.review_id)
                    else:
                        key = (BaseParser._text_fingerprint(r.text), r.rating)
                        if key in seen_text:
                            continue
                        seen_text.add(key)
                    new_reviews.append(r)

                if not new_reviews and page == 1:
                    logger.info("API returned no reviews on page 1 -- falling back")
                    return False

                if not new_reviews:
                    break  # No new reviews, pagination exhausted.

                self.reviews.extend(new_reviews)
                self.total_reviews = len(self.reviews)

                self.message = (
                    f"API page {page}: {len(new_reviews)} new, "
                    f"{self.total_reviews} total"
                )

                if self.max_reviews > 0 and self.total_reviews >= self.max_reviews:
                    self.reviews = self.reviews[:self.max_reviews]
                    self.total_reviews = len(self.reviews)
                    break

                # Check if there are more pages.
                if not parser.api_has_next_page(text, page):
                    break

        except Exception as exc:
            logger.info("API phase error: %s", exc)
            if not self.reviews:
                return False

        if self.reviews:
            logger.info(
                "API phase succeeded: %d reviews from %s",
                self.total_reviews, parser.name,
            )
            return True

        return False

    # ------------------------------------------------------------------
    # Phase 1b: Browser-mediated API (for sites like AJIO where the API
    # requires browser-established cookies/session to bypass WAF).
    # ------------------------------------------------------------------

    def _run_browser_api_phase(self, fetcher, parser) -> bool:
        """Load page with Playwright, then call API from browser context.

        This handles sites (e.g. AJIO) where:
        - The review API requires browser cookies (Akamai WAF blocks raw httpx).
        - The proxy corrupts POST bodies (ScraperAPI), so httpx API is unusable.
        - But once the browser loads the page, in-browser fetch() works fine.

        Instead of using fetch_html_rendered (which navigates to the homepage
        first for cookie injection and often times out through slow proxies),
        we directly manage the browser page: navigate straight to the product
        page with a generous timeout, then call the API via page.evaluate().

        Returns True if reviews were obtained.
        """
        import logging, json as _json, time as _time
        from urllib.parse import urlparse
        logger = logging.getLogger("review_scraper.api")

        self.message = f"Loading {parser.name} page for browser API..."
        logger.info("Browser-mediated API phase for %s", parser.name)

        try:
            # Step 1: Get the product page URL
            url_batches = parser.get_review_url_batches(self.url)
            page_url = url_batches[0] if url_batches else self.url

            # Step 2: Ensure Playwright browser/page is ready
            page = fetcher._get_or_create_page()
            nav_timeout = 120_000  # 120s -- ScraperAPI is slow for AJIO

            # Step 3: Skip cookie file injection for browser-API phase.
            # The browser will establish its own session through the proxy.
            # Injecting stale cookies from the cookie file causes "400 Request
            # Header Or Cookie Too Large" errors (68+ cookies are too many).
            if fetcher._browser_cookies:
                logger.info(
                    "Skipping %d cookie-file cookies for browser-API phase "
                    "(browser will establish its own session via proxy)",
                    len(fetcher._browser_cookies),
                )
                # Mark as set so fetch_html_rendered (if called later in
                # browser fallback phase) doesn't try to inject them either
                # after the browser already has proxy-established cookies.
                fetcher._browser_cookies_set = True

            # Step 4: Navigate directly to the product page with generous timeout
            self.message = f"Navigating to {parser.name} product page..."
            logger.info("Navigating to %s (timeout=%ds)", page_url, nav_timeout // 1000)

            try:
                # Use "commit" (bare minimum) -- we don't need the full page,
                # just enough for the browser to be at the AJIO domain so
                # in-browser fetch() calls work. Even "Access Denied" pages
                # set up Akamai cookies that make the API accessible.
                page.goto(page_url, wait_until="commit", timeout=nav_timeout)
            except Exception as nav_exc:
                logger.info("Navigation timeout/error: %s -- checking if page is usable", nav_exc)
                try:
                    current_url = page.url or ""
                    if not current_url or current_url == "about:blank":
                        logger.info("Page is blank after navigation failure -- giving up")
                        return False
                    # Page has some URL, try to use it
                    logger.info("Page URL after timeout: %s -- proceeding anyway", current_url)
                except Exception:
                    return False

            # Brief wait for any JS to settle
            _time.sleep(2)

            page_title = ""
            try:
                page_title = page.title() or ""
            except Exception:
                pass
            logger.info("Page loaded. Title: %s, URL: %s", page_title[:80], page.url)

            html = page.content() or ""
            logger.info("Page content: %d bytes", len(html))
            # NOTE: Do NOT check content size here. Even when AJIO returns
            # "Access Denied" (509 bytes), the in-browser fetch() API call
            # still succeeds because Akamai sets up session cookies.
            # The page content doesn't need to be the full product page.

            # Try to extract product metadata from the rendered page.
            if self.product_meta is None and len(html) > 500:
                try:
                    meta = parser.parse_product_meta(html, url=self.url)
                    if meta:
                        self.product_meta = meta
                        logger.info(
                            "Extracted product meta from browser page: %s",
                            meta.name[:60],
                        )
                    else:
                        logger.info(
                            "Browser page: parse_product_meta returned None (%d bytes, first 200: %s)",
                            len(html), html[:200].replace('\n', ' '),
                        )
                except Exception as meta_exc:
                    logger.info("Product meta extraction from browser page failed: %s", meta_exc)

            # Step 5: Call the API from browser context using page.evaluate
            seen_ids: set[str] = set()
            seen_text: set[tuple[str, float]] = set()
            max_api_pages = self.max_pages if self.max_pages > 0 else 50

            for page_num in range(1, max_api_pages + 1):
                req = parser.get_api_request(self.url, page=page_num)
                if req is None:
                    logger.info("Parser returned no API request for page %d", page_num)
                    return False

                self.message = f"Browser API page {page_num}..."
                self.current_page = page_num

                # Build the fetch() call for page.evaluate
                fetch_url = req["url"]
                fetch_method = req.get("method", "GET")
                fetch_headers = req.get("headers", {})
                fetch_body = req.get("json_body")
                params = req.get("params")

                # Add query params to URL for GET requests
                if params and fetch_method.upper() == "GET":
                    from urllib.parse import urlencode
                    fetch_url = f"{fetch_url}?{urlencode(params)}"

                # Build JavaScript fetch options
                js_opts = {"method": fetch_method, "headers": fetch_headers}
                if fetch_body is not None:
                    js_opts["body"] = _json.dumps(fetch_body)
                    if "Content-Type" not in fetch_headers:
                        js_opts["headers"]["Content-Type"] = "application/json"

                js_code = f"""
                    async () => {{
                        try {{
                            const resp = await fetch({_json.dumps(fetch_url)}, {_json.dumps(js_opts)});
                            const text = await resp.text();
                            return {{status: resp.status, text: text}};
                        }} catch(e) {{
                            return {{error: e.message}};
                        }}
                    }}
                """

                logger.info(
                    "Browser fetch: %s %s (page %d)",
                    fetch_method, fetch_url[:80], page_num,
                )

                try:
                    result = fetcher.evaluate_in_page(js_code)
                except Exception as exc:
                    logger.info("Browser evaluate failed on page %d: %s", page_num, exc)
                    if page_num == 1:
                        return False
                    break

                if not result:
                    logger.info("Browser evaluate returned None on page %d", page_num)
                    if page_num == 1:
                        return False
                    break

                if result.get("error"):
                    logger.info("Browser fetch JS error on page %d: %s", page_num, result["error"])
                    if page_num == 1:
                        return False
                    break

                status = result.get("status", 0)
                text = result.get("text", "")

                logger.info(
                    "Browser API response: HTTP %d, %d bytes (page %d)",
                    status, len(text), page_num,
                )

                if status != 200:
                    logger.info("Browser API HTTP %d on page %d -- body: %s", status, page_num, text[:200])
                    if page_num == 1:
                        return False
                    break

                page_reviews = parser.parse_api_response(text, url=self.url)
                logger.info("Parsed %d reviews from browser API page %d", len(page_reviews), page_num)

                # Retry product metadata extraction after page 1 API call.
                # By now the browser page has had time to fully render (React
                # hydration complete), so OG/JSON-LD tags should be present.
                if page_num == 1 and self.product_meta is None:
                    try:
                        # Wait for JSON-LD to appear (React injects it after hydration).
                        try:
                            page.wait_for_selector(
                                'script[type="application/ld+json"]',
                                timeout=15_000,
                            )
                            logger.info("JSON-LD script tag appeared in DOM")
                        except Exception:
                            logger.info("JSON-LD script tag not found after 15s -- trying anyway")

                        rendered_html = page.content() or ""
                        logger.info("Post-API page content: %d bytes", len(rendered_html))
                        if len(rendered_html) > 500:
                            meta = parser.parse_product_meta(rendered_html, url=self.url)
                            if meta:
                                self.product_meta = meta
                                logger.info(
                                    "Extracted product meta (post-API): %s",
                                    meta.name[:60],
                                )
                            else:
                                logger.info("parse_product_meta returned None from %d bytes -- trying JS fallback", len(rendered_html))

                        # JS-based fallback: extract metadata directly from
                        # the live DOM via page.evaluate() -- avoids HTML
                        # serialisation issues with page.content().
                        if self.product_meta is None:
                            self._extract_meta_via_js(page, parser, logger)

                    except Exception as meta_exc:
                        logger.info("Post-API meta extraction failed: %s", meta_exc)

                new_reviews = []
                for r in page_reviews:
                    if r.review_id:
                        if r.review_id in seen_ids:
                            continue
                        seen_ids.add(r.review_id)
                    else:
                        key = (BaseParser._text_fingerprint(r.text), r.rating)
                        if key in seen_text:
                            continue
                        seen_text.add(key)
                    new_reviews.append(r)

                if not new_reviews and page_num == 1:
                    logger.info("Browser API returned no new reviews on page 1 (parsed=%d)", len(page_reviews))
                    # Log a snippet of the response for debugging
                    logger.info("Response snippet: %s", text[:300])
                    return False

                if not new_reviews:
                    logger.info("No new reviews on page %d -- pagination exhausted", page_num)
                    break

                self.reviews.extend(new_reviews)
                self.total_reviews = len(self.reviews)
                self.message = f"Browser API page {page_num}: {len(new_reviews)} new, {self.total_reviews} total"
                logger.info(self.message)

                if self.max_reviews > 0 and self.total_reviews >= self.max_reviews:
                    self.reviews = self.reviews[:self.max_reviews]
                    self.total_reviews = len(self.reviews)
                    break

                if not parser.api_has_next_page(text, page_num):
                    logger.info("No more pages after page %d", page_num)
                    break

        except Exception as exc:
            logger.info("Browser API phase error: %s", exc, exc_info=True)
            if not self.reviews:
                return False

        if self.reviews:
            logger.info(
                "Browser API phase succeeded: %d reviews from %s",
                self.total_reviews, parser.name,
            )
            return True

        return False

    # ------------------------------------------------------------------
    # Phase 2: Browser/HTML scraping (Playwright fallback)
    # ------------------------------------------------------------------

    def _run_browser_phase(self, fetcher, parser, url_batches: list[str]) -> None:
        """Playwright-based scraping as fallback."""
        use_js = bool(self.options.get("render_js")) or parser.requires_js
        infinite_scroll = getattr(parser, "uses_infinite_scroll", False)
        seen_ids: set[str] = set()
        seen_text: set[tuple[str, float]] = set()

        # Carry over already-seen reviews from API phase (if any partial results).
        for r in self.reviews:
            if r.review_id:
                seen_ids.add(r.review_id)
            else:
                seen_text.add((BaseParser._text_fingerprint(r.text), r.rating))

        global_page = 0
        first_batch_pages = 0
        hit_max = False
        batch_new_counts: dict[int, int] = {}
        # Amazon: 13 batches (1 product page + 2 unfiltered + 10 star).
        # Flipkart: 11 batches (1 unfiltered + 10 star).
        # Others: variable.
        num_extra = 3 if len(url_batches) == 13 else (2 if len(url_batches) == 12 else 1)
        star_batch_count = (len(url_batches) - num_extra) // 2 if len(url_batches) > num_extra else 0

        for batch_idx, batch_url in enumerate(url_batches):
            if self.max_reviews > 0 and self.total_reviews >= self.max_reviews:
                hit_max = True
                break

            if batch_idx >= 1 and first_batch_pages >= 10:
                pass
            elif batch_idx >= 1 and first_batch_pages >= 1:
                pass

            if star_batch_count > 0 and batch_idx > num_extra + star_batch_count - 1:
                recent_idx = batch_idx - star_batch_count
                recent_new = batch_new_counts.get(recent_idx, 0)
                if recent_new < 3:
                    continue

            current_url = batch_url
            next_click_selector: Optional[str] = None
            batch_pages = 0
            reviews_before_batch = len(self.reviews)
            consecutive_dupe_pages = 0

            try:
                for page_in_batch in itertools.count(1):
                    global_page += 1
                    if self.max_pages > 0 and global_page > self.max_pages:
                        self.message = f"Reached page limit ({self.max_pages})."
                        hit_max = True
                        break

                    self.current_page = global_page

                    if infinite_scroll:
                        if page_in_batch == 1:
                            self.message = f"Loading reviews (batch {batch_idx + 1}/{len(url_batches)})..."
                            html = fetcher.fetch_html_rendered(current_url)
                        else:
                            self.message = (
                                f"Scrolling for more reviews (scroll {page_in_batch - 1}, "
                                f"batch {batch_idx + 1}/{len(url_batches)})..."
                            )
                            html = fetcher.scroll_for_infinite_content()
                    elif use_js:
                        self.message = f"Fetching page {global_page} (batch {batch_idx + 1}/{len(url_batches)})..."
                        if page_in_batch == 1:
                            html = fetcher.fetch_html_rendered(current_url)
                        else:
                            if next_click_selector:
                                self.message = f"Clicking next (page {global_page})..."
                                try:
                                    html = fetcher.click_and_get_rendered_html(
                                        next_click_selector,
                                        context_url=current_url,
                                    )
                                    current_url = fetcher.rendered_current_url() or current_url
                                except Exception:
                                    next_click_selector = None
                                    fallback_url = parser.get_next_page_url(
                                        html, current_url, page_in_batch - 1
                                    )
                                    if fallback_url and fallback_url != current_url:
                                        self.message = f"Click failed, navigating to page {global_page}..."
                                        current_url = fallback_url
                                        html = fetcher.fetch_html_rendered(current_url)
                                    else:
                                        break
                            else:
                                html = fetcher.fetch_html_rendered(current_url)
                    else:
                        self.message = f"Fetching page {global_page} (batch {batch_idx + 1}/{len(url_batches)})..."
                        html = fetcher.fetch_html(current_url)

                    self.message = f"Parsing page {global_page}..."

                    # Extract product metadata from the first page of the first batch.
                    if global_page == 1 and batch_idx == 0 and self.product_meta is None:
                        try:
                            meta = parser.parse_product_meta(html, url=current_url)
                            if meta:
                                self.product_meta = meta
                        except Exception:
                            pass

                    page_reviews = parser.parse(html, url=current_url)

                    new_reviews: list[Review] = []
                    for r in page_reviews:
                        if r.review_id:
                            if r.review_id in seen_ids:
                                continue
                            seen_ids.add(r.review_id)
                        else:
                            key = (BaseParser._text_fingerprint(r.text), r.rating)
                            if key in seen_text:
                                continue
                            seen_text.add(key)
                        new_reviews.append(r)

                    dupes = len(page_reviews) - len(new_reviews)

                    if not page_reviews:
                        if global_page == 1 and batch_idx == 0 and use_js:
                            import time as _time
                            self.message = "No reviews on first load, retrying..."
                            _time.sleep(3)
                            html = fetcher.fetch_html_rendered(current_url)
                            page_reviews = parser.parse(html, url=current_url)
                            if page_reviews:
                                for r in page_reviews:
                                    if r.review_id:
                                        if r.review_id in seen_ids:
                                            continue
                                        seen_ids.add(r.review_id)
                                    else:
                                        key = (BaseParser._text_fingerprint(r.text), r.rating)
                                        if key in seen_text:
                                            continue
                                        seen_text.add(key)
                                    new_reviews.append(r)
                                dupes = len(page_reviews) - len(new_reviews)

                        if not page_reviews:
                            if global_page == 1:
                                self.message = "No reviews found on page 1"
                            else:
                                self.message = f"Empty page {global_page} - end of batch"
                            break

                    if new_reviews:
                        consecutive_dupe_pages = 0
                    else:
                        consecutive_dupe_pages += 1
                        max_dupe = 5 if batch_idx >= 1 else 3
                        if consecutive_dupe_pages >= max_dupe:
                            self.message = (
                                f"{max_dupe} dupe pages - skipping rest of batch "
                                f"({self.total_reviews} unique total)"
                            )
                            break

                    self.reviews.extend(new_reviews)
                    self.total_reviews = len(self.reviews)

                    if self.max_reviews > 0 and self.total_reviews >= self.max_reviews:
                        self.reviews = self.reviews[:self.max_reviews]
                        self.total_reviews = len(self.reviews)
                        self.message = (
                            f"Reached review limit ({self.max_reviews}). "
                            f"{self.total_reviews} unique reviews collected"
                        )
                        hit_max = True
                        break

                    self.message = (
                        f"Page {global_page}: {len(new_reviews)} new, "
                        f"{dupes} dupes, {self.total_reviews} unique total"
                    )
                    batch_pages += 1

                    if infinite_scroll:
                        continue

                    next_click_selector = (
                        parser.get_next_page_selenium_selector(
                            html, current_url, page_in_batch
                        )
                        if use_js
                        else None
                    )
                    if use_js and next_click_selector:
                        continue

                    next_url = parser.get_next_page_url(
                        html, current_url, page_in_batch
                    )
                    if not next_url or next_url == current_url:
                        break
                    current_url = next_url
                    next_click_selector = None

            except Exception as exc:
                exc_name = type(exc).__name__
                exc_msg = str(exc)
                if "sign-in" in exc_msg.lower() or "signin" in exc_msg.lower():
                    self.message = (
                        f"Blocked: redirected to sign-in page. "
                        f"Your cookies may be expired. "
                        f"({self.total_reviews} reviews saved)"
                    )
                elif "blocked" in exc_msg.lower() or "captcha" in exc_msg.lower():
                    self.message = (
                        f"Blocked by site (captcha/rate limit). "
                        f"Try again later or refresh cookies. "
                        f"({self.total_reviews} reviews saved)"
                    )
                else:
                    self.message = (
                        f"Batch {batch_idx + 1} stopped: {exc_name} "
                        f"({self.total_reviews} reviews collected so far)"
                    )
                hit_max = True

            batch_new_counts[batch_idx] = len(self.reviews) - reviews_before_batch
            if batch_idx == 0:
                first_batch_pages = batch_pages
            if hit_max:
                break


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/detect")
def detect_site():
    url = request.args.get("url", "")
    if not url:
        return jsonify({"detected": False})

    parser = get_parser_for_url(url)
    if parser is None:
        return jsonify({"detected": False})

    cookie_file = find_cookie_file(_COOKIES_DIR, url)
    return jsonify({
        "detected": True,
        "site": parser.name,
        "requires_js": parser.requires_js,
        "cookies_found": cookie_file is not None,
    })


@app.route("/api/scrape", methods=["POST"])
def start_scrape():
    data = request.get_json()
    if not data or not data.get("url"):
        return jsonify({"error": "URL is required"}), 400

    job = ScrapeJob(data["url"], data)
    _jobs[job.job_id] = job
    thread = threading.Thread(target=job.run, daemon=True)
    thread.start()
    return jsonify({"job_id": job.job_id})


@app.route("/api/status/<job_id>")
def get_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    result: dict = {
        "status": job.status,
        "current_page": job.current_page,
        "max_pages": job.max_pages,
        "max_reviews": job.max_reviews,
        "total_reviews": job.total_reviews,
        "message": job.message,
        "site_name": job.site_name,
        "error": job.error,
    }

    # Include product metadata as soon as it's available (the Chrome
    # extension renders a product card from this during polling).
    if job.product_meta is not None:
        result["product"] = job.product_meta.to_dict()

    if job.status == "completed":
        result["reviews"] = [
            {"text": r.text, "rating": r.rating, "date": r.date}
            for r in job.reviews
        ]

    return jsonify(result)


@app.route("/api/download/<job_id>")
def download_csv(job_id: str):
    job = _jobs.get(job_id)
    if not job or job.status != "completed" or not job.reviews:
        return "Not found", 404

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["review_text", "rating", "date"])
    for r in job.reviews:
        if abs(r.rating - round(r.rating)) < 1e-9:
            rating_out = str(int(round(r.rating)))
        else:
            rating_out = str(r.rating)
        writer.writerow([r.text, rating_out, r.date])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=reviews.csv"},
    )


@app.route("/api/cookies/status")
def cookie_status():
    sites = cookie_manager.get_all_status()
    scheduler = cookie_manager.get_scheduler_state()
    return jsonify({"sites": sites, "scheduler": scheduler})


@app.route("/api/cookies/status/<site_key>")
def cookie_site_status(site_key: str):
    try:
        return jsonify(cookie_manager.get_site_status(site_key))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404


@app.route("/api/cookies/import/<site_key>", methods=["POST"])
def cookie_import(site_key: str):
    data = request.get_json() or {}
    cookie_text = data.get("cookies", "")
    try:
        result = cookie_manager.import_cookies(site_key, cookie_text)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/cookies/refresh/<site_key>", methods=["POST"])
def cookie_refresh_site(site_key: str):
    try:
        result = cookie_manager.refresh_site(site_key)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404


@app.route("/api/cookies/refresh-all", methods=["POST"])
def cookie_refresh_all():
    results = cookie_manager.refresh_all()
    scheduler = cookie_manager.get_scheduler_state()
    return jsonify({"sites": results, "scheduler": scheduler})


@app.route("/api/cookies/scheduler", methods=["GET"])
def cookie_scheduler_get():
    return jsonify(cookie_manager.get_scheduler_state())


@app.route("/api/cookies/scheduler", methods=["POST"])
def cookie_scheduler_update():
    data = request.get_json() or {}
    enabled = data.get("enabled", False)
    interval = data.get("interval_seconds")
    result = cookie_manager.configure_scheduler(enabled, interval)
    return jsonify(result)


if __name__ == "__main__":
    import logging
    import sys

    # Configure Python logging so all review_scraper.* logger output
    # goes to stderr (captured by systemd → visible in journalctl).
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )

    app.run(debug=False, host="127.0.0.1", port=5000)
