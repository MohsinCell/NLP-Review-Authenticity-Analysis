from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from review_scraper.core.playwright_config import (
    COMBINED_STEALTH_SCRIPT,
    COOKIE_REFRESH_LAUNCH_ARGS,
    ProxyConfig,
    build_context_options,
    load_proxy_from_env,
    random_ua,
    should_block_route,
)
from review_scraper.utils.cookies import (
    Cookie,
    find_cookie_file,
    load_netscape_cookies,
)
from review_scraper.web.email_notifier import notify_cookie_expiry

logger = logging.getLogger("review_scraper.cookie_manager")

SUPPORTED_SITES: dict[str, dict[str, str]] = {
    "amazon_in": {
        "name": "Amazon India",
        "domain": "amazon.in",
        "login_url": "https://www.amazon.in/ap/signin",
        "home_url": "https://www.amazon.in",
        "cookie_base": "amazon",
    },
    "amazon_com": {
        "name": "Amazon US",
        "domain": "amazon.com",
        "login_url": "https://www.amazon.com/ap/signin",
        "home_url": "https://www.amazon.com",
        "cookie_base": "amazon",
    },
    "flipkart": {
        "name": "Flipkart",
        "domain": "flipkart.com",
        "login_url": "https://www.flipkart.com/account/login",
        "home_url": "https://www.flipkart.com",
        "cookie_base": "flipkart",
    },
    "myntra": {
        "name": "Myntra",
        "domain": "myntra.com",
        "login_url": "https://www.myntra.com/login",
        "home_url": "https://www.myntra.com",
        "cookie_base": "myntra",
    },
    "ajio": {
        "name": "Ajio",
        "domain": "ajio.com",
        "login_url": "https://www.ajio.com/login",
        "home_url": "https://www.ajio.com",
        "cookie_base": "ajio",
    },
    "nykaa": {
        "name": "Nykaa",
        "domain": "nykaa.com",
        "login_url": "https://www.nykaa.com/login",
        "home_url": "https://www.nykaa.com",
        "cookie_base": "nykaa",
    },
}


@dataclass
class SiteState:
    status: str = "unknown"
    cookie_count: int = 0
    last_refreshed: Optional[str] = None
    last_checked: Optional[str] = None
    message: str = ""
    driver: Any = field(default=None, repr=False)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)


_state: dict[str, SiteState] = {key: SiteState() for key in SUPPORTED_SITES}
_cookies_dir: Optional[Path] = None


def init(cookies_dir: Path) -> None:
    global _cookies_dir
    _cookies_dir = cookies_dir
    cookies_dir.mkdir(parents=True, exist_ok=True)
    _refresh_all_status()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cookie_file_path(site_key: str) -> Path:
    assert _cookies_dir is not None
    base = SUPPORTED_SITES[site_key]["cookie_base"]
    return _cookies_dir / f"{base}-cookies.txt"


def _refresh_site_status(site_key: str) -> None:
    st = _state[site_key]
    if st.status == "login_active":
        return

    prev_status = st.status
    path = _cookie_file_path(site_key)
    if not path.is_file():
        st.status = "missing"
        st.cookie_count = 0
        st.message = "No cookie file found"
        st.last_checked = _now_iso()
        return

    try:
        all_cookies = _load_all_cookies(path)
        valid = [c for c in all_cookies if not c.is_expired()]
        st.cookie_count = len(valid)

        if len(valid) == 0:
            st.status = "expired"
            st.message = f"All {len(all_cookies)} cookies expired"
        elif len(valid) < len(all_cookies):
            st.status = "valid"
            st.message = f"{len(valid)} valid, {len(all_cookies) - len(valid)} expired"
        else:
            st.status = "valid"
            st.message = f"{len(valid)} cookies loaded"

        st.last_checked = _now_iso()
    except Exception as exc:
        st.status = "expired"
        st.cookie_count = 0
        st.message = f"Error reading cookies: {exc}"
        st.last_checked = _now_iso()

    # Send email alert when cookies transition to expired
    if st.status == "expired" and prev_status != "expired":
        site = SUPPORTED_SITES[site_key]
        try:
            notify_cookie_expiry(site_key, site["name"], site["domain"], st.message)
        except Exception as exc:
            logger.error("Failed to send cookie expiry notification for %s: %s", site_key, exc)


