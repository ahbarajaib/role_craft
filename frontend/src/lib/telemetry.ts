/**
 * Telemetry and Analytics Service for RoleCraft
 *
 * Provides a unified, type-safe interface for user tracking, conversion funnel milestones,
 * and error telemetry. Integrates with Microsoft Clarity (session replay & heatmaps)
 * and optionally Sentry (crash & exception reporting).
 *
 * All functions operate gracefully as no-ops if analytics services are unavailable or blocked.
 */

declare global {
  interface Window {
    clarity?: {
      (command: "identify", customId: string, customSessionId?: string, customPageId?: string, friendlyName?: string): void;
      (command: "set", key: string, value: string | string[]): void;
      (command: "event", eventName: string): void;
      (command: "upgrade", reason: string): void;
      (command: string, ...args: any[]): void;
      q?: any[];
      v?: string;
    };
    Sentry?: any;
  }
}

export interface TelemetryUser {
  id: number | string;
  email?: string | null;
  name?: string | null;
  plan_type?: string;
  credits?: number;
  provider?: string;
}

/**
 * Identify a user across analytics and session replay tools upon login/session restore.
 */
export function identifyUser(user: TelemetryUser): void {
  if (typeof window === "undefined") return;

  try {
    const userIdStr = String(user.id);
    const friendlyName = user.name || user.email || `User #${userIdStr}`;

    // 1. Microsoft Clarity User Identification
    if (typeof window.clarity === "function") {
      window.clarity("identify", userIdStr, undefined, undefined, friendlyName);
      if (user.plan_type) {
        window.clarity("set", "plan_type", user.plan_type);
      }
      if (user.provider) {
        window.clarity("set", "auth_provider", user.provider);
      }
      if (typeof user.credits === "number") {
        window.clarity("set", "credits_tier", user.credits > 0 ? "has_credits" : "zero_credits");
      }
    }

    // 2. Sentry User Context (if Sentry is initialized)
    if (window.Sentry?.setUser) {
      window.Sentry.setUser({
        id: userIdStr,
        email: user.email ?? undefined,
        username: user.name ?? undefined,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`📊 [Telemetry] Identified user: ${friendlyName} (${userIdStr})`);
    }
  } catch (err) {
    console.warn("[Telemetry] Error during identifyUser:", err);
  }
}

/**
 * Reset user identity tracking on logout.
 */
export function clearUserTracking(): void {
  if (typeof window === "undefined") return;

  try {
    if (window.Sentry?.setUser) {
      window.Sentry.setUser(null);
    }
    if (typeof window.clarity === "function") {
      window.clarity("set", "plan_type", "anonymous");
    }
    if (process.env.NODE_ENV === "development") {
      console.log("📊 [Telemetry] User tracking cleared.");
    }
  } catch (err) {
    console.warn("[Telemetry] Error during clearUserTracking:", err);
  }
}

/**
 * Track a milestone action or conversion event (e.g. resume_uploaded, tailor_started, resume_downloaded).
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  if (typeof window === "undefined") return;

  try {
    // 1. Microsoft Clarity Custom Event
    if (typeof window.clarity === "function") {
      window.clarity("event", eventName);

      if (properties) {
        Object.entries(properties).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            window.clarity!("set", `${eventName}_${key}`, String(val));
          }
        });
      }
    }

    // 2. Sentry Breadcrumb (gives context leading up to any crashes)
    if (window.Sentry?.addBreadcrumb) {
      window.Sentry.addBreadcrumb({
        category: "user_action",
        message: eventName,
        level: "info",
        data: properties,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`📊 [Telemetry] Event '${eventName}'`, properties || "");
    }
  } catch (err) {
    console.warn(`[Telemetry] Error tracking event '${eventName}':`, err);
  }
}

/**
 * Track user-facing errors (upload failures, AI timeouts, parser issues).
 * Tags the Clarity session so you can immediately filter sessions where errors occurred.
 */
export function trackError(
  errorTitle: string,
  error?: unknown,
  context?: Record<string, any>
): void {
  if (typeof window === "undefined") return;

  try {
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error || {});

    // Tag Microsoft Clarity session with error flag for 1-click filtering
    if (typeof window.clarity === "function") {
      window.clarity("event", "user_error_encountered");
      window.clarity("set", "has_error", "true");
      window.clarity("set", "last_error_title", errorTitle.slice(0, 64));
    }

    // Dispatch to Sentry if available
    if (window.Sentry?.captureException) {
      window.Sentry.captureException(
        error instanceof Error ? error : new Error(`${errorTitle}: ${errorMsg}`),
        {
          extra: { errorTitle, ...context },
        }
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.error(`🚨 [Telemetry] Error '${errorTitle}':`, error, context);
    }
  } catch (err) {
    console.warn("[Telemetry] Error during trackError:", err);
  }
}
