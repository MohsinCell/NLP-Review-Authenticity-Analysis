"""Centralized Playwright configuration for the review scraper.

This module defines all browser launch arguments, context options, stealth
scripts, and resource-blocking rules in one place.  Both the scraping fetcher
and the cookie-refresh manager import from here to stay in sync.
"""

from __future__ import annotations

import logging
import os
import random
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger("review_scraper.proxy")


# ──────────────────────────────────────────────────────────────────────
# Proxy support -- provider-agnostic (works with any HTTP proxy URL)
#
# Expected env var: PROXY_URL
# Format: http://username:password@host:port
# Bright Data example:
#   http://brd-customer-XXXX-zone-residential:PASSWORD@brd.superproxy.io:33335
# ──────────────────────────────────────────────────────────────────────


@dataclass
class ProxyConfig:
    """Parsed proxy configuration, provider-agnostic."""
    server: str          # e.g. "http://brd.superproxy.io:33335"
    username: str = ""
    password: str = ""

    @property
    def has_auth(self) -> bool:
        return bool(self.username)

    @property
    def httpx_url(self) -> str:
        """Full proxy URL for httpx (includes credentials in URL)."""
        if not self.has_auth:
            return self.server
        parsed = urlparse(self.server)
        return f"{parsed.scheme}://{self.username}:{self.password}@{parsed.hostname}:{parsed.port}"

    @property
    def playwright_dict(self) -> dict[str, str]:
        """Proxy dict for Playwright's browser.new_context(proxy=...)."""
        d: dict[str, str] = {"server": self.server}
        if self.has_auth:
            d["username"] = self.username
            d["password"] = self.password
        return d


def parse_proxy_url(proxy_url: str) -> ProxyConfig:
    """Parse a proxy URL string into a ProxyConfig.

    Accepts formats like:
      http://user:pass@host:port
      http://host:port
      socks5://user:pass@host:port
    """
    proxy_url = proxy_url.strip()
    if not proxy_url:
        raise ValueError("Empty proxy URL")

    parsed = urlparse(proxy_url)
    scheme = parsed.scheme or "http"
    hostname = parsed.hostname
    port = parsed.port

    if not hostname:
        raise ValueError(f"Invalid proxy URL (no host): {proxy_url}")

    server = f"{scheme}://{hostname}"
    if port:
        server += f":{port}"

    username = parsed.username or ""
    password = parsed.password or ""

    return ProxyConfig(server=server, username=username, password=password)


def load_proxy_from_env() -> Optional[ProxyConfig]:
    """Load proxy config from PROXY_URL environment variable.

    Returns None if the env var is not set or empty.
    """
    proxy_url = os.environ.get("PROXY_URL", "").strip()
    if not proxy_url:
        return None
    try:
        cfg = parse_proxy_url(proxy_url)
        logger.info(
            "Proxy loaded from PROXY_URL: %s (auth=%s)",
            cfg.server, "yes" if cfg.has_auth else "no",
        )
        return cfg
    except ValueError as exc:
        logger.error("Invalid PROXY_URL env var: %s", exc)
        return None




def load_site_proxy_from_env(site_name: str) -> Optional[ProxyConfig]:
    """Load a site-specific proxy from PROXY_URL_<SITE> env var.

    Falls back to the default PROXY_URL if no site-specific var exists.
    Returns None if neither is set.

    Examples:
        PROXY_URL_MYNTRA=http://user-xxx-country-in:pass@gate.decodo.com:7000
        PROXY_URL=http://scraperapi...:key@proxy-server.scraperapi.com:8001
    """
    site_upper = site_name.upper()
    site_url = os.environ.get(f"PROXY_URL_{site_upper}", "").strip()
    if site_url:
        try:
            cfg = parse_proxy_url(site_url)
            logger.info(
                "Site-specific proxy for %s loaded from PROXY_URL_%s: %s",
                site_name, site_upper, cfg.server,
            )
            return cfg
        except ValueError as exc:
            logger.error("Invalid PROXY_URL_%s: %s", site_upper, exc)
    # Fall back to default PROXY_URL.
    return load_proxy_from_env()


# ──────────────────────────────────────────────────────────────────────
# User-Agent pool -- kept up-to-date with current stable Chrome releases.
# Rotated per browser context (or per request for HTTP fetches).
# ──────────────────────────────────────────────────────────────────────

