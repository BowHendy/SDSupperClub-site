/** Comma-separated admin notification inboxes; falls back to ADMIN_NOTIFICATION_EMAIL. */
export function getAdminNotificationEmails(): string[] {
  const multi = process.env.ADMIN_NOTIFICATION_EMAILS?.trim();
  if (multi) {
    return multi
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
  }

  const single = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  return single ? [single] : [];
}
