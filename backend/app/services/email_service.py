import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
from typing import Optional, Dict, Any
from datetime import datetime
from loguru import logger
from app.core.config import get_settings

settings = get_settings()

def send_support_issue_email(
    report_id: int,
    issue_type: str,
    subject: Optional[str],
    description: str,
    user_email: Optional[str],
    user_id: Optional[int],
    context_data: Optional[Dict[str, Any]] = None,
    created_at: Optional[datetime] = None,
) -> bool:
    """Send an immediate HTML + text notification to the admin regarding a user-reported issue."""
    target_email = settings.SUPPORT_NOTIFICATION_EMAIL or "ahbarajaib@gmail.com"
    timestamp_str = (created_at or datetime.utcnow()).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Format human-readable issue type
    type_labels = {
        "bug": "🐛 Bug / Technical Issue",
        "formatting": "📄 DOCX / PDF Formatting Issue",
        "ai_quality": "🤖 AI Output Quality Issue",
        "payment": "💳 Credit / Subscription Issue",
        "feature_request": "💡 Feature Request",
        "general": "💬 General Feedback",
    }
    issue_label = type_labels.get(issue_type, f"⚠️ {issue_type.title()}")
    email_subject = f"[RoleCraft Issue #{report_id}] {issue_label}: {subject or description[:50]}"

    # Pretty format context details
    context_html = ""
    context_text = ""
    if context_data:
        context_rows = []
        for k, v in context_data.items():
            val_str = json.dumps(v, indent=2) if isinstance(v, (dict, list)) else str(v)
            context_rows.append(f"<tr><td style='padding:6px 12px;font-weight:bold;color:#475569;border:1px solid #e2e8f0;background:#f8fafc;'>{k}</td><td style='padding:6px 12px;color:#0f172a;border:1px solid #e2e8f0;font-family:monospace;font-size:12px;'><pre style='margin:0;white-space:pre-wrap;'>{val_str}</pre></td></tr>")
            context_text += f"  • {k}: {val_str}\n"
        context_html = f"""
        <h4 style="margin:20px 0 8px 0;color:#1e293b;font-size:14px;">🛠️ Technical Context & Diagnostics:</h4>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
            {''.join(context_rows)}
        </table>
        """

    # HTML Body
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#0f172a;background-color:#f1f5f9;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);padding:20px 24px;color:#ffffff;">
          <h2 style="margin:0 0 4px 0;font-size:18px;font-weight:800;letter-spacing:-0.02em;">RoleCraft Issue Alert</h2>
          <p style="margin:0;font-size:13px;opacity:0.9;">Report #{report_id} • {timestamp_str}</p>
        </div>

        <!-- Content Body -->
        <div style="padding:24px;">
          <div style="display:inline-block;padding:4px 12px;border-radius:9999px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:12px;border:1px solid #bfdbfe;margin-bottom:16px;">
            {issue_label}
          </div>

          <div style="margin-bottom:18px;">
            <strong style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Reporter Information:</strong>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;border-radius:10px;font-size:13px;">
              <div><strong>Email:</strong> {user_email or 'Guest (No email provided)'}</div>
              <div><strong>User ID:</strong> {user_id or 'Unauthenticated Visitor'}</div>
            </div>
          </div>

          <div style="margin-bottom:18px;">
            <strong style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Description:</strong>
            <div style="background:#ffffff;border:1px solid #cbd5e1;padding:14px;border-radius:10px;font-size:14px;white-space:pre-wrap;color:#1e293b;line-height:1.6;">{description}</div>
          </div>

          {context_html}
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
          RoleCraft Automated Error & Feedback Notification System
        </div>
      </div>
    </body>
    </html>
    """

    # Plain text fallback
    plain_text = f"""
[RoleCraft Issue Alert #{report_id}]
Category: {issue_label}
Date: {timestamp_str}
Reporter Email: {user_email or 'None'}
User ID: {user_id or 'None'}

Description:
{description}

Technical Context:
{context_text if context_text else 'None provided'}
"""

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(
            f"📧 [Email Alert Mock] SMTP not configured in .env. Issue #{report_id} saved to DB. "
            f"Notification would have been sent to {target_email} with subject: {email_subject}"
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = email_subject
        msg["From"] = settings.SMTP_FROM_EMAIL or "noreply@rolecraft.tech"
        msg["To"] = target_email
        if user_email and "@" in user_email:
            msg["Reply-To"] = user_email

        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            if settings.SMTP_USE_TLS:
                server.starttls()

        if settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(msg["From"], [target_email], msg.as_string())
        server.quit()
        logger.info(f"✅ [Email Alert] Successfully dispatched issue notification #{report_id} to {target_email}")
        return True
    except Exception as exc:
        logger.error(f"❌ [Email Alert Failed] Could not send issue #{report_id} email notification: {exc}")
        return False
