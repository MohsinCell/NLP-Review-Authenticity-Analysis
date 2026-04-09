from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx


logger = logging.getLogger("review_scraper.robots")


@dataclass
class RobotsChecker:
    """Fetches and evaluates robots.txt for a target URL."""

    timeout_s: float = 10.0
    proxy_url: Optional[str] = None
    _cache: Dict[str, RobotFileParser] = field(default_factory=dict)

    def is_allowed(self, url: str, *, user_agent: str) -> bool:
        """Return True if robots.txt allows fetching the URL for the given UA."""

        robots_url = self._robots_url(url)
        rp = self._cache.get(robots_url)
        if rp is None:
            rp = self._fetch_and_parse(robots_url, user_agent=user_agent)
            self._cache[robots_url] = rp
        return rp.can_fetch(user_agent, url)

    def get_crawl_delay(self, url: str, *, user_agent: str) -> Optional[float]:
        """Return crawl-delay in seconds, if specified by robots.txt."""

        robots_url = self._robots_url(url)
        rp = self._cache.get(robots_url)
        if rp is None:
            rp = self._fetch_and_parse(robots_url, user_agent=user_agent)
            self._cache[robots_url] = rp

        delay = rp.crawl_delay(user_agent)
        if delay is None:
            return None
        try:
            delay_f = float(delay)
        except (TypeError, ValueError):
            return None
        return delay_f if delay_f >= 0 else None

    @staticmethod
    def _robots_url(url: str) -> str:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}/robots.txt"

    def _fetch_and_parse(self, robots_url: str, *, user_agent: str) -> RobotFileParser:
        rp = RobotFileParser()
        rp.set_url(robots_url)

        headers = {"User-Agent": user_agent, "Accept": "text/plain,*/*"}
        try:
            with httpx.Client(
                headers=headers,
                timeout=httpx.Timeout(self.timeout_s),
                follow_redirects=True,
                proxy=self.proxy_url,
                verify=not bool(self.proxy_url),
            ) as c:
                resp = c.get(robots_url)
        except httpx.RequestError as exc:
            # Conservative default: if we cannot retrieve robots.txt, do not scrape.
            logger.warning("robots.txt fetch failed (%s): %s", robots_url, exc)
            rp.parse(["User-agent: *", "Disallow: /"])
            return rp

        if 400 <= resp.status_code < 500:
            # Per RFC 9309, 4xx on robots.txt means no restrictions.
            logger.warning("robots.txt returned HTTP %s: %s", resp.status_code, robots_url)
            rp.parse([])
            return rp

        if resp.status_code != 200:
            # 5xx or other server errors -- conservative: disallow.
            logger.warning("robots.txt returned HTTP %s: %s", resp.status_code, robots_url)
            rp.parse(["User-agent: *", "Disallow: /"])
            return rp

        lines = resp.text.splitlines()
        rp.parse(lines)
        return rp
