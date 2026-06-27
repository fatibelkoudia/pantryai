// Decides whether this process should run background work: the OCR queue
// processor and the scheduled cron jobs (R2 sweep, expiration push).
//
// We default to ON so a single-process run (local dev, tests, the single-process
// MVP) behaves exactly as before. In the split prod setup the API container sets
// RUN_OCR_WORKER=false to opt out, and the dedicated worker container runs them.
// This is what keeps a job (or a daily push) from firing twice when the API and
// the worker share one Redis.
export function runsBackgroundJobs(): boolean {
  return process.env['RUN_OCR_WORKER'] !== 'false';
}
