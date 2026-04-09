from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin
from urllib.parse import urlparse

import httpx

from review_scraper.core.playwright_config import (
    BLOCKED_RESOURCE_TYPES,
    BROWSER_LAUNCH_ARGS,
    COMBINED_STEALTH_SCRIPT,
    ProxyConfig,
    REVIEW_WAIT_SELECTOR,
    UA_POOL,
    build_context_options,
    random_ua,
    should_block_route,
)
from review_scraper.utils.robots_checker import RobotsChecker

logger = logging.getLogger("review_scraper.fetcher")


class FetchError(RuntimeError):
    """Raised for non-blocking fetch failures."""


class BlockedError(RuntimeError):
    """Raised when the target site appears to block automated access."""


class RobotsDisallowedError(RuntimeError):
    """Raised when robots.txt does not permit fetching the URL."""


@dataclass
class FetchConfig:
    min_delay_s: float = 2.0
    max_delay_s: float = 4.0
    timeout_s: float = 20.0
    max_retries: int = 2


class Fetcher:
    """HTTP fetcher with robots compliance, cookies, retries, and rate limiting."""

    def __init__(
        self,
        *,
        user_agent: str = "",
        config: Optional[FetchConfig] = None,
        robots_checker: Optional[RobotsChecker] = None,
        cookies: Optional[Dict[str, str]] = None,
        browser_cookies: Optional[List[dict]] = None,
        selenium_cookies: Optional[List[dict]] = None,
        proxy: Optional[ProxyConfig] = None,
    ) -> None:
        self._user_agent = user_agent or random_ua()
        self._config = config or FetchConfig()
        self._robots = robots_checker
        self._cookies = cookies or {}
        self._browser_cookies = browser_cookies or selenium_cookies or []
        self._proxy = proxy
        self._last_request_ts: Optional[float] = None
        self._last_fetched_url: Optional[str] = None  # For Referer header.
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._browser_cookies_set: bool = False

        # Build httpx proxy kwarg (single URL string for httpx).
        _httpx_proxy = self._proxy.httpx_url if self._proxy else None
        # Web Unlocker / MITM proxies use self-signed certs for HTTPS;
        # disable SSL verification when routing through a proxy.
        _verify_ssl = not bool(self._proxy)
        if _httpx_proxy:
            logger.info("HTTP clients using proxy: %s", self._proxy.server)

        self._client = httpx.Client(
            cookies=self._cookies,
            headers={
                "User-Agent": self._user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
                # Let httpx negotiate Accept-Encoding automatically based on
                # installed decoders (gzip, deflate, brotli).
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Sec-Ch-Ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
            },
            timeout=httpx.Timeout(self._config.timeout_s),
            follow_redirects=False,
            proxy=_httpx_proxy,
            verify=_verify_ssl,
        )

        # Separate client for API calls (accepts JSON, follows redirects).
        self._api_client = httpx.Client(
            cookies=self._cookies,
            headers={
                "User-Agent": self._user_agent,
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
                # Let httpx negotiate Accept-Encoding automatically.
                "Cache-Control": "no-cache",
                "Sec-Ch-Ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
            },
            timeout=httpx.Timeout(self._config.timeout_s),
            follow_redirects=True,
            proxy=_httpx_proxy,
            verify=_verify_ssl,
        )

        if self._cookies:
            logger.info("Loaded %d cookies into HTTP client", len(self._cookies))

    def _rotate_ua(self) -> str:
        """Pick a random UA from the pool for the next request."""
        self._user_agent = random_ua()
        self._client.headers["User-Agent"] = self._user_agent
        self._api_client.headers["User-Agent"] = self._user_agent
        return self._user_agent

    def close(self) -> None:
        self._client.close()
        self._api_client.close()
        if self._context is not None:
            try:
                self._context.close()
            except Exception:
                pass
            self._context = None
        if self._browser is not None:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
        self._page = None

    def __enter__(self) -> "Fetcher":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def fetch_html(self, url: str) -> str:
        """Fetch the URL and return response HTML."""

        last_exc: Optional[BaseException] = None
        for attempt in range(self._config.max_retries + 1):
            current_url = url
            redirects_left = 5

            while True:
                if self._robots and not self._robots.is_allowed(current_url, user_agent=self._user_agent):
                    raise RobotsDisallowedError(f"robots.txt disallows: {current_url}")

                self._rate_limit_sleep()
                req_headers: dict[str, str] = {}
                if self._last_fetched_url:
                    req_headers["Referer"] = self._last_fetched_url
                try:
                    resp = self._client.get(current_url, headers=req_headers)
                except httpx.RequestError as exc:
                    last_exc = exc
                    break

                if resp.status_code in (401, 403):
                    raise BlockedError(f"Blocked with HTTP {resp.status_code} for {current_url}")

                if resp.status_code == 429:
                    retry_after = resp.headers.get("Retry-After")
                    backoff = 30.0
                    if retry_after:
                        try:
                            backoff = max(backoff, float(retry_after))
                        except ValueError:
                            pass
                    logger.warning("Rate limited (429) on %s - backing off %.0fs", current_url, backoff)
                    time.sleep(backoff + random.uniform(5.0, 15.0))
                    last_exc = BlockedError(f"Rate limited (429) for {current_url}")
                    break

                if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("Location"):
                    if redirects_left <= 0:
                        raise FetchError(f"Too many redirects for {url}")
                    next_url = urljoin(current_url, resp.headers["Location"])
                    if next_url == current_url:
                        raise FetchError(f"Redirect loop detected for {url}")
                    current_url = next_url
                    redirects_left -= 1
                    continue

                if resp.status_code in (503, 520, 521, 522, 523, 524) and self._looks_blocked(resp.text or ""):
                    raise BlockedError(f"Blocked page detected with HTTP {resp.status_code} for {current_url}")

                if 500 <= resp.status_code <= 599:
                    last_exc = FetchError(f"Server error HTTP {resp.status_code} for {current_url}")
                    break

                if resp.status_code != 200:
                    raise FetchError(f"Unexpected HTTP {resp.status_code} for {current_url}")

                html = resp.text
                if self._looks_blocked(html):
                    raise BlockedError("Blocked page detected (captcha/access denied)")
                self._last_fetched_url = current_url
                return html

            self._retry_sleep(attempt)
            continue

        raise FetchError(f"Failed to fetch after retries: {url}. Last error: {last_exc}")

    def fetch_api(
        self,
        url: str,
        *,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        referer: Optional[str] = None,
        method: str = "GET",
        json_body: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Fetch a JSON API endpoint via plain HTTP. Returns the response text.

        Supports GET (default) and POST with JSON body.
        Raises FetchError on failure. Does NOT raise BlockedError -- callers
        should fall back to browser rendering when API calls fail.
        """
        self._rate_limit_sleep()
        self._rotate_ua()

        req_headers: dict[str, str] = {}
        if referer:
            req_headers["Referer"] = referer
        if headers:
            req_headers.update(headers)

        last_exc: Optional[BaseException] = None
        for attempt in range(self._config.max_retries + 1):
            try:
                if method.upper() == "POST":
                    resp = self._api_client.post(
                        url, headers=req_headers, params=params, json=json_body,
                    )
                else:
                    resp = self._api_client.get(url, headers=req_headers, params=params)

                if resp.status_code == 429:
                    backoff = 15.0 + random.uniform(5.0, 15.0)
                    logger.warning("API rate limited (429) on %s -- backing off %.0fs", url, backoff)
                    time.sleep(backoff)
                    last_exc = FetchError(f"API rate limited (429) for {url}")
                    continue

                if resp.status_code in (401, 403):
                    raise FetchError(f"API auth error HTTP {resp.status_code} for {url}")

                if 500 <= resp.status_code <= 599:
                    last_exc = FetchError(f"API server error HTTP {resp.status_code} for {url}")
                    self._retry_sleep(attempt)
                    continue

                if resp.status_code != 200:
                    raise FetchError(f"API unexpected HTTP {resp.status_code} for {url}")

                text = resp.text
                if not text or not text.strip():
                    raise FetchError("Empty API response")
                return text

            except httpx.RequestError as exc:
                last_exc = exc
                self._retry_sleep(attempt)
                continue

        raise FetchError(f"API fetch failed after retries: {url}. Last error: {last_exc}")

    def fetch_html_rendered(self, url: str) -> str:
        """Render a URL via Playwright and return the page source.

        Uses smart waiting for review content instead of blind sleeps.
        Skips the HTTP-based robots.txt check to avoid poisoning the IP
        with a non-browser request before Playwright loads the page.
        """

        page = self._get_or_create_page()

        # When routing through a proxy (e.g. Web Unlocker), navigation
        # takes longer because the proxy may need to solve challenges.
        # Use a generous timeout (60s) for proxy, standard otherwise.
        nav_timeout = 60_000 if self._proxy else int(self._config.timeout_s * 1000)

        # Inject cookies on first request.
        if self._browser_cookies and not self._browser_cookies_set:
            parsed = urlparse(url)
            seed_url = f"{parsed.scheme}://{parsed.netloc}/"
            self._rate_limit_sleep()
            page.goto(seed_url, wait_until="domcontentloaded", timeout=nav_timeout)
            logger.info("Injecting %d cookies into browser session", len(self._browser_cookies))
            self._context.add_cookies(self._browser_cookies)
            self._browser_cookies_set = True

        self._rate_limit_sleep()
        # Use "load" wait for proxy (ensures all resources/scripts loaded
        # after Web Unlocker finishes solving challenges), "domcontentloaded"
        # for direct connections (faster, most SPAs hydrate quickly).
        wait_event = "load" if self._proxy else "domcontentloaded"
        page.goto(url, wait_until=wait_event, timeout=nav_timeout)

        # Smart wait: wait for review containers or page load completion.
        # Give proxy-served pages more time -- React apps need to hydrate
        # and render review data after the initial JS bundle loads.
        content_timeout = 15.0 if self._proxy else 6.0
        self._wait_for_content(page, timeout=content_timeout)

        # Quick scroll to trigger any lazy-loaded content.
        self._scroll_page(page)

        final_url = page.url or url
        if final_url != url and self._looks_like_signin(final_url):
            raise BlockedError(f"Redirected to sign-in page (rate limited): {url}")
        if final_url != url and self._robots and not self._robots.is_allowed(final_url, user_agent=self._user_agent):
            raise RobotsDisallowedError(f"robots.txt disallows redirected URL: {final_url}")

        html = page.content() or ""
        if not html.strip():
            raise FetchError("Empty rendered HTML")
        if self._looks_blocked(html):
            raise BlockedError("Blocked page detected (captcha/access denied)")
        return html

    def scroll_for_infinite_content(self, wait_s: float = 4.0) -> str:
        """Scroll to the page bottom for infinite-scroll sites.

        Uses progressive scrolling with height-change detection to handle
        lazy-loaded review content.  Waits up to *wait_s* seconds for new
        content to appear after each scroll.
        """
        page = self._get_or_create_page()

        prev_height = page.evaluate("document.body.scrollHeight")

        # Progressive scroll: scroll in steps to trigger intermediate
        # lazy-load triggers, not just the final bottom.
        _scroll_steps = 3
        for step in range(1, _scroll_steps + 1):
            fraction = step / _scroll_steps
            page.evaluate(
                f"window.scrollTo(0, document.body.scrollHeight * {fraction})"
            )
            page.wait_for_timeout(300)

        # Final scroll to absolute bottom.
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

        # Use MutationObserver-based wait for new content, with a polling
        # fallback for browsers/pages where mutations aren't observable.
        try:
            page.evaluate("""
                () => new Promise((resolve) => {
                    let resolved = false;
                    const observer = new MutationObserver(() => {
                        if (!resolved) {
                            resolved = true;
                            observer.disconnect();
                            // Give rendering a moment to finish.
                            setTimeout(resolve, 500);
                        }
                    });
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                    });
                    // Timeout fallback.
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            observer.disconnect();
                            resolve();
                        }
                    }, %d);
                })
            """ % int(wait_s * 1000))
        except Exception:
            # Fallback: poll for height increase.
            deadline = time.time() + wait_s
            while time.time() < deadline:
                page.wait_for_timeout(500)
                new_height = page.evaluate("document.body.scrollHeight")
                if new_height > prev_height:
                    page.wait_for_timeout(500)
                    break

        final_url = page.url or ""
        if final_url and self._looks_like_signin(final_url):
            raise BlockedError(f"Redirected to sign-in page: {final_url}")

        html = page.content() or ""
        if not html.strip():
            raise FetchError("Empty rendered HTML after scroll")
        if self._looks_blocked(html):
            raise BlockedError("Blocked page detected (captcha/access denied)")

        return html

    def rendered_current_url(self) -> str:
        if self._page is None:
            return ""
        try:
            return self._page.url or ""
        except Exception:
            return ""

    def evaluate_in_page(self, js_expression: str):
        """Evaluate a JavaScript expression in the current Playwright page.

        This is used for browser-mediated API calls where we need to
        call fetch() from within the browser context (using the browser's
        established cookies/session) to bypass WAF protections.

        Args:
            js_expression: A JavaScript expression or async IIFE to evaluate.

        Returns:
            The result of the JavaScript evaluation (typically a dict).

        Raises:
            FetchError: If no page is loaded or evaluation fails.
        """
        if self._page is None:
            raise FetchError("No browser page loaded -- call fetch_html_rendered first")
        try:
            return self._page.evaluate(js_expression)
        except Exception as exc:
            raise FetchError(f"Browser evaluate failed: {exc}") from exc

    def click_and_get_rendered_html(
        self,
        css_selector: str,
        *,
        context_url: str,
    ) -> str:
        """Click a pagination control and return updated HTML."""

        page = self._get_or_create_page()

        if context_url:
            self._rate_limit_sleep()

        try:
            from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        except Exception as exc:
            raise FetchError("Playwright is required for click pagination") from exc

        try:
            locator = page.locator(css_selector).first
            if locator.count() == 0:
                raise FetchError(f"Element not found: {css_selector}")
        except Exception as exc:
            raise FetchError(f"Playwright element not found: {css_selector}") from exc

        # Capture state before click to detect page navigation.
        url_before = page.url

        # Scroll element into view before clicking to avoid interception.
        try:
            locator.scroll_into_view_if_needed(timeout=3000)
            page.wait_for_timeout(300)
        except Exception:
            pass

        try:
            with page.expect_navigation(wait_until="domcontentloaded", timeout=8000):
                locator.click(timeout=5000)
        except PlaywrightTimeoutError:
            # Not all sites trigger a full navigation after pagination click.
            locator.click(timeout=5000)
            page.wait_for_timeout(1500)
        except Exception as exc:
            raise FetchError(f"Failed to click selector: {css_selector}") from exc

        # If URL did not change, allow client-side rendered content to settle.
        if page.url == url_before:
            page.wait_for_timeout(1000)

        # Now wait for new content to appear on the fresh page.
        self._wait_for_content(page)
        self._scroll_page(page)

        final_url = page.url or context_url
        if final_url and self._looks_like_signin(final_url):
            raise BlockedError(f"Redirected to sign-in page (rate limited): {context_url}")
        if self._robots and final_url and not self._robots.is_allowed(final_url, user_agent=self._user_agent):
            raise RobotsDisallowedError(f"robots.txt disallows URL after click: {final_url}")

        html = page.content() or ""
        if not html.strip():
            raise FetchError("Empty rendered HTML after click")
        if self._looks_blocked(html):
            raise BlockedError("Blocked page detected (captcha/access denied)")
        return html

    # ------------------------------------------------------------------
    # Playwright browser lifecycle
    # ------------------------------------------------------------------

    def _get_or_create_page(self):
        if self._page is not None:
            return self._page

        try:
            from playwright.sync_api import sync_playwright
        except Exception as exc:
            raise FetchError(
                "Playwright is required for JS-rendered pages. "
                "Install playwright and run `playwright install chromium`."
            ) from exc

        self._playwright = sync_playwright().start()
        launch_args = list(BROWSER_LAUNCH_ARGS)
        if self._proxy:
            # Web Unlocker proxies use self-signed certs for HTTPS interception.
            launch_args.append("--ignore-certificate-errors")
        self._browser = self._playwright.chromium.launch(
            headless=True,
            args=launch_args,
        )

        context_opts = build_context_options(self._user_agent, proxy=self._proxy)
        self._context = self._browser.new_context(**context_opts)

        # Inject all stealth scripts before any page loads.
        self._context.add_init_script(COMBINED_STEALTH_SCRIPT)

        # Block unnecessary resources for speed.
        self._context.route("**/*", self._route_handler)

        self._page = self._context.new_page()
        self._page.set_default_timeout(int(self._config.timeout_s * 1000))

        # Navigate to blank to initialise the page.
        self._page.goto("about:blank", wait_until="domcontentloaded")
        proxy_note = f", proxy={self._proxy.server}" if self._proxy else ""
        logger.info("Playwright Chromium ready (stealth mode, resource blocking enabled%s)", proxy_note)

        return self._page

    @staticmethod
    def _route_handler(route) -> None:
        """Intercept requests and block unnecessary resources."""
        request = route.request
        if should_block_route(request.url, request.resource_type):
            route.abort()
        else:
            route.continue_()

    # ------------------------------------------------------------------
    # Content waiting
    # ------------------------------------------------------------------

    @staticmethod
    def _wait_for_content(page, timeout: float = 6.0) -> None:
        """Wait for review content to appear, up to timeout seconds.

        Uses the shared REVIEW_WAIT_SELECTOR from playwright_config.
        Falls back to DOM-stability detection when selectors don't match
        (e.g. React Native Web apps with obfuscated/generic class names).
        """
        try:
            page.wait_for_selector(
                REVIEW_WAIT_SELECTOR,
                state="attached",
                timeout=int(timeout * 1000),
            )
            return  # Selector matched -- content is present.
        except Exception:
            pass

        # Fallback 1: wait for networkidle (all pending requests finished).
        try:
            page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass

        # Fallback 2: DOM-stability check -- wait until page size stops
        # growing, indicating React/SPA has finished rendering.  This
        # catches dynamically-loaded review content that doesn't match
        # any known CSS selector.
        try:
            prev_len = len(page.content() or "")
            for _ in range(6):  # Up to ~6 seconds of polling.
                page.wait_for_timeout(1000)
                cur_len = len(page.content() or "")
                if cur_len == prev_len:
                    break  # DOM has stabilized.
                prev_len = cur_len
        except Exception:
            pass

    @staticmethod
    def _scroll_page(page) -> None:
        """Scroll through the page to trigger lazy-loaded content.

        Uses progressive scrolling with longer waits at each step to allow
        React/React Native Web apps time to render dynamically-loaded
        review content after intersection-observer triggers fire.
        """
        try:
            # Smooth scroll through the page in steps.
            page.evaluate("""
                () => {
                    const h = document.body.scrollHeight;
                    window.scrollTo({top: h * 0.3, behavior: 'instant'});
                }
            """)
            page.wait_for_timeout(800)
            page.evaluate("""
                () => {
                    const h = document.body.scrollHeight;
                    window.scrollTo({top: h * 0.6, behavior: 'instant'});
                }
            """)
            page.wait_for_timeout(800)
            page.evaluate("window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'})")
            page.wait_for_timeout(1200)
            # Back to top for pagination controls.
            page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
            page.wait_for_timeout(300)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Rate limiting & retries
    # ------------------------------------------------------------------

    def _rate_limit_sleep(self) -> None:
        """Rate limiting with randomised delay. No progressive slowdown."""

        min_delay = self._config.min_delay_s
        max_delay = self._config.max_delay_s

        delay = random.uniform(min_delay, max_delay)

        # Credit time already spent since last request.
        if self._last_request_ts is not None:
            elapsed = time.time() - self._last_request_ts
            delay = max(0.0, delay - elapsed)
        if delay > 0:
            logger.debug("Rate-limit sleep: %.1fs", delay)
            time.sleep(delay)

        self._last_request_ts = time.time()

    # ------------------------------------------------------------------
    # Detection helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _looks_like_signin(url: str) -> bool:
        """Check if a URL looks like a sign-in/login redirect."""
        lower = url.lower()
        return any(p in lower for p in (
            "/ap/signin",       # Amazon
            "/accounts/login",  # Flipkart
            "/login?",          # Myntra / generic
            "/login/phone",     # Myntra
            "/account/login",   # Flipkart alt
        ))

    @staticmethod
    def _looks_blocked(html: str) -> bool:
        # For very short pages (< 5KB), a block/captcha marker is strong signal.
        # For full pages (> 50KB), the word "captcha" can appear in JS config
        # (e.g. Flipkart's COD captcha A/B tests) without meaning we're blocked.
        hay = html.lower()
        page_len = len(html)

        # These are strong signals regardless of page size.
        strong_markers = (
            "robot check",
            "temporarily blocked",
            "unusual traffic",
            "verify you are a human",
            "are you a human",
            "automated access to this page",
            "please enable javascript",
            "browser verification",
            "recaptcha",
        )
        if any(m in hay for m in strong_markers):
            # On large pages (> 50KB), "recaptcha" can appear in JS configs
            # for Flipkart's COD captcha A/B tests -- only flag if page is small.
            if "recaptcha" in hay and page_len > 10_000:
                pass  # Don't flag large pages with recaptcha in JS.
            else:
                return True

        # "captcha" and "access denied" are only meaningful on short/stub pages
        # (actual captcha challenge pages are small). On full-size pages they
        # can appear in embedded JS configs.
        if page_len < 10_000:
            weak_markers = ("captcha", "access denied")
            if any(m in hay for m in weak_markers):
                return True

        return False

    @staticmethod
    def _retry_sleep(attempt: int) -> None:
        base = min(30.0, 2.0 ** (attempt + 1))
        jitter = random.uniform(1.0, 5.0)
        total = base + jitter
        logger.debug("Retry backoff: %.1fs (attempt %d)", total, attempt + 1)
        time.sleep(total)