UA_POOL: list[str] = [
    # Chrome 136 -- Windows 10
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    # Chrome 136 -- Windows 11
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.93 Safari/537.36",
    # Chrome 136 -- macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    # Chrome 135 -- Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    # Chrome 135 -- macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    # Chrome 134 -- Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    # Chrome 134 -- macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    # Edge 136 -- Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    # Chrome 136 -- Linux
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    # Chrome 133 -- Windows (older but still seen in the wild)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
]


def random_ua() -> str:
    """Pick a random User-Agent from the pool."""
    return random.choice(UA_POOL)


# ──────────────────────────────────────────────────────────────────────
# Chromium launch arguments
# ──────────────────────────────────────────────────────────────────────

# Full set for the scraping fetcher (optimised for low-memory VPS, 2 GB RAM).
BROWSER_LAUNCH_ARGS: list[str] = [
    # Core stability / containerisation
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",

    # Window / display
    "--window-size=1920,1080",
    "--start-maximized",

    # GPU / rendering (headless servers)
    "--disable-gpu",
    "--disable-software-rasterizer",

    # Anti-detection: prevent automation flags from leaking
    "--disable-blink-features=AutomationControlled",

    # Disable images for speed (reviews are text-only)
    "--blink-settings=imagesEnabled=false",

    # Memory / process limits
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-translate",
    "--metrics-recording-only",
    "--no-first-run",
    "--renderer-process-limit=2",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-ipc-flooding-protection",

    # Disable features that leak "headless" signals
    "--disable-features=site-per-process",
    "--disable-hang-monitor",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",

    # Networking
    "--disable-client-side-phishing-detection",
    "--disable-component-update",

    # Media (not needed for review scraping)
    "--autoplay-policy=user-gesture-required",
    "--disable-domain-reliability",
]

# Lighter set for cookie-refresh (only needs to load a homepage).
COOKIE_REFRESH_LAUNCH_ARGS: list[str] = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",
    "--window-size=1920,1080",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--blink-settings=imagesEnabled=false",
    "--disable-blink-features=AutomationControlled",
    "--disable-extensions",
    "--disable-background-networking",
    "--no-first-run",
]


# ──────────────────────────────────────────────────────────────────────
# Browser context options
# ──────────────────────────────────────────────────────────────────────

