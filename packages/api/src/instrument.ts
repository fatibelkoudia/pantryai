import * as Sentry from '@sentry/node';

// Sentry has to be initialized before anything else loads, so this file is
// imported on the very first line of main.ts and worker.ts.
//
// It's a no-op when SENTRY_DSN isn't set, which is the case for local and dev
// runs, so nothing leaves the machine there.
//
// RGPD: we never want user PII (emails, names, food data) in an error report, so
// beforeSend strips anything that could carry it before the event is sent.
const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    // Keep tracing light so we stay inside the free tier.
    tracesSampleRate: 0.1,
    // Don't let Sentry attach request bodies, cookies, or query strings.
    sendDefaultPii: false,
    beforeSend(event) {
      // Drop the user object entirely (it can hold email/id).
      delete event.user;

      // Scrub request payloads in case anything slipped through.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }

      return event;
    },
  });
}

export { Sentry };
