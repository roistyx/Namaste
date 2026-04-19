/**
 * Prophet worker stub.
 * In future: receives candle data, runs Python Prophet via child_process,
 * returns { trend, yhat, yhat_lower, yhat_upper } for next N periods.
 */
export async function run(data) {
  return null;
}
