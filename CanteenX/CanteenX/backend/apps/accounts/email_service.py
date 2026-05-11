"""
Reusable email helpers for accounts app.
"""

import logging
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _send_email_sync(to_email, employee_name, username, raw_password, login_url):
    """
    Internal: Actually send the email (synchronous).
    This runs in a background thread to avoid blocking the request.
    """
    subject = "Your Employee Login Credentials"
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None)

    text_body = (
        f"Hello {employee_name},\n\n"
        "Your employee account has been created.\n\n"
        f"Login URL: {login_url}\n"
        f"Username: {username}\n"
        f"Password: {raw_password}\n\n"
        "For security, please change your password immediately after first login.\n\n"
        "Regards,\n"
        "Admin Team"
    )

    try:
        html_body = render_to_string(
            "accounts/emails/employee_credentials.html",
            {
                "employee_name": employee_name,
                "login_url": login_url,
                "username": username,
                "raw_password": raw_password,
            },
        )
    except Exception as e:
        logger.exception("Failed to render email template for %s: %s", to_email, e)
        html_body = text_body

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[to_email],
    )
    if html_body != text_body:
        message.attach_alternative(html_body, "text/html")

    try:
        message.send(fail_silently=False)
        logger.info("Successfully sent employee credentials email to %s", to_email)
    except Exception:
        logger.exception("Failed sending employee credentials email to %s", to_email)


def send_employee_credentials_email(*, to_email, employee_name, username, raw_password, login_url):
    """
    Send employee login credentials asynchronously in a background thread.
    Returns immediately without waiting for the email to be sent.
    """
    thread = threading.Thread(
        target=_send_email_sync,
        args=(to_email, employee_name, username, raw_password, login_url),
        daemon=True,  # Daemon thread won't prevent app shutdown
    )
    thread.start()
