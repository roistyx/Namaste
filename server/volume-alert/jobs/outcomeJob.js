import cron from 'node-cron';
import { config } from '../config/env.js';
import { resolveOutcomes } from '../services/outcomeService.js';
import { createLogger } from '../logger.js';

const log = createLogger('outcome');

export function startOutcomeJob() {
  cron.schedule(config.outcomeCron, async () => {
    const timer  = log.start('Checking open alerts…');
    const logged = await resolveOutcomes();
    timer.done(`${logged} outcomes logged`);
  });

  log.log(`Scheduled: ${config.outcomeCron}`);
}
