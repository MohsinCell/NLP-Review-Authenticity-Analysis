from __future__ import annotations

import logging


def setup_logging(*, level: str = "INFO") -> logging.Logger:
    """Configure a simple console logger for the scraper."""

    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,
    )
    return logging.getLogger("review_scraper")
