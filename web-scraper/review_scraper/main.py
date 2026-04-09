from __future__ import annotations

import argparse
import csv
import itertools
from pathlib import Path
from typing import List, Optional, Tuple

from review_scraper.core.fetcher import (
    FetchConfig,
    Fetcher,
)
from review_scraper.core.parser_base import BaseParser
from review_scraper.core.playwright_config import (
    load_proxy_from_env,
    parse_proxy_url,
    random_ua,
)
from review_scraper.sites import get_parser_for_url
from review_scraper.utils.cookies import (
    cookies_for_playwright,
    cookies_for_url,
    find_cookie_file,
    load_netscape_cookies,
)
from review_scraper.utils.logger import setup_logging
from review_scraper.utils.robots_checker import RobotsChecker


DEFAULT_USER_AGENT = random_ua()

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_COOKIES_DIR = _PROJECT_ROOT / "cookies"


def _write_csv(out_path: Path, rows: List[Tuple[str, float, str]]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["review_text", "rating", "date"])
        for text, rating, date in rows:
            if abs(rating - round(rating)) < 1e-9:
                rating_out = str(int(round(rating)))
            else:
                rating_out = str(rating)
            w.writerow([text, rating_out, date])


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(
            "Research/demo review scraper that extracts only review text + rating "
            "from publicly accessible pages, respecting robots.txt and stopping when blocked."
        )
    )
    p.add_argument("url", help="Product review page URL (publicly accessible)")
    p.add_argument("--out", default="reviews.csv", help="CSV output path")
    p.add_argument(
        "--cookies",
        default=None,
        help=(
            "Path to a Netscape-format cookie file. "
            "If omitted, auto-detects from cookies/ directory."
        ),
    )
    p.add_argument(
        "--user-agent",
        default=DEFAULT_USER_AGENT,
        help="User-Agent header to use (should be a real browser UA)",
    )
    p.add_argument("--min-delay", type=float, default=2.0, help="Minimum delay seconds between requests (default: 2)")
    p.add_argument("--max-delay", type=float, default=4.0, help="Maximum delay seconds between requests (default: 4)")
    p.add_argument("--timeout", type=float, default=20.0, help="Request timeout seconds")
    p.add_argument("--retries", type=int, default=2, help="Retry count on network/5xx errors")
    p.add_argument(
        "--render-js",
        action="store_true",
        help="Force Playwright rendering (use only if the page is JS-rendered)",
    )
    p.add_argument(
        "--proxy",
        default=None,
        help=(
            "Proxy URL (e.g. http://user:pass@host:port). "
            "If omitted, reads from PROXY_URL env var."
        ),
    )
    p.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Maximum review pages to scrape (0 = all pages until exhausted)",
    )
    p.add_argument(
        "--log-level",
        default="INFO",
        help="Logging level (DEBUG, INFO, WARNING, ERROR)",
    )
    return p


def _load_cookies(args, url: str, log):
    cookie_path: Optional[Path] = None

    if args.cookies:
        cookie_path = Path(args.cookies)
        if not cookie_path.is_file():
            log.warning("Cookie file not found: %s", cookie_path)
            return {}, []
    else:
        cookie_path = find_cookie_file(_COOKIES_DIR, url)

    if cookie_path is None:
        log.debug("No cookie file found for %s", url)
        return {}, []

    log.info("Using cookie file: %s", cookie_path)
    all_cookies = load_netscape_cookies(cookie_path)
    http_cookies = cookies_for_url(all_cookies, url)
    browser_cookies = cookies_for_playwright(all_cookies, url)
    log.info("%d cookies matched for domain", len(http_cookies))
    return http_cookies, browser_cookies


