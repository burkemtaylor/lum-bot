const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_DESTINATION = process.env.ALERT_DESTINATION;

export async function sendErrorAlert(error: Error, context?: string): Promise<void> {
  if (!RESEND_API_KEY || !ALERT_DESTINATION) {
    console.error("[notify] Missing RESEND_API_KEY or ALERT_EMAIL, skipping email");
    return;
  }

  const subject = `🚨 Lum Bot Error: ${error.message.slice(0, 50)}`;
  const body = `
    <h2>Bot Error Alert</h2>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Context:</strong> ${context || "Unknown"}</p>
    <p><strong>Error:</strong> ${error.message}</p>
    <pre>${error.stack}</pre>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lum Bot <alerts@burketaylor.com>", // see note below
        to: [ALERT_DESTINATION],
        subject,
        html: body,
      }),
    });

    if (!res.ok) {
      console.error("[notify] Failed to send alert:", await res.text());
    }
  } catch (e) {
    console.error("[notify] Error sending alert:", e);
  }
}
