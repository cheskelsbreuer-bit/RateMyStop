"""Resend integration for sending complaint emails.
Falls back to a no-op (returns False) if RESEND_API_KEY is not configured.
"""
import httpx
from config import settings


async def send_complaint_email(to: str, subject: str, body_text: str) -> tuple[bool, str | None]:
    """Returns (sent, error_message). sent=False with error=None means email is disabled."""
    if not settings.resend_api_key:
        return False, None
    if not to:
        return False, "no recipient email"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.resend_from,
                    "to": [to],
                    "subject": subject,
                    "text": body_text,
                },
            )
            if r.status_code >= 300:
                return False, f"Resend error {r.status_code}: {r.text[:300]}"
            return True, None
    except Exception as e:
        return False, str(e)
