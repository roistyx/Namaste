// ANSI codes
const R    = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM  = '\x1b[2m';

const COLORS = {
  poll:    '\x1b[36m',   // cyan
  ohlcv:   '\x1b[32m',   // green
  trainer: '\x1b[35m',   // magenta
  outcome: '\x1b[33m',   // yellow
  alert:   '\x1b[33m',   // yellow
  sync:    '\x1b[90m',   // dark gray
};

const PAD = 13; // '[VA:trainer]'.length + 1 space = 13

function ts() {
  return new Date().toLocaleTimeString('en-US', {
    hour12:  false,
    hour:    '2-digit',
    minute:  '2-digit',
    second:  '2-digit',
  });
}

function line(color, tag, msg) {
  const prefix = `${color}${BOLD}${tag.padEnd(PAD)}${R}`;
  const time   = `${DIM}${ts()}${R}`;
  console.log(`${prefix}${time}  ${msg}`);
}

/**
 * Returns a logger for a specific job label.
 *
 * Usage:
 *   const log = createLogger('poll');
 *   const t   = log.start('Polling 200 tickers…');
 *   t.done('200 ok, 0 failed, 2 alerts fired');
 *   // → [VA:poll]    HH:MM:SS  Done — 200 ok, 0 failed, 2 alerts fired (41s)
 */
export function createLogger(job) {
  const tag   = `[VA:${job}]`;
  const color = COLORS[job] ?? '';

  return {
    /** Single log line. */
    log(msg) {
      line(color, tag, msg);
    },

    /**
     * Logs the opening message and returns a timer object.
     * Call timer.done(summary) to log the closing line with elapsed seconds.
     */
    start(msg) {
      line(color, tag, msg);
      const t0 = Date.now();
      return {
        done(summary) {
          const elapsed = Math.round((Date.now() - t0) / 1000);
          line(color, tag, `Done — ${summary} (${elapsed}s)`);
        },
      };
    },
  };
}

/** Format a volume number as 18.2M / 7.6K etc. */
export function fmtVol(v) {
  if (v == null) return '?';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}
