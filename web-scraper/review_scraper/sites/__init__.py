from __future__ import annotations

from typing import Iterable, Optional

from review_scraper.core.parser_base import BaseParser
from review_scraper.sites.ajio import AjioParser
from review_scraper.sites.amazon import AmazonParser
from review_scraper.sites.flipkart import FlipkartParser
from review_scraper.sites.myntra import MyntraParser
from review_scraper.sites.nykaa import NykaaParser


PARSERS: tuple[type[BaseParser], ...] = (
    AmazonParser,
    FlipkartParser,
    MyntraParser,
    AjioParser,
    NykaaParser,
)


def iter_parsers() -> Iterable[BaseParser]:
    for cls in PARSERS:
        yield cls()


def get_parser_for_url(url: str) -> Optional[BaseParser]:
    for p in iter_parsers():
        if p.match(url):
            return p
    return None