def _load_all_cookies(path: Path) -> list[Cookie]:
    cookies: list[Cookie] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 7:
                continue
            try:
                cookies.append(Cookie(
                    domain=parts[0],
                    include_subdomains=parts[1].upper() == "TRUE",
                    path=parts[2],
                    secure=parts[3].upper() == "TRUE",
                    expiry=int(parts[4]),
                    name=parts[5],
                    value=parts[6],
                ))
            except (ValueError, IndexError):
                continue
    return cookies


def _refresh_all_status() -> None:
    for key in SUPPORTED_SITES:
        _refresh_site_status(key)


def get_all_status() -> list[dict]:
    _refresh_all_status()
    result = []
    for key, site in SUPPORTED_SITES.items():
        st = _state[key]
        result.append({
            "site_key": key,
            "site_name": site["name"],
            "domain": site["domain"],
            "status": st.status,
            "cookie_count": st.cookie_count,
            "last_refreshed": st.last_refreshed,
            "last_checked": st.last_checked,
            "message": st.message,
        })
    return result


def get_site_status(site_key: str) -> dict:
    if site_key not in SUPPORTED_SITES:
        raise ValueError(f"Unknown site: {site_key}")
    _refresh_site_status(site_key)
    site = SUPPORTED_SITES[site_key]
    st = _state[site_key]
    return {
        "site_key": site_key,
        "site_name": site["name"],
        "domain": site["domain"],
        "status": st.status,
        "cookie_count": st.cookie_count,
        "last_refreshed": st.last_refreshed,
        "last_checked": st.last_checked,
        "message": st.message,
    }


def import_cookies(site_key: str, cookie_text: str) -> dict:
    if site_key not in SUPPORTED_SITES:
        raise ValueError(f"Unknown site: {site_key}")

    cookie_text = cookie_text.strip()
    if not cookie_text:
        raise ValueError("Cookie text is empty")

    st = _state[site_key]
    path = _cookie_file_path(site_key)

    import json
    try:
        json_cookies = json.loads(cookie_text)
        if isinstance(json_cookies, list) and len(json_cookies) > 0:
            _save_cookies_as_netscape(json_cookies, site_key)
            with st.lock:
                st.last_refreshed = _now_iso()
            logger.info("Imported %d cookies (JSON) for %s", len(json_cookies), site_key)
            _refresh_site_status(site_key)
            return get_site_status(site_key)
    except (json.JSONDecodeError, TypeError):
        pass

    lines = []
    cookie_count = 0
    for line in cookie_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            lines.append(stripped)
            continue
        parts = stripped.split("\t")
        if len(parts) >= 7:
            lines.append(stripped)
            cookie_count += 1

    if cookie_count == 0:
        raise ValueError(
            "No valid cookies found. Paste cookies in Netscape (tab-separated) "
            "or JSON format (from a browser extension like EditThisCookie)."
        )

    header = ["# Netscape HTTP Cookie File", "# Imported via ReviewIQ Admin", ""]
    path.write_text("\n".join(header + lines) + "\n", encoding="utf-8")
    logger.info("Imported %d cookies (Netscape) for %s", cookie_count, site_key)

    with st.lock:
        st.last_refreshed = _now_iso()

    _refresh_site_status(site_key)
    return get_site_status(site_key)


