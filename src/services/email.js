import { predictProcrastinationRisk } from "../utils/localML";

/**
 * Encodes a MIME message to Base64URL format compliant with the Gmail API.
 */
function buildRawMimeEmail(to, subject, htmlBody) {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `From: me`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    htmlBody
  ];
  
  const rawEmail = emailLines.join("\r\n");
  
  // Safe Base64URL encoding
  return btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Dispatches an email request to the Gmail API using the user's Google OAuth Token.
 */
export async function sendEmailNotification(subject, htmlBody) {
  // Use the active Google OAuth token
  const token = localStorage.getItem("deadlineiq_google_oauth_token");
  const userEmail = localStorage.getItem("deadlineiq_user_email") || "me";

  if (!token) {
    console.warn("Google OAuth token is missing. Please log in or connect Google Calendar to enable automatic email notifications.");
    return false;
  }

  try {
    const rawMessage = buildRawMimeEmail(userEmail, subject, htmlBody);
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: rawMessage,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status} Error`);
    }

    return true;
  } catch (error) {
    console.error("Gmail API notification dispatch failed:", error);
    throw error;
  }
}

/**
 * Assesses procrastination risk on a task and triggers an alert if risk is moderate or high.
 */
export async function checkAndTriggerEmail(task, triggerContext = "creation") {
  if (task.status === "completed") return false;

  const riskScore = Math.round(predictProcrastinationRisk(task));
  if (riskScore < 40) {
    console.log(`Task "${task.title}" procrastination risk score is ${riskScore}%. Skipping alert.`);
    return false;
  }

  const riskLevel = riskScore > 70 ? "HIGH" : "MODERATE";
  const riskColor = riskScore > 70 ? "#EF4444" : "#F59E0B";

  const deadlineString = task.deadline
    ? (task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline)).toLocaleString()
    : "No deadline specified";

  const subtasksList = (task.subtasks || [])
    .map(s => `<li>${s.title} (${s.durationHours}h)</li>`)
    .join("");

  const subject = `⚠️ Procrastination Alert: ${riskLevel} Risk detected for "${task.title}"`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #FAFAFA;">
      <h2 style="color: #1E293B; margin-top: 0; font-size: 20px; font-weight: 800; border-bottom: 2px solid ${riskColor}; padding-bottom: 12px;">
        DeadlineIQ Predictive Telemetry
      </h2>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        Our client-side neural network has run analysis on a task update and predicted a <strong>${riskLevel} PROCRASTINATION RISK</strong>.
      </p>
      
      <div style="background-color: #FFFBEB; border-left: 4px solid ${riskColor}; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <h3 style="color: #78350F; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
          Telemetry Forecast Details
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px;">Task Title:</td>
            <td style="padding: 4px 0; color: #1E293B; font-weight: bold;">${task.title}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Risk Score:</td>
            <td style="padding: 4px 0; color: ${riskColor}; font-weight: bold;">${riskScore}%</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Priority Status:</td>
            <td style="padding: 4px 0; text-transform: uppercase;">${task.priority || "medium"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Deadline:</td>
            <td style="padding: 4px 0;">${deadlineString}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Effort Estimate:</td>
            <td style="padding: 4px 0;">${task.estimatedHours || 2}h effort</td>
          </tr>
        </table>
      </div>

      ${subtasksList ? `
        <h4 style="color: #1E293B; margin: 20px 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">
          AI Action Steps:
        </h4>
        <ul style="font-size: 13px; color: #475569; padding-left: 20px; line-height: 1.6;">
          ${subtasksList}
        </ul>
      ` : ""}

      <p style="font-size: 13px; color: #64748B; margin-top: 24px;">
        Trigger Context: Task ${triggerContext} • Local model weight iteration active.
      </p>
      
      <div style="margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 16px; text-align: center;">
        <a href="https://deadlineiq-6321f.web.app" style="display: inline-block; background-color: #6366F1; color: #FFFFFF; font-weight: bold; font-size: 12px; text-decoration: none; padding: 10px 20px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
          Open Live Workspace
        </a>
      </div>
    </div>
  `;

  return await sendEmailNotification(subject, htmlBody);
}
