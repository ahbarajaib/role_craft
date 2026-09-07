import * as Sentry from "@sentry/browser";

let isSentryInitialized = false;

/**
 * Initialize client-side Sentry error tracking if NEXT_PUBLIC_SENTRY_DSN is configured.
 * Operates gracefully as a no-op if DSN is not provided.
 */
export function initSentry(): void {
  if (typeof window === "undefined" || isSentryInitialized) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
    });

    (window as any).Sentry = Sentry;
    isSentryInitialized = true;
    if (process.env.NODE_ENV === "development") {
      console.log("🛡️ [Sentry] Client crash reporting initialized.");
    }
  } catch (err) {
    console.warn("[Sentry] Failed to initialize client Sentry:", err);
  }
}

export { Sentry };
