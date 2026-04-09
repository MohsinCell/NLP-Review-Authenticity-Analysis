"""Lightweight email notifier using Resend HTTP API for cookie expiry alerts."""

from __future__ import annotations

import logging
import os
import time
import threading
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("review_scraper.email_notifier")

RESEND_API_URL = "https://api.resend.com/emails"
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
ADMIN_EMAIL = os.environ.get("RESEND_ADMIN_EMAIL", "")
SENDER = "ReviewIQ System <noreply@reviewiq.website>"

_cooldown_seconds = 6 * 3600
_last_sent: dict[str, float] = {}
_lock = threading.Lock()


def _is_on_cooldown(site_key: str) -> bool:
    with _lock:
        last = _last_sent.get(site_key, 0)
        return (time.time() - last) < _cooldown_seconds


def _mark_sent(site_key: str) -> None:
    with _lock:
        _last_sent[site_key] = time.time()


def notify_cookie_expiry(site_key: str, site_name: str, domain: str, message: str) -> bool:
    """Send a cookie expiry alert email to the admin. Returns True if sent."""
    if not RESEND_API_KEY:
        logger.debug("Resend API key not set - skipping cookie expiry email")
        return False

    if not ADMIN_EMAIL:
        logger.debug("Admin email not set - skipping cookie expiry email")
        return False

    if _is_on_cooldown(site_key):
        logger.debug("Cookie expiry email for %s is on cooldown - skipping", site_key)
        return False

    timestamp = datetime.now(timezone.utc).strftime("%b %d, %Y at %H:%M UTC")
    subject = f"Cookie Alert: {site_name} Cookies Expired"
    html = _build_cookie_expiry_html(site_name, domain, message, timestamp)

    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": SENDER,
                "to": [ADMIN_EMAIL],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            _mark_sent(site_key)
            logger.info("Cookie expiry email sent to %s for site %s", ADMIN_EMAIL, site_key)
            return True
        else:
            logger.error("Resend API error %d: %s", resp.status_code, resp.text)
            return False
    except Exception as exc:
        logger.error("Failed to send cookie expiry email: %s", exc)
        return False


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _build_cookie_expiry_html(site_name: str, domain: str, message: str, timestamp: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <title>ReviewIQ</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000; -webkit-font-smoothing: antialiased;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#000000" style="background-color: #000000;">
        <tr>
            <td bgcolor="#000000" style="background-color: #000000; background: radial-gradient(ellipse at top center, rgba(255,255,255,0.06) 0%, transparent 50%); padding: 0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td bgcolor="#000000" style="background-color: #000000; background: radial-gradient(circle at 80% 60%, rgba(255,255,255,0.03) 0%, transparent 40%); padding: 0;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td bgcolor="#000000" style="background-color: #000000; background: radial-gradient(circle at 20% 80%, rgba(255,255,255,0.025) 0%, transparent 40%); padding: 0;">

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="center" style="padding: 0;">
                                                    <div style="height: 1px; max-width: 560px; margin: 0 auto; background: linear-gradient(90deg, transparent 0%, #262626 50%, transparent 100%);"></div>
                                                </td>
                                            </tr>
                                        </table>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="center" bgcolor="#000000" style="padding: 48px 16px;">
                                                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto;">

                                                        <tr>
                                                            <td align="center" style="padding-bottom: 32px;">
                                                                <table border="0" cellspacing="0" cellpadding="0" align="center">
                                                                    <tr>
                                                                        <td bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 12px; padding: 12px 24px;">
                                                                            <span style="font-size: 22px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">ReviewIQ</span>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>

                                                        <tr>
                                                            <td align="center">
                                                                <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#0d0d0d" style="background-color: #0d0d0d; background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%); border-radius: 20px; border: 1px solid #1a1a1a; overflow: hidden;">

                                                                    <tr>
                                                                        <td align="center" bgcolor="#1a1205" style="background-color: #1a1205; background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.04) 100%); padding: 40px 40px 32px; border-bottom: 1px solid #271905; text-align: center;">
                                                                            <h1 style="margin: 0 0 8px; color: #f59e0b; font-size: 28px; font-weight: 700; line-height: 1.2; letter-spacing: -0.5px; text-align: center;">Cookie Expiry Alert</h1>
                                                                            <p style="margin: 0; color: #999999; font-size: 15px; font-weight: 400; text-align: center;">Action required: scraper cookies need renewal</p>
                                                                        </td>
                                                                    </tr>

                                                                    <tr>
                                                                        <td bgcolor="#0d0d0d" style="background-color: #0d0d0d; padding: 36px 40px 44px; text-align: center;">
                                                                            <p style="margin: 0 0 24px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                                                                                The scraper cookies for <strong style="color: #ffffff;">{_escape(site_name)}</strong> have expired and need to be refreshed to continue scraping reviews.
                                                                            </p>

                                                                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                                                                                <tr>
                                                                                    <td bgcolor="#1a1205" style="background-color: #1a1205; background: linear-gradient(145deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%); border-radius: 16px; padding: 24px 26px; border: 1px solid #332006;">
                                                                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                                                            <tr>
                                                                                                <td style="padding-bottom: 16px; text-align: center;">
                                                                                                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Site</p>
                                                                                                    <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 500; text-align: center;">{_escape(site_name)} ({_escape(domain)})</p>
                                                                                                </td>
                                                                                            </tr>
                                                                                            <tr>
                                                                                                <td style="border-top: 1px solid #271905; padding: 16px 0; text-align: center;">
                                                                                                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Status</p>
                                                                                                    <p style="margin: 0; color: #f59e0b; font-size: 15px; font-weight: 600; text-align: center;">{_escape(message)}</p>
                                                                                                </td>
                                                                                            </tr>
                                                                                            <tr>
                                                                                                <td style="border-top: 1px solid #271905; padding-top: 16px; text-align: center;">
                                                                                                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Detected At</p>
                                                                                                    <p style="margin: 0; color: #bfbfbf; font-size: 15px; text-align: center;">{_escape(timestamp)}</p>
                                                                                                </td>
                                                                                            </tr>
                                                                                        </table>
                                                                                    </td>
                                                                                </tr>
                                                                            </table>

                                                                            <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.7; text-align: center;">
                                                                                Log in to the ReviewIQ admin panel and navigate to <strong style="color: #b3b3b3;">Admin &gt; Cookies</strong> to import fresh cookies for this site.
                                                                            </p>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>

                                                        <tr>
                                                            <td align="center" style="padding: 24px 0 0;">
                                                                <div style="height: 1px; max-width: 200px; margin: 0 auto; background: linear-gradient(90deg, transparent 0%, #1a1a1a 50%, transparent 100%);"></div>
                                                            </td>
                                                        </tr>

                                                        <tr>
                                                            <td align="center" style="padding: 20px 20px 0; text-align: center;">
                                                                <p style="margin: 0 0 8px; color: #595959; font-size: 13px; line-height: 1.5; text-align: center;">
                                                                    This is an automated alert from the ReviewIQ scraper service.
                                                                </p>
                                                                <p style="margin: 0; color: #333333; font-size: 12px; text-align: center;">
                                                                    &copy; {datetime.now(timezone.utc).year} ReviewIQ &middot; Powered by Advanced NLP Technology
                                                                </p>
                                                            </td>
                                                        </tr>

                                                    </table>
                                                </td>
                                            </tr>
                                        </table>

                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
