// dotenv is loaded by the main server/index.js — no need to reload it here.
function get(key, def) {
  const val = process.env[key];
  return (val === undefined || val === '') ? def : val;
}

export const config = {
  discordWebhookUrl:  process.env.DISCORD_WEBHOOK_URL || '',
  volSpikeRatio:      parseFloat(get('VOL_SPIKE_RATIO', '2.0')),
  priceMovePct:       parseFloat(get('PRICE_MOVE_PCT', '3.0')),
  alertCooldownHours: parseFloat(get('ALERT_COOLDOWN_HOURS', '2')),
  pollCron:           get('POLL_CRON',    '*/10 * * * *'),
  ohlcvCron:          get('OHLCV_CRON',   '15 16 * * 1-5'),
  outcomeCron:        get('OUTCOME_CRON', '0 * * * *'),
  trainerCron:        get('TRAINER_CRON', '0 2 * * 1-5'),
};
