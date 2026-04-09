from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger("review_scraper.cookies")


@dataclass
class Cookie:
    """A single parsed cookie from a Netscape cookie file."""

    domain: str
    include_subdomains: bool
    path: str
    secure: bool
    expiry: int
    name: str
    value: str

    def is_expired(self) -> bool:
        return self.expiry > 0 and self.expiry < int(time.time())

    def matches_domain(self, hostname: str) -> bool:
        hostname = hostname.lower()
        domain = self.domain.lower().lstrip(".")
        return hostname == domain or hostname.endswith("." + domain)


def load_netscape_cookies(path: Path) -> list[Cookie]:
    """Parse a Netscape HTTP Cookie File into a list of Cookie objects."""

    cookies: list[Cookie] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 7:
                logger.debug("Skipping malformed cookie line: %s", line[:80])
                continue
            try:
                cookies.append(
                    Cookie(
                        domain=parts[0],
                        include_subdomains=parts[1].upper() == "TRUE",
                        path=parts[2],
                        secure=parts[3].upper() == "TRUE",
                        expiry=int(parts[4]),
                        name=parts[5],
                        value=parts[6],
                    )
                )
            except (ValueError, IndexError):
                logger.debug("Skipping unparseable cookie line: %s", line[:80])
                continue

    valid = [c for c in cookies if not c.is_expired()]
    expired = len(cookies) - len(valid)
    if expired:
        logger.info("Skipped %d expired cookies out of %d total", expired, len(cookies))
    logger.info("Loaded %d valid cookies from %s", len(valid), path)
    return valid


def cookies_for_url(cookies: list[Cookie], url: str) -> dict[str, str]:
    """Return ``{name: value}`` for cookies matching the URL's domain."""

    hostname = urlparse(url).netloc.lower()
    result: dict[str, str] = {}
    for c in cookies:
        if c.matches_domain(hostname):
            result[c.name] = c.value
    return result


def cookies_for_playwright(cookies: list[Cookie], url: str) -> list[dict]:
    """Return cookies in Playwright ``context.add_cookies()`` format."""

    hostname = urlparse(url).netloc.lower()
    result: list[dict] = []
    for c in cookies:
        if c.matches_domain(hostname):
            entry: dict = {
                "name": c.name,
                "value": c.value,
                "domain": c.domain,
                "path": c.path,
                "secure": c.secure,
            }
            if c.expiry > 0:
                entry["expires"] = c.expiry
            result.append(entry)
    return result


def cookies_for_selenium(cookies: list[Cookie], url: str) -> list[dict]:
    """Backward-compatible alias; Selenium is no longer used by default."""

    return cookies_for_playwright(cookies, url)


def find_cookie_file(cookies_dir: Path, url: str) -> Optional[Path]:
    """Auto-detect a cookie file for the given URL from a cookies directory.

    Looks for files named ``<site>-cookies.txt``, ``<site>_cookies.txt``,
    or ``<site>.txt`` where ``<site>`` is derived from the URL hostname
    (e.g. "amazon" from "www.amazon.in").
    """

    if not cookies_dir.is_dir():
        return None

    hostname = urlparse(url).netloc.lower().replace("www.", "")
    # "amazon.in" -> "amazon", "flipkart.com" -> "flipkart"
    site_name = hostname.split(".")[0] if hostname else ""
    if not site_name:
        return None

    candidates = [
        f"{site_name}-cookies.txt",
        f"{site_name}_cookies.txt",
        f"{site_name}.txt",
    ]
    for name in candidates:
        path = cookies_dir / name
        if path.is_file():
            logger.info("Auto-detected cookie file: %s", path)
            return path

    return None
