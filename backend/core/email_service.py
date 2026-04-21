import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from dotenv import load_dotenv

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

async def send_failed_login_alert(email: str, name: str, attempts: int):
    message = MessageSchema(
        subject="Security Alert — Failed Login Attempts",
        recipients=[email],
        body=f"""
        <html><body style="font-family:monospace;background:#040404;color:#00ffe0;padding:32px;">
        <h2 style="color:#ff2d78;">Security Alert</h2>
        <p style="color:#fff;">Hi {name},</p>
        <p style="color:#fff;">We detected <strong style="color:#ff2d78;">{attempts} failed login attempts</strong> on your Nexus Access account.</p>
        <p style="color:#fff;">If this was not you, contact your admin immediately.</p>
        <hr style="border-color:rgba(0,255,224,0.2);">
        <p style="color:rgba(255,255,255,0.3);font-size:11px;">Nexus Access Control System</p>
        </body></html>
        """,
        subtype="html"
    )
    fm = FastMail(conf)
    await fm.send_message(message)

async def send_account_disabled_alert(email: str, name: str):
    message = MessageSchema(
        subject="Account Disabled — Nexus Access",
        recipients=[email],
        body=f"""
        <html><body style="font-family:monospace;background:#040404;color:#00ffe0;padding:32px;">
        <h2 style="color:#ff2d78;">Account Disabled</h2>
        <p style="color:#fff;">Hi {name},</p>
        <p style="color:#fff;">Your account has been <strong style="color:#ff2d78;">disabled by an administrator</strong>.</p>
        <p style="color:#fff;">Contact your admin to re-enable access.</p>
        <hr style="border-color:rgba(0,255,224,0.2);">
        <p style="color:rgba(255,255,255,0.3);font-size:11px;">Nexus Access Control System</p>
        </body></html>
        """,
        subtype="html"
    )
    fm = FastMail(conf)
    await fm.send_message(message)