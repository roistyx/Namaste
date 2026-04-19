import cron from 'node-cron';
import { config } from '../config/env.js';
import { createLogger } from '../logger.js';

const log = createLogger('trainer');

export function startTrainerJob() {
  cron.schedule(config.trainerCron, async () => {
    const timer = log.start('Training models…');
    // TODO: pull outcomes, train Prophet, store model in modelRegistryDao
    timer.done('0 trained, 0 pending, 0 failed');
  });

  log.log(`Scheduled: ${config.trainerCron}`);
}
