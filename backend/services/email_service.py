"""
Email service for Quick Wing.

Uses Resend (https://resend.com) to send transactional emails such as
staff invitation emails. The Resend SDK is synchronous, so all calls
are wrapped with `asyncio.to_thread` to keep FastAPI non-blocking.
"""
import os
import asyncio
import logging
from typing import Optional

import resend

logger = logging.getLogger(__name__)

# Configure Resend with the API key from the environment.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "invites@quick-wing.com").strip()
SENDER_NAME = "Quick Wing"

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _build_staff_invite_html(
    *,
    staff_name: str,
    tenant_name: str,
    activation_url: str,
    login_url: str,
    temporary_password: str,
) -> str:
    """Render the HTML body for a staff invitation email (inline CSS only)."""
    safe_name = staff_name or "there"
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Welcome to Quick Wing</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd;margin-bottom:6px;">Quick Wing</div>
              <div style="font-size:22px;font-weight:700;line-height:1.3;">You've been added to {tenant_name}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#0f172a;">
              <p style="margin:0 0 16px 0;">Hi {safe_name},</p>
              <p style="margin:0 0 16px 0;">
                You've been invited to join <strong>{tenant_name}</strong> on Quick Wing — the fleet
                management platform your team uses to book vehicles, log incidents and stay on top of
                compliance.
              </p>
              <p style="margin:0 0 24px 0;">
                Click the button below to activate your account and set your own password.
              </p>

              <!-- CTA button (table-based for email-client compatibility) -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#2563eb;border-radius:10px;">
                    <a href="{activation_url}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Activate your account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">
                Or sign in manually:
              </p>

              <!-- Manual credentials box -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 24px 0;">
                <tr>
                  <td style="padding:16px 20px;font-size:14px;line-height:1.6;">
                    <div><strong>Login URL:</strong> <a href="{login_url}" style="color:#2563eb;text-decoration:none;">{login_url}</a></div>
                    <div><strong>Email:</strong> the email this message was sent to</div>
                    <div><strong>Temporary password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-family:Menlo,Consolas,monospace;">{temporary_password}</code></div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">
                For security, you'll be asked to set a new password on first login. The activation
                link above is single-use and expires in 7 days.
              </p>

              <p style="margin:24px 0 0 0;font-size:13px;color:#64748b;">
                If you weren't expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.6;">
              © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()


async def send_staff_invitation_email(
    *,
    recipient_email: str,
    staff_name: Optional[str],
    tenant_name: str,
    activation_url: str,
    login_url: str,
    temporary_password: str,
) -> dict:
    """
    Send a staff invitation email via Resend.

    Returns: {"success": bool, "email_id": Optional[str], "error": Optional[str]}
    Never raises — failures are logged and reported in the return value so
    the calling endpoint can still return success for the user record itself.
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured — skipping staff invite email to %s", recipient_email)
        return {"success": False, "email_id": None, "error": "RESEND_API_KEY not configured"}

    html_body = _build_staff_invite_html(
        staff_name=staff_name or "",
        tenant_name=tenant_name,
        activation_url=activation_url,
        login_url=login_url,
        temporary_password=temporary_password,
    )

    params = {
        "from": f"{SENDER_NAME} <{SENDER_EMAIL}>",
        "to": [recipient_email],
        "subject": f"Welcome to {tenant_name} on Quick Wing",
        "html": html_body,
    }

    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        email_id = result.get("id") if isinstance(result, dict) else None
        logger.info("Staff invite email sent to %s (id=%s)", recipient_email, email_id)
        return {"success": True, "email_id": email_id, "error": None}
    except Exception as exc:  # noqa: BLE001 — Resend SDK raises various error classes
        logger.error("Failed to send staff invite email to %s: %s", recipient_email, exc)
        return {"success": False, "email_id": None, "error": str(exc)}