def main(argv: Optional[List[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    log = setup_logging(level=args.log_level)

    parser = get_parser_for_url(args.url)
    if parser is None:
        log.error("No parser available for URL host: %s", args.url)
        return 2

    # Resolve proxy: CLI arg > env var > None.
    proxy_config = None
    if args.proxy:
        proxy_config = parse_proxy_url(args.proxy)
        log.info("Using proxy from --proxy flag: %s", proxy_config.server)
    else:
        proxy_config = load_proxy_from_env()
        if proxy_config:
            log.info("Using proxy from PROXY_URL env: %s", proxy_config.server)

    # Skip proxy for sites where it causes issues.
    # - Flipkart: React hydration breaks under Web Unlocker MITM.
    # - Amazon: Web Unlocker returns 502 for amazon.in.
    _PROXY_SKIP_SITES: frozenset[str] = frozenset({"flipkart", "amazon"})
    if proxy_config and parser.name in _PROXY_SKIP_SITES:
        log.info("Skipping proxy for %s (stealth-only mode)", parser.name)
        proxy_config = None

    robots = RobotsChecker(
        proxy_url=proxy_config.httpx_url if proxy_config else None,
    )

    cfg = FetchConfig(
        min_delay_s=float(args.min_delay),
        max_delay_s=float(args.max_delay),
        timeout_s=float(args.timeout),
        max_retries=int(args.retries),
    )

    url_batches = parser.get_review_url_batches(args.url)
    log.info("URL batches: %d (%s)", len(url_batches), url_batches[0])

    http_cookies, browser_cookies = _load_cookies(args, url_batches[0], log)

    max_pages = int(args.max_pages)

    try:
        all_reviews: list = []
        seen_ids: set = set()
        seen_text: set = set()

        with Fetcher(
            user_agent=str(args.user_agent),
            config=cfg,
            robots_checker=robots,
            cookies=http_cookies,
            browser_cookies=browser_cookies,
            proxy=proxy_config,
        ) as fetcher:
            use_js = bool(args.render_js or parser.requires_js)
            infinite_scroll = getattr(parser, "uses_infinite_scroll", False)
            global_page = 0
            first_batch_pages = 0
            hit_max = False
            batch_new_counts: dict[int, int] = {}
            star_batch_count = (len(url_batches) - 1) // 2 if len(url_batches) > 1 else 0

            for batch_idx, batch_url in enumerate(url_batches):
                if batch_idx >= 1 and first_batch_pages < 10:
                    log.info(
                        "First batch used %d pages (< 10) - "
                        "skipping remaining filter batches.",
                        first_batch_pages,
                    )
                    break
                if star_batch_count > 0 and batch_idx > star_batch_count:
                    recent_idx = batch_idx - star_batch_count
                    recent_new = batch_new_counts.get(recent_idx, 0)
                    if recent_new < 5:
                        log.info(
                            "Batch %d (recent) found only %d new - "
                            "skipping helpful batch %d.",
                            recent_idx + 1, recent_new, batch_idx + 1,
                        )
                        continue
                if batch_idx > 0:
                    log.info(
                        "Starting batch %d/%d: %s",
                        batch_idx + 1, len(url_batches), batch_url,
                    )

                current_url = batch_url
                next_click_selector: Optional[str] = None
                batch_pages = 0
                reviews_before_batch = len(all_reviews)
                consecutive_dupe_pages = 0

                try:
                    for page_in_batch in itertools.count(1):
                        global_page += 1
                        if max_pages > 0 and global_page > max_pages:
                            log.info("Reached max-pages limit (%d).", max_pages)
                            hit_max = True
                            break

                        if infinite_scroll:
                            if page_in_batch == 1:
                                log.info(
                                    "Fetching page with Playwright (infinite scroll): %s",
                                    current_url,
                                )
                                html = fetcher.fetch_html_rendered(current_url)
                            else:
                                log.info(
                                    "Scrolling for more reviews (scroll %d)...",
                                    page_in_batch - 1,
                                )
                                html = fetcher.scroll_for_infinite_content()
                        elif use_js:
                            if page_in_batch == 1:
                                log.info(
                                    "Fetching page %d with Playwright: %s",
                                    global_page, current_url,
                                )
                                html = fetcher.fetch_html_rendered(current_url)
                            else:
                                if next_click_selector:
                                    log.info(
                                        "Advancing to page %d via Playwright click (%s)",
                                        global_page, next_click_selector,
                                    )
                                    html = fetcher.click_and_get_rendered_html(
                                        next_click_selector,
                                        context_url=current_url,
                                    )
                                    current_url = (
                                        fetcher.rendered_current_url() or current_url
                                    )
                                else:
                                    log.info(
                                        "Fetching page %d with Playwright: %s",
                                        global_page, current_url,
                                    )
                                    html = fetcher.fetch_html_rendered(current_url)
                        else:
                            log.info(
                                "Fetching page %d via HTTP: %s",
                                global_page, current_url,
                            )
                            html = fetcher.fetch_html(current_url)

                        page_reviews = parser.parse(html, url=current_url)

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

                        log.info(
                            "Page %d: %d reviews (%d new, %d dupes)",
                            global_page, len(page_reviews),
                            len(new_reviews), len(page_reviews) - len(new_reviews),
                        )

                        if not page_reviews:
                            if global_page == 1:
                                log.warning(
                                    "No reviews extracted for %s "
                                    "(selectors may need updates)",
                                    parser.name,
                                )
                            else:
                                log.info(
                                    "Empty page %d (0 reviews) - "
                                    "end of this batch.",
                                    global_page,
                                )
                            break

                        if new_reviews:
                            consecutive_dupe_pages = 0
                        else:
                            consecutive_dupe_pages += 1
                            max_dupe = 5 if batch_idx >= 1 else 3
                            if consecutive_dupe_pages >= max_dupe:
                                log.info(
                                    "%d consecutive all-dupe pages - "
                                    "skipping rest of batch.",
                                    max_dupe,
                                )
                                break

                        all_reviews.extend(new_reviews)
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
                        if next_url is None or next_url == current_url:
                            log.info("No more pages in this batch.")
                            break
                        current_url = next_url
                        next_click_selector = None

                except Exception as exc:
                    log.warning(
                        "Batch %d stopped: %s (%d reviews so far)",
                        batch_idx + 1, exc, len(all_reviews),
                    )
                    hit_max = True

                batch_new_counts[batch_idx] = len(all_reviews) - reviews_before_batch
                if batch_idx == 0:
                    first_batch_pages = batch_pages
                if hit_max:
                    break

    except KeyboardInterrupt:
        log.warning("Interrupted by user")
    except Exception as exc:
        log.warning("Stopped early: %s", exc)

    rows = [(r.text, r.rating, r.date) for r in all_reviews]
    if rows:
        out_path = Path(args.out)
        _write_csv(out_path, rows)
        log.info("Wrote %d unique reviews to %s", len(rows), out_path)
        return 0
    else:
        log.error("No reviews collected")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