def build_context_options(
    user_agent: str | None = None,
    proxy: Optional[ProxyConfig] = None,
) -> dict[str, Any]:
    """Return kwargs for ``browser.new_context()``.

    Configures viewport, locale, timezone, colour scheme, permissions,
    and extra HTTP headers to appear as a real desktop browser.

    If *proxy* is provided, adds the ``proxy`` key so the context routes
    all traffic through the proxy (including authentication).
    """
    ua = user_agent or random_ua()
    opts: dict[str, Any] = {
        "user_agent": ua,
        "viewport": {"width": 1920, "height": 1080},
        "screen": {"width": 1920, "height": 1080},
        "locale": "en-US",
        "timezone_id": "Asia/Kolkata",
        "color_scheme": "light",
        "device_scale_factor": 1,
        "has_touch": False,
        "is_mobile": False,
        "java_script_enabled": True,
        "permissions": [],
        "extra_http_headers": {
            "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
            "Sec-Ch-Ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        },
    }
    if proxy is not None:
        opts["proxy"] = proxy.playwright_dict
    return opts


# ──────────────────────────────────────────────────────────────────────
# Stealth init scripts
#
# These are injected *before* any page loads via context.add_init_script()
# to mask Playwright/Chromium automation fingerprints.
# ──────────────────────────────────────────────────────────────────────

STEALTH_SCRIPTS: list[str] = [
    # 1. Hide navigator.webdriver
    """
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
    });
    """,

    # 2. Override navigator.plugins to look like a real Chrome browser
    """
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const plugins = [
                {name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format'},
                {name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: ''},
                {name: 'Native Client', filename: 'internal-nacl-plugin', description: ''},
            ];
            plugins.length = 3;
            return plugins;
        },
    });
    """,

    # 3. Override navigator.languages
    """
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'hi'],
    });
    """,

    # 4. Fix navigator.permissions to avoid "notification denied" fingerprint
    """
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({state: Notification.permission})
            : originalQuery(parameters);
    """,

    # 5. Mock navigator.connection (Chrome Network Information API)
    """
    if (!navigator.connection) {
        Object.defineProperty(navigator, 'connection', {
            get: () => ({
                effectiveType: '4g',
                rtt: 50,
                downlink: 10,
                saveData: false,
            }),
        });
    }
    """,

    # 6. Conceal the chrome.runtime used by headless detection scripts
    """
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {
        connect: () => {},
        sendMessage: () => {},
        onMessage: {addListener: () => {}, removeListener: () => {}},
    };
    """,

    # 7. Spoof WebGL vendor/renderer to match real GPU (Intel HD on Windows)
    """
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Google Inc. (Intel)';
        if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return getParameter.call(this, parameter);
    };
    const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Google Inc. (Intel)';
        if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return getParameter2.call(this, parameter);
    };
    """,

    # 8. Disable the "navigator.platform" inconsistency check
    """
    Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
    });
    """,

    # 9. Fix hardware concurrency (real browsers usually report 4-16)
    """
    Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
    });
    """,

    # 10. Fix deviceMemory
    """
    Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
    });
    """,

    # 11. Prevent empty iframe contentWindow fingerprint
    """
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
        return originalAttachShadow.call(this, {...init, mode: 'open'});
    };
    """,
]

# Combine all scripts into one big init script for a single injection call.
COMBINED_STEALTH_SCRIPT: str = "\n".join(
    f"// stealth script {i + 1}\n(function() {{{script}}})();"
    for i, script in enumerate(STEALTH_SCRIPTS)
)


# ──────────────────────────────────────────────────────────────────────
# Resource blocking rules (route interception)
#
# Blocking images, fonts, media, and tracking scripts dramatically
# reduces bandwidth and load time for review-only scraping.
# ──────────────────────────────────────────────────────────────────────

# Resource types to abort outright.
BLOCKED_RESOURCE_TYPES: frozenset[str] = frozenset({
    "image",
    "media",
    "font",
})

# URL patterns that are tracking/analytics -- abort regardless of type.
BLOCKED_URL_PATTERNS: tuple[str, ...] = (
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.net",
    "facebook.com/tr",
    "doubleclick.net",
    "googlesyndication.com",
    "adservice.google.com",
    "analytics.",
    "hotjar.com",
    "clarity.ms",
    "sentry.io",
    "newrelic.com",
    "nr-data.net",
    "branch.io",
    "moengage.com",
    "clevertap.com",
    "webengage.com",
    "adobe-analytics",
    "omtrdc.net",
    "demdex.net",
)


def should_block_route(url: str, resource_type: str) -> bool:
    """Return True if this request should be aborted for performance."""
    if resource_type in BLOCKED_RESOURCE_TYPES:
        return True
    url_lower = url.lower()
    for pattern in BLOCKED_URL_PATTERNS:
        if pattern in url_lower:
            return True
    return False


# ──────────────────────────────────────────────────────────────────────
# Review content selectors (shared wait-for targets)
# ──────────────────────────────────────────────────────────────────────

REVIEW_WAIT_SELECTOR: str = (
    # Amazon
    'div[data-hook="review"], div[id^="customer_review-"], '
    ".a-pagination, #cm-cr-dp-review-list, "
    # Flipkart (React Native Web -- 2025+ inline-style layout)
    # Old obfuscated class names (kept for backward compatibility):
    "div.col._2wzgFH, div._27M-vq, div.EKFha-, div.cPHDOP, "
    "div.RcXBOT, "
    # New layout uses generic css-* classes; detect by "Verified Purchase"
    # text or the review-card inline style (padding-left+top+bottom: 16px):
    'div[style*="padding-left: 16px"][style*="padding-top: 16px"][style*="padding-bottom: 16px"], '
    # Myntra
    'div[class*="userReview"], div[class*="reviewCard"], '
    'div[class*="detailed-reviews"], div[class*="index-overallRating"], '
    # Ajio (BazaarVoice widgets)
    'div[class*="bv-content-item"], div[data-bv-show="reviews"], '
    # Nykaa
    'div[class*="review-card"], div[class*="reviewCard"], '
    # Generic
    'div[class*="review-container"], [data-testid*="review"]'
)
