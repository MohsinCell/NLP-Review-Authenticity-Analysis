from __future__ import annotations

import re
from typing import Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from review_scraper.core.parser_base import BaseParser, ProductMeta, Review


class AmazonParser(BaseParser):
    name = "amazon"
    requires_js = True
    domains = (
        "amazon.com",
        "amazon.in",
        "amazon.co.uk",
        "amazon.ca",
        "amazon.de",
        "amazon.fr",
        "amazon.it",
        "amazon.es",
        "amazon.com.au",
        "amazon.co.jp",
    )

    _ASIN_RE = re.compile(r"/(?:dp|gp/product|product-reviews)/([A-Z0-9]{10})")
    _STAR_FILTERS = ("five_star", "four_star", "three_star", "two_star", "one_star")
    _REVIEW_ID_RE = re.compile(r"R[A-Z0-9]{10,14}")

    # ------------------------------------------------------------------
    # Review ID extraction
    # ------------------------------------------------------------------

    @classmethod
    def _extract_review_id(cls, container) -> str:
        """Extract Amazon's unique review ID (e.g. 'R1ABC123DEF456') from a container.

        Amazon uses these as the container's ``id`` attribute, sometimes
        prefixed with ``customer_review-``.
        """
        raw_id = container.get("id", "")
        if raw_id:
            # Strip common prefixes like "customer_review-".
            raw_id = raw_id.replace("customer_review-", "")
            m = cls._REVIEW_ID_RE.search(raw_id)
            if m:
                return m.group(0)
        return ""

    # Date pattern: "on January 1, 2024" or "on 1 January 2024".
    _DATE_RE = re.compile(r"on\s+(.+)$", re.IGNORECASE)

    @classmethod
    def _extract_date(cls, container) -> str:
        """Extract the review date from a review container.

        Amazon puts the date in ``span[data-hook="review-date"]`` with text
        like "Reviewed in the United States on January 1, 2024".
        """
        el = container.select_one('span[data-hook="review-date"]')
        if not el:
            return ""
        raw = el.get_text(" ", strip=True)
        m = cls._DATE_RE.search(raw)
        if m:
            return m.group(1).strip()
        return raw

    # ------------------------------------------------------------------
    # Product metadata extraction
    # ------------------------------------------------------------------

    def parse_product_meta(self, html: str, *, url: str):
        """Extract product metadata from an Amazon product/review page."""
        from typing import Optional
        soup = self._soup(html)

        name = ""
        # Product title on detail pages.
        el = soup.select_one("#productTitle")
        if el:
            name = el.get_text(strip=True)
        if not name:
            # Review listing pages may have the product name in a link.
            el = soup.select_one('a[data-hook="product-link"]')
            if el:
                name = el.get_text(strip=True)

        brand = ""
        el = soup.select_one("#bylineInfo")
        if el:
            brand = el.get_text(strip=True)
            # Strip "Visit the X Store" / "Brand: X" prefixes.
            brand = re.sub(r"^(Visit the|Brand:\s*)", "", brand, flags=re.IGNORECASE).strip()
            brand = re.sub(r"\s*Store$", "", brand).strip()

        price = ""
        for sel in (
            "span.a-price .a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            'span[data-a-color="price"] .a-offscreen',
            ".a-price .a-offscreen",
        ):
            el = soup.select_one(sel)
            if el:
                price = el.get_text(strip=True)
                if price:
                    break

        image_url = ""
        el = soup.select_one("#landingImage, #imgBlkFront, #main-image")
        if el:
            # Prefer data-old-hires (high-res) over src (low-res placeholder).
            image_url = el.get("data-old-hires", "") or el.get("src", "")

        overall_rating: Optional[float] = None
        # Aggregate rating on product pages.
        el = soup.select_one('#acrPopover [class*="a-icon-alt"]')
        if el:
            overall_rating = self._parse_rating(el.get_text(strip=True))
        if overall_rating is None:
            # Review listing pages.
            el = soup.select_one('[data-hook="rating-out-of-text"]')
            if el:
                overall_rating = self._parse_rating(el.get_text(strip=True))

        if not name:
            return None

        return ProductMeta(
            name=name,
            brand=brand,
            price=price,
            image_url=image_url,
            overall_rating=overall_rating,
            platform="Amazon",
        )

    # ------------------------------------------------------------------
    # URL helpers
    # ------------------------------------------------------------------

    def _base_review_url(self, url: str) -> Optional[tuple[str, str, str]]:
        """Extract (scheme+netloc prefix, ASIN, base_url) or None."""
        match = self._ASIN_RE.search(url)
        if not match:
            return None
        asin = match.group(1)
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        return origin, asin, url

    def normalize_url(self, url: str) -> str:
        """Produce a clean reviews-listing base URL for any Amazon link."""
        match = self._ASIN_RE.search(url)
        if match:
            asin = match.group(1)
            parsed = urlparse(url)
            return (
                f"{parsed.scheme}://{parsed.netloc}"
                f"/product-reviews/{asin}/ref=cm_cr_arp_d_paging_btm_next_1"
                f"?ie=UTF8&reviewerType=all_reviews&pageNumber=1"
            )
        return url

    _TOTAL_RE = re.compile(r"([\d,]+)\s+(?:global\s+)?(?:ratings?|reviews?)", re.IGNORECASE)

    def parse_total_review_count(self, html: str) -> int:
        """Parse the total review/rating count from a review listing page.

        Returns 0 if the count cannot be determined.
        """
        soup = self._soup(html)
        # Try the filter-info element first.
        el = soup.select_one('[data-hook="cr-filter-info-review-rating-count"]')
        if el:
            m = self._TOTAL_RE.search(el.get_text())
            if m:
                return int(m.group(1).replace(",", ""))
        # Fallback: total review count in the header.
        el = soup.select_one('[data-hook="total-review-count"]')
        if el:
            m = re.search(r"([\d,]+)", el.get_text())
            if m:
                return int(m.group(1).replace(",", ""))
        return 0

    def get_review_url_batches(self, url: str) -> list[str]:
        """Return product page + review listing URLs in multiple sort orders.

          Batch 0:     product page (/dp/ASIN) -- has ~5 embedded reviews,
                       works without authentication.
          Batch 1:     review listing, all stars, top reviews (default)
          Batch 2:     review listing, all stars, most recent
          Batch 3-7:   per-star filter, most recent
          Batch 8-12:  per-star filter, most helpful

        13 batches total.  The product page is first because Amazon.in
        redirects review listing pages to sign-in for unauthenticated
        server IPs, but the product page always works.
        """
        base = self.normalize_url(url)
        match = self._ASIN_RE.search(base)
        if not match:
            return [base]
        asin = match.group(1)
        parsed = urlparse(base)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        # Batch 0: product detail page (always accessible, has embedded reviews).
        product_page = f"{origin}/dp/{asin}"
        urls = [product_page]

        # Batch 1: review listing, all stars, default sort.
        urls.append(base)
        # Batch 2: all stars, most recent.
        urls.append(
            f"{origin}/product-reviews/{asin}"
            f"/ref=cm_cr_arp_d_viewopt_sr"
            f"?ie=UTF8&reviewerType=all_reviews&pageNumber=1"
            f"&sortBy=recent"
        )
        # Batches 3-7: per-star, most recent sort.
        for star in self._STAR_FILTERS:
            urls.append(
                f"{origin}/product-reviews/{asin}"
                f"/ref=cm_cr_arp_d_viewopt_sr"
                f"?ie=UTF8&reviewerType=all_reviews&pageNumber=1"
                f"&filterByStar={star}&sortBy=recent"
            )
        # Batches 8-12: per-star, most helpful sort.
        for star in self._STAR_FILTERS:
            urls.append(
                f"{origin}/product-reviews/{asin}"
                f"/ref=cm_cr_arp_d_viewopt_sr"
                f"?ie=UTF8&reviewerType=all_reviews&pageNumber=1"
                f"&filterByStar={star}&sortBy=helpful"
            )
        return urls

    def get_next_page_url(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """Return the next-page URL if a "Next" link is present."""

        soup = self._soup(html)

        # No pagination element at all -- Amazon may be serving the
        # limited no-pagination view.  Don't fabricate URLs.
        pagination = soup.select_one("ul.a-pagination")
        if not pagination:
            return None

        # If pagination exists and the "Next" control is disabled, stop.
        if pagination.select_one("li.a-disabled.a-last"):
            return None

        next_a = pagination.select_one("li.a-last a[href]")
        href_val = next_a.get("href") if next_a else None
        if href_val:
            return urljoin(current_url, str(href_val))

        # Fallback: construct the URL in Amazon's expected pagination format.
        next_page = current_page + 1
        match = self._ASIN_RE.search(current_url)
        if match:
            asin = match.group(1)
            parsed = urlparse(current_url)
            params = parse_qs(parsed.query, keep_blank_values=True)
            params["pageNumber"] = [str(next_page)]
            if "reviewerType" not in params:
                params["reviewerType"] = ["all_reviews"]
            new_query = urlencode(params, doseq=True)
            return (
                f"{parsed.scheme}://{parsed.netloc}"
                f"/product-reviews/{asin}/ref=cm_cr_getr_d_paging_btm_next_{next_page}"
                f"?{new_query}"
            )

        return self._update_query_param(current_url, "pageNumber", str(next_page))

    def get_next_page_selenium_selector(
        self, html: str, current_url: str, current_page: int
    ) -> Optional[str]:
        """CSS selector for Selenium to click the Amazon "Next" pagination link.

        Amazon sometimes returns the first page when you navigate directly to
        `pageNumber=2`. Clicking the in-page "Next" link is more reliable.
        """

        soup = self._soup(html)
        if soup.select_one("ul.a-pagination li.a-disabled.a-last"):
            return None

        if soup.select_one("ul.a-pagination li.a-last a[href]"):
            return "ul.a-pagination li.a-last a"
        return None

    # ------------------------------------------------------------------
    # Main parse
    # ------------------------------------------------------------------

    def parse(self, html: str, *, url: str) -> list[Review]:
        soup = self._soup(html)

        # Amazon review containers vary by page type:
        # - Review listing pages: div[data-hook="review"]
        # - Product detail pages: div[id^="customer_review-"]
        # - Newer layout: div[data-hook="mob-review"]
        containers = soup.select(
            'div[data-hook="review"], '
            'div[id^="customer_review-"], '
            'div[data-hook="mob-review"]'
        )
        reviews: list[Review] = []

        for c in containers:
            # Extract unique review ID from the container's id attribute.
            # Amazon uses ids like "R1ABC123DEF456" or "customer_review-R1ABC...".
            review_id = self._extract_review_id(c)

            text = self._first_text(
                c,
                [
                    'span[data-hook="review-body"]',
                    '[data-hook="review-body"] span',
                    '[data-hook="review-body"]',
                    'div.review-text-content span',
                    'div.review-text span',
                ],
            )

            rating_text = self._first_text(
                c,
                [
                    '[data-hook="review-star-rating"] .a-icon-alt',
                    '[data-hook="cmps-review-star-rating"] .a-icon-alt',
                    '[data-hook="review-star-rating"]',
                    '[data-hook="cmps-review-star-rating"]',
                    'i[data-hook="review-star-rating"] span',
                    'span.a-icon-alt',
                ],
            )
            date = self._extract_date(c)
            rating = self._parse_rating(rating_text)
            if text and rating is not None:
                reviews.append(Review(text=text, rating=rating, review_id=review_id, date=date))

        # Fallback: product-page review section (#cm-cr-dp-review-list).
        if not reviews:
            review_section = soup.select_one("#cm-cr-dp-review-list")
            if review_section:
                for c in review_section.select('div[data-hook="review"]'):
                    review_id = self._extract_review_id(c)
                    text = self._first_text(
                        c,
                        [
                            'span[data-hook="review-body"]',
                            '[data-hook="review-body"] span',
                        ],
                    )
                    rating_text = self._first_text(
                        c,
                        [
                            '[data-hook="review-star-rating"] .a-icon-alt',
                            'span.a-icon-alt',
                        ],
                    )
                    date = self._extract_date(c)
                    rating = self._parse_rating(rating_text)
                    if text and rating is not None:
                        reviews.append(Review(text=text, rating=rating, review_id=review_id, date=date))

        # Fallback: embedded scripts.
        if not reviews:
            reviews = self._extract_from_embedded_scripts(soup)

        # Fallback: JSON-LD.
        if not reviews:
            reviews = self._extract_reviews_from_json_ld(soup)

        return self._dedupe(reviews)
