/** One switch for deterministic business-date testing. Set APP_SIMULATED_DATE=2026-09-30 for QA. */
export function appDate(): Date {
  const simulated = process.env.APP_SIMULATED_DATE;
  if (process.env.NODE_ENV !== "production" && simulated && /^\d{4}-\d{2}-\d{2}$/.test(simulated)) {
    return new Date(`${simulated}T12:00:00.000Z`);
  }
  return new Date();
}
