function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "there";
}

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;color:#f5f0e8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#1a1a1a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#242424;border:1px solid rgba(255,255,255,0.12);border-radius:8px;">
            <tr>
              <td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#f5f0e8;">Supper Collective</p>
                <p style="margin:0 0 24px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a962;">${escapeHtml(title)}</p>
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildWelcomeEmail(name: string | null | undefined): { subject: string; text: string; html: string } {
  const greeting = displayName(name);
  const subject = "Supper Collective — you're approved";
  const text = [
    `Hi ${greeting},`,
    "",
    "You've been approved to join Supper Collective.",
    "",
    "Next, watch for a separate invitation email from Netlify Identity with your secure signup link.",
    "Once you accept the invite, you'll set your password and can log in to the members area.",
    "",
    "If you don't see the invite within a few minutes, please check your spam folder.",
    "",
    "We look forward to seeing you at the table.",
    "",
    "— Supper Collective",
  ].join("\n");

  const html = emailShell(
    "Welcome",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">You've been approved to join Supper Collective.</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Watch for a separate invitation email from Netlify Identity with your secure signup link. Once you accept, you'll set your password and can log in to the members area.</p>
     <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#b8b0a4;">If you don't see the invite within a few minutes, please check your spam folder.</p>
     <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#f5f0e8;">We look forward to seeing you at the table.</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );

  return { subject, text, html };
}

export function buildRejectionEmail(
  name: string | null | undefined,
  note?: string
): { subject: string; text: string; html: string } {
  const greeting = displayName(name);
  const trimmedNote = note?.trim();
  const subject = "Supper Collective — update on your request";

  const textLines = [
    `Hi ${greeting},`,
    "",
    "Thank you for your interest in Supper Collective.",
    "",
    "At this time, we're not able to offer you membership.",
  ];
  if (trimmedNote) {
    textLines.push("", "Note from the team:", trimmedNote);
  }
  textLines.push("", "We appreciate you reaching out and wish you all the best.", "", "— Supper Collective");
  const text = textLines.join("\n");

  const noteHtml = trimmedNote
    ? `<div style="margin:20px 0;padding:16px;border-left:3px solid #c9a962;background-color:rgba(201,169,98,0.08);">
         <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#c9a962;">Note from the team</p>
         <p style="margin:0;font-size:15px;line-height:1.6;color:#e8e0d4;white-space:pre-wrap;">${escapeHtml(trimmedNote)}</p>
       </div>`
    : "";

  const html = emailShell(
    "Membership update",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Thank you for your interest in Supper Collective.</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">At this time, we're not able to offer you membership.</p>
     ${noteHtml}
     <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#e8e0d4;">We appreciate you reaching out and wish you all the best.</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );

  return { subject, text, html };
}

type EmailContent = { subject: string; text: string; html: string };

function noteBlockHtml(note?: string): string {
  const trimmed = note?.trim();
  if (!trimmed) return "";
  return `<div style="margin:20px 0;padding:16px;border-left:3px solid #c9a962;background-color:rgba(201,169,98,0.08);">
       <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#c9a962;">Note from the team</p>
       <p style="margin:0;font-size:15px;line-height:1.6;color:#e8e0d4;white-space:pre-wrap;">${escapeHtml(trimmed)}</p>
     </div>`;
}

/** Host application decision (approved or rejected). */
export function buildHostDecisionEmail(
  approved: boolean,
  name: string | null | undefined,
  note?: string
): EmailContent {
  const greeting = displayName(name);
  if (approved) {
    const subject = "Supper Collective — you're approved to host";
    const text = [
      `Hi ${greeting},`,
      "",
      "Good news — your application to host a Supper Collective dinner has been approved.",
      "",
      "Log in to your host workspace to create your dinner, agree on a menu and price with your chef, and start inviting guests.",
      note?.trim() ? `\nNote from the team:\n${note.trim()}` : "",
      "",
      "— Supper Collective",
    ].join("\n");
    const html = emailShell(
      "Host application approved",
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
       <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Good news — your application to host a Supper Collective dinner has been approved.</p>
       <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Log in to your host workspace to create your dinner, agree on a menu and price with your chef, and start inviting guests.</p>
       ${noteBlockHtml(note)}
       <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
    );
    return { subject, text, html };
  }

  const subject = "Supper Collective — update on your host application";
  const text = [
    `Hi ${greeting},`,
    "",
    "Thank you for applying to host a Supper Collective dinner.",
    "At this time we're not able to approve your application.",
    note?.trim() ? `\nNote from the team:\n${note.trim()}` : "",
    "",
    "— Supper Collective",
  ].join("\n");
  const html = emailShell(
    "Host application update",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Thank you for applying to host a Supper Collective dinner. At this time we're not able to approve your application.</p>
     ${noteBlockHtml(note)}
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );
  return { subject, text, html };
}

/** Chef application decision (approved or rejected). */
export function buildChefDecisionEmail(
  approved: boolean,
  name: string | null | undefined,
  note?: string
): EmailContent {
  const greeting = displayName(name);
  if (approved) {
    const subject = "Supper Collective — you're approved as a chef";
    const text = [
      `Hi ${greeting},`,
      "",
      "Welcome aboard — your chef application has been approved.",
      "You can now be paired with hosts, propose menus and per-guest pricing, and confirm dinners.",
      note?.trim() ? `\nNote from the team:\n${note.trim()}` : "",
      "",
      "— Supper Collective",
    ].join("\n");
    const html = emailShell(
      "Chef application approved",
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
       <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Welcome aboard — your chef application has been approved. You can now be paired with hosts, propose menus and per-guest pricing, and confirm dinners.</p>
       ${noteBlockHtml(note)}
       <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
    );
    return { subject, text, html };
  }

  const subject = "Supper Collective — update on your chef application";
  const text = [
    `Hi ${greeting},`,
    "",
    "Thank you for applying to cook with Supper Collective.",
    "At this time we're not able to approve your application.",
    note?.trim() ? `\nNote from the team:\n${note.trim()}` : "",
    "",
    "— Supper Collective",
  ].join("\n");
  const html = emailShell(
    "Chef application update",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Thank you for applying to cook with Supper Collective. At this time we're not able to approve your application.</p>
     ${noteBlockHtml(note)}
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );
  return { subject, text, html };
}

/** Host accepts/declines a guest's request to attend a specific dinner. */
export function buildAttendeeDecisionEmail(
  approved: boolean,
  name: string | null | undefined,
  dinnerLabel: string
): EmailContent {
  const greeting = displayName(name);
  const label = dinnerLabel.trim() || "an upcoming dinner";
  if (approved) {
    const subject = "Supper Collective — your seat is approved";
    const text = [
      `Hi ${greeting},`,
      "",
      `The host has approved your request to attend ${label}.`,
      "",
      "Log in to complete your profile (if needed) and pay to secure your seat.",
      "",
      "— Supper Collective",
    ].join("\n");
    const html = emailShell(
      "Seat approved",
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
       <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">The host has approved your request to attend <strong>${escapeHtml(label)}</strong>.</p>
       <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Log in to complete your profile (if needed) and pay to secure your seat.</p>
       <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
    );
    return { subject, text, html };
  }

  const subject = "Supper Collective — update on your seat request";
  const text = [
    `Hi ${greeting},`,
    "",
    `Unfortunately the host wasn't able to offer you a seat at ${label} this time.`,
    "",
    "Keep an eye out for other dinners — we'd love to see you at the table.",
    "",
    "— Supper Collective",
  ].join("\n");
  const html = emailShell(
    "Seat request update",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Unfortunately the host wasn't able to offer you a seat at <strong>${escapeHtml(label)}</strong> this time.</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Keep an eye out for other dinners — we'd love to see you at the table.</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );
  return { subject, text, html };
}

/** Meal-first signup: prompt to create password via Identity invite. */
export function buildCreatePasswordEmail(name: string | null | undefined): EmailContent {
  const greeting = displayName(name);
  const subject = "Supper Collective — create your password to request a seat";
  const text = [
    `Hi ${greeting},`,
    "",
    "Thanks for requesting a seat at an upcoming Supper Collective dinner.",
    "",
    "Watch for a separate invitation email from Netlify Identity with your secure signup link.",
    "Once you set your password and log in, you'll be waitlisted until the host approves your request.",
    "",
    "— Supper Collective",
  ].join("\n");
  const html = emailShell(
    "Create your password",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Thanks for requesting a seat. Watch for a separate invitation email with your secure signup link.</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Once you log in, you'll be waitlisted until the host approves your request.</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );
  return { subject, text, html };
}

export function buildT14WarningEmail(hostName: string | null | undefined, paidCount: number): EmailContent {
  const greeting = displayName(hostName);
  const subject = "Supper Collective — fill warning (T−14)";
  const text = [
    `Hi ${greeting},`,
    "",
    `Your upcoming dinner has ${paidCount} paid seats at the T−14 check.`,
    paidCount <= 8
      ? "You're at or below the minimum — consider subsidizing via the platform to reach a 10-seat pot, or request cancellation."
      : "You're on track.",
    "",
    "— Supper Collective",
  ].join("\n");
  const html = emailShell(
    "T−14 fill check",
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#f5f0e8;">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">Your dinner has <strong>${paidCount}</strong> paid seats at T−14.</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#e8e0d4;">${
       paidCount <= 8
         ? "Consider subsidizing to reach 10 seats, or request cancellation in your host workspace."
         : "You're on track."
     }</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#c9a962;">— Supper Collective</p>`
  );
  return { subject, text, html };
}