def refresh_site(site_key: str) -> dict:
    if site_key not in SUPPORTED_SITES:
        raise ValueError(f"Unknown site: {site_key}")

    st = _state[site_key]
    path = _cookie_file_path(site_key)

    if not path.is_file():
        st.status = "missing"
        st.message = "No cookies to refresh. Import cookies first"
        return get_site_status(site_key)

    with st.lock:
        prev_status = st.status
        st.status = "refreshing"
        st.message = "Refreshing cookies..."

    site = SUPPORTED_SITES[site_key]
    runtime = None
    try:
        proxy = load_proxy_from_env()
        runtime = _create_headless_browser(proxy=proxy)
        context = runtime["context"]
        page = runtime["page"]

        all_cookies = _load_all_cookies(path)
        browser_cookies = [
            {
                "name": c.name,
                "value": c.value,
                "domain": c.domain,
                "path": c.path,
                "secure": c.secure,
                **({"expires": c.expiry} if c.expiry > 0 else {}),
            }
            for c in all_cookies
            if c.matches_domain(site["domain"])
        ]

        page.goto(site["home_url"], wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)

        if browser_cookies:
            context.add_cookies(browser_cookies)

        page.goto(site["home_url"], wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        current_url = page.url or ""
        if _looks_like_login_page(current_url, site_key):
            with st.lock:
                was_expired = st.status == "expired"
                st.status = "expired"
                st.message = "Cookies expired. Re-import required"
                st.last_checked = _now_iso()
            if not was_expired:
                try:
                    notify_cookie_expiry(site_key, site["name"], site["domain"], st.message)
                except Exception as exc:
                    logger.error("Failed to send cookie expiry notification: %s", exc)
            return get_site_status(site_key)

        refreshed_cookies = context.cookies()
        if refreshed_cookies:
            _save_cookies_as_netscape(refreshed_cookies, site_key)
            with st.lock:
                st.last_refreshed = _now_iso()
            logger.info("Refreshed %d cookies for %s", len(refreshed_cookies), site_key)

    except Exception as exc:
        logger.error("Cookie refresh failed for %s: %s", site_key, exc)
        with st.lock:
            st.status = prev_status
            st.message = f"Refresh failed: {exc}"
    finally:
        _close_headless_browser(runtime)

    _refresh_site_status(site_key)
    return get_site_status(site_key)


def refresh_all() -> list[dict]:
    results = []
    for key in SUPPORTED_SITES:
        path = _cookie_file_path(key)
        if path.is_file():
            results.append(refresh_site(key))
        else:
            results.append(get_site_status(key))
    return results


class CookieRefreshScheduler:
    def __init__(self) -> None:
        self._enabled = True
        self._interval = 1800  # 30 minutes
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._last_run: Optional[str] = None
        self._next_run: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return self._enabled

    def get_state(self) -> dict:
        with self._lock:
            return {
                "enabled": self._enabled,
                "interval_seconds": self._interval,
                "last_run": self._last_run,
                "next_run": self._next_run,
                "running": self._thread is not None and self._thread.is_alive(),
            }

    def configure(self, enabled: bool, interval_seconds: Optional[int] = None) -> dict:
        with self._lock:
            if interval_seconds is not None and interval_seconds >= 1800:
                self._interval = interval_seconds

            if enabled and not self._enabled:
                self._start()
            elif not enabled and self._enabled:
                self._stop()

            self._enabled = enabled
        return self.get_state()

    def _start(self) -> None:
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        logger.info("Cookie auto-refresh scheduler started (interval=%ds)", self._interval)

    def _stop(self) -> None:
        self._stop_event.set()
        self._thread = None
        self._next_run = None
        logger.info("Cookie auto-refresh scheduler stopped")

    def _loop(self) -> None:
        try:
            logger.info("Auto-refresh: initial refresh on scheduler start...")
            refresh_all()
            self._last_run = _now_iso()
            logger.info("Auto-refresh: initial refresh completed")
        except Exception as exc:
            logger.error("Auto-refresh initial run error: %s", exc)

        while not self._stop_event.is_set():
            wait_seconds = self._compute_next_wait()

            next_ts = time.time() + wait_seconds
            self._next_run = datetime.fromtimestamp(next_ts, tz=timezone.utc).isoformat()

            if self._stop_event.wait(timeout=wait_seconds):
                break

            try:
                logger.info("Auto-refresh: refreshing all cookies...")
                refresh_all()
                self._last_run = _now_iso()
                logger.info("Auto-refresh completed")
            except Exception as exc:
                logger.error("Auto-refresh error: %s", exc)

    _SESSION_COOKIE_NAMES = {
        "session-id", "ubid-acbin", "ubid-main", "at-main", "at-acbin",
        "sess-at-main", "sess-at-acbin", "x-main", "x-acbin",
        "t", "sid", "at",
        "at", "myntra.sid",
        "ajiob2csession",
    }

    def _compute_next_wait(self) -> float:
        if _cookies_dir is None:
            return self._interval

        buffer_seconds = 1800
        now = int(time.time())
        earliest_expiry = None

        for site_key in SUPPORTED_SITES:
            path = _cookie_file_path(site_key)
            if not path.is_file():
                continue
            try:
                cookies = _load_all_cookies(path)
                for c in cookies:
                    if c.expiry > 0 and c.expiry > now and c.name.lower() in self._SESSION_COOKIE_NAMES:
                        if earliest_expiry is None or c.expiry < earliest_expiry:
                            earliest_expiry = c.expiry
            except Exception:
                continue

        if earliest_expiry is not None:
            time_until_expiry = earliest_expiry - now
            if time_until_expiry < self._interval + buffer_seconds:
                proactive_wait = max(60, time_until_expiry - buffer_seconds)
                if proactive_wait < self._interval:
                    logger.info(
                        "Cookies expire in %ds, scheduling proactive refresh in %ds",
                        time_until_expiry, proactive_wait,
                    )
                    return proactive_wait

        return self._interval


_scheduler = CookieRefreshScheduler()
_scheduler._start()  # Auto-start with 30-min refresh


def get_scheduler_state() -> dict:
    return _scheduler.get_state()


def configure_scheduler(enabled: bool, interval_seconds: Optional[int] = None) -> dict:
    return _scheduler.configure(enabled, interval_seconds)


def _create_headless_browser(proxy: ProxyConfig | None = None) -> dict:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        raise RuntimeError(
            "Playwright is required for cookie refresh. Install playwright and run `playwright install chromium`."
        ) from exc

    ua = random_ua()
    playwright = sync_playwright().start()
    launch_args = list(COOKIE_REFRESH_LAUNCH_ARGS)
    if proxy:
        launch_args.append("--ignore-certificate-errors")
    browser = playwright.chromium.launch(headless=True, args=launch_args)

    context_opts = build_context_options(ua, proxy=proxy)
    context = browser.new_context(**context_opts)

    # Inject all stealth scripts (same as scraper fetcher).
    context.add_init_script(COMBINED_STEALTH_SCRIPT)

    # Block tracking/analytics to speed up cookie refresh.
    context.route("**/*", lambda route: (
        route.abort() if should_block_route(route.request.url, route.request.resource_type)
        else route.continue_()
    ))

    page = context.new_page()
    page.set_default_timeout(30000)
    return {
        "playwright": playwright,
        "browser": browser,
        "context": context,
        "page": page,
    }


def _close_headless_browser(runtime: Optional[dict]) -> None:
    if not runtime:
        return
    context = runtime.get("context")
    browser = runtime.get("browser")
    playwright = runtime.get("playwright")
    if context is not None:
        try:
            context.close()
        except Exception:
            pass
    if browser is not None:
        try:
            browser.close()
        except Exception:
            pass
    if playwright is not None:
        try:
            playwright.stop()
        except Exception:
            pass


def _save_cookies_as_netscape(browser_cookies: list[dict], site_key: str) -> Path:
    path = _cookie_file_path(site_key)

    lines = ["# Netscape HTTP Cookie File", "# Generated by ReviewIQ Cookie Manager", ""]
    for c in browser_cookies:
        domain = c.get("domain", "")
        include_sub = "TRUE" if domain.startswith(".") else "FALSE"
        cookie_path = c.get("path", "/")
        secure = "TRUE" if c.get("secure", False) else "FALSE"
        expiry = str(int(c.get("expiry", c.get("expirationDate", 0))))
        name = c.get("name", "")
        value = c.get("value", "")
        lines.append(f"{domain}\t{include_sub}\t{cookie_path}\t{secure}\t{expiry}\t{name}\t{value}")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    logger.info("Saved %d cookies to %s", len(browser_cookies), path)
    return path


def _looks_like_login_page(url: str, site_key: str) -> bool:
    lower = url.lower()
    patterns = [
        "/ap/signin",
        "/accounts/login",
        "/login?",
        "/login/phone",
        "/account/login",
    ]
    return any(p in lower for p in patterns)


def _has_session_cookies(browser_cookies: list[dict], site_key: str) -> bool:
    cookie_names = {c.get("name", "").lower() for c in browser_cookies}

    site = SUPPORTED_SITES[site_key]
    domain = site["domain"]

    if "amazon" in domain:
        return bool(cookie_names & {"session-id", "ubid-acbin", "ubid-main", "at-main", "at-acbin"})
    elif "flipkart" in domain:
        return bool(cookie_names & {"t", "sid", "s", "at"})
    elif "myntra" in domain:
        return bool(cookie_names & {"at", "mynt-ulc", "myntra.sid"})
    elif "ajio" in domain:
        return bool(cookie_names & {"ajiob2csession", "uid"})
    elif "nykaa" in domain:
        return bool(cookie_names & {"nykaa_session", "at", "ut"})

    return len(browser_cookies) >= 3
