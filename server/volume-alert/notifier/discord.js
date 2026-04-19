import { config } from '../config/env.js';

export async function notify(alert) {
  if (!config.discordWebhookUrl) return; // silent no-op until webhook URL is configured

  const payload = {
    content: `**[${alert.type?.toUpperCase()}] ${alert.ticker}** — ${alert.message}`,
  };

  try {
    await fetch(config.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[discord notifier] failed:', e.message);
  }
}
