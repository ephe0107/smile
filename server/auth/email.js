/* ==========================================================
   Transactional email for sign-in codes.

   One function behind one provider, so swapping Resend for anything else
   touches this file only.
   ========================================================== */

const { config } = require("../config");

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function signInMessage(code, minutes) {
  const text = [
    "Here is your sign-in code for 20 to 32 Smile Check:",
    "",
    `    ${code}`,
    "",
    `It works once and expires in ${minutes} minutes.`,
    "",
    "If you did not ask to sign in, you can ignore this email. Nobody can",
    "get into your account without this code.",
  ].join("\n");

  return {
    subject: `${code} is your Smile Check sign-in code`,
    text,
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 480px; color: #1d2340;">
        <h2 style="margin: 0 0 16px;">Your sign-in code</h2>
        <p style="margin: 0 0 20px; color: #4a5173;">Enter this in the tab you left open:</p>
        <p style="font-size: 34px; font-weight: 700; letter-spacing: 6px; margin: 0 0 20px;">${code}</p>
        <p style="margin: 0 0 8px; color: #4a5173;">It works once and expires in ${minutes} minutes.</p>
        <p style="margin: 0; color: #767ca0; font-size: 13px;">
          If you did not ask to sign in, you can ignore this email.
        </p>
      </div>
    `,
  };
}

async function sendSignInCode(email, code, { ttlMs }) {
  const minutes = Math.round(ttlMs / 60000);
  const message = signInMessage(code, minutes);

  if (!config.mail.apiKey) {
    // Falling back to the log is fine locally and unacceptable in production:
    // it would mean codes are not actually delivered and anyone with log
    // access could sign in as anyone. Fail the request instead.
    if (config.isProduction) {
      throw new Error("Email is not configured: set RESEND_API_KEY.");
    }

    console.log(`\n  ── sign-in code for ${email}: ${code} (expires in ${minutes}m) ──\n`);
    return { delivered: true, transport: "console" };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.mail.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.mail.from,
      to: [email],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    // The body can echo the address; keep it out of the thrown message.
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  return { delivered: true, transport: "resend" };
}

module.exports = { sendSignInCode, signInMessage };
