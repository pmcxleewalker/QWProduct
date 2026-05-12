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
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "invites@send.quick-wing.com").strip()
SENDER_NAME = os.environ.get("SENDER_NAME", "Quick Wing").strip()
REPLY_TO_EMAIL = os.environ.get("REPLY_TO_EMAIL", "Lee.quickwing@gmail.com").strip()

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


def _build_owner_welcome_html(
    *,
    owner_name: str,
    tenant_name: str,
    login_url: str,
    temporary_password: str,
    sender_full_name: str,
) -> str:
    """HTML body for the new tenant-owner welcome email."""
    safe_name = owner_name or "there"
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Welcome to Quick Wing</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0721;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0721;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.18);">
          <tr>
            <td style="background:linear-gradient(115deg,#1e0a3c 0%,#4c1d95 35%,#7c3aed 60%,#a855f7 100%);padding:36px 36px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#e9d5ff;margin-bottom:8px;font-weight:700;">Quick Wing &middot; Fleet OS</div>
              <div style="font-size:26px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;">Welcome to {tenant_name}, {safe_name}.</div>
              <div style="font-size:14px;color:#e9d5ff;margin-top:10px;">Your account is ready &mdash; you're the owner of this fleet workspace.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;font-size:15px;line-height:1.65;color:#0f172a;">
              <p style="margin:0 0 14px 0;">Hi {safe_name},</p>
              <p style="margin:0 0 18px 0;">{sender_full_name} has set up <strong>{tenant_name}</strong> on Quick Wing and given you the highest level of admin access. From your dashboard you can manage vehicles, staff, bookings, compliance reminders and more.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,#faf5ff 0%,#ffffff 100%);border:1px solid #e9d5ff;border-radius:12px;margin:6px 0 22px 0;">
                <tr>
                  <td style="padding:18px 22px;">
                    <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7c3aed;font-weight:700;margin-bottom:10px;">Your sign-in details</div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px;">Email</div>
                    <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:14px;">{{__EMAIL__}}</div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px;">Temporary password</div>
                    <div style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:0.04em;padding:8px 12px;background:#f1f5f9;border-radius:8px;display:inline-block;">{temporary_password}</div>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:24px 0;">
                <a href="{login_url}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(124,58,237,0.4);">Sign in to your dashboard</a>
              </div>
              <div style="text-align:center;font-size:12px;color:#64748b;margin-bottom:24px;word-break:break-all;">{login_url}</div>
              <div style="border-top:1px solid #e2e8f0;padding-top:22px;margin-top:6px;">
                <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7c3aed;font-weight:700;margin-bottom:14px;">First 10 minutes &mdash; quick start</div>
                <ol style="margin:0 0 0 18px;padding:0;font-size:14px;line-height:1.7;color:#334155;">
                  <li style="margin-bottom:4px;"><strong>Change your password</strong> in Profile &rarr; Security.</li>
                  <li style="margin-bottom:4px;"><strong>Add your vehicles</strong> in Fleet &rarr; Add vehicle (or bulk-import via CSV).</li>
                  <li style="margin-bottom:4px;"><strong>Invite your staff</strong> from Team &rarr; Add member. They get an activation email automatically.</li>
                  <li style="margin-bottom:4px;"><strong>Set Tax / NCT expiry dates</strong> on each car so the dashboard flags renewals 60 days out.</li>
                  <li><strong>Open Bookings</strong> &mdash; click any green time-slot to make your first reservation.</li>
                </ol>
              </div>
              <p style="margin:24px 0 0 0;font-size:13px;color:#64748b;">
                Need a hand getting started? Reply to this email and we'll jump in.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.6;">
              You're receiving this because {sender_full_name} added you as the owner of {tenant_name} on Quick Wing.<br />
              &copy; 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()


async def send_owner_welcome_email(
    *,
    recipient_email: str,
    owner_name: Optional[str],
    tenant_name: str,
    login_url: str,
    temporary_password: str,
    sender_full_name: str = "Lee at Quick Wing",
) -> dict:
    """Send the per-tenant master-admin welcome email via Resend."""
    if not RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not configured \u2014 skipping owner welcome to %s",
            recipient_email,
        )
        return {"success": False, "email_id": None, "error": "RESEND_API_KEY not configured"}

    html_body = _build_owner_welcome_html(
        owner_name=owner_name or "",
        tenant_name=tenant_name,
        login_url=login_url,
        temporary_password=temporary_password,
        sender_full_name=sender_full_name,
    ).replace("{{__EMAIL__}}", recipient_email)

    safe_tenant = (tenant_name or "").strip()
    display_name = f"{safe_tenant} via {SENDER_NAME}" if safe_tenant else SENDER_NAME

    params = {
        "from": f"{display_name} <{SENDER_EMAIL}>",
        "to": [recipient_email],
        "reply_to": REPLY_TO_EMAIL,
        "subject": f"You're the owner of {safe_tenant or 'your fleet'} on Quick Wing",
        "html": html_body,
    }

    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        email_id = result.get("id") if isinstance(result, dict) else None
        logger.info("Owner welcome email sent to %s (id=%s)", recipient_email, email_id)
        return {"success": True, "email_id": email_id, "error": None}
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send owner welcome email to %s: %s", recipient_email, exc)
        return {"success": False, "email_id": None, "error": str(exc)}



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

    Subject: "Welcome to Quick Wing"
    From: "{tenant_name} via Quick Wing <invites@send.quick-wing.com>"
    Reply-To: Lee.quickwing@gmail.com (so customer replies land in support)

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

    # Branded "from name": tenant name displayed first so the recipient sees
    # who sent it at a glance, but still backed by the QuickFleet sending
    # domain. Falls back to plain "Quick Wing" if no tenant name.
    safe_tenant = (tenant_name or "").strip()
    display_name = f"{safe_tenant} via {SENDER_NAME}" if safe_tenant else SENDER_NAME

    params = {
        "from": f"{display_name} <{SENDER_EMAIL}>",
        "to": [recipient_email],
        "reply_to": REPLY_TO_EMAIL,
        "subject": "Welcome to Quick Wing",
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
