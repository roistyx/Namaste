import { notify as terminalNotify } from './terminal.js';
import { notify as discordNotify } from './discord.js';

export async function notify(alert) {
  terminalNotify(alert);
  await discordNotify(alert);
}
