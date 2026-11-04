import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Startup security audit. Collects misconfigurations that weaken the deployed
 * service and logs them plainly; when `securityStrict` is on (default in
 * production) any `error`-level finding aborts boot rather than serving an
 * insecure configuration.
 */

export interface SecurityIssue {
  level: "warn" | "error";
  message: string;
}

const DEFAULT_DEMO_PASSWORD = "password123";

function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function collectSecurityIssues(): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const prod = config.nodeEnv === "production";
  const jwtSecret = envValue("JWT_SECRET");

  if (!jwtSecret) {
    issues.push({
      level: prod ? "error" : "warn",
      message: prod
        ? "JWT_SECRET is not set. In production a random secret is generated per boot, signing out every user on restart."
        : `JWT_SECRET is not set; using the built-in development secret.`,
    });
  } else if (jwtSecret.length < 32) {
    issues.push({
      level: prod ? "error" : "warn",
      message: "JWT_SECRET is shorter than 32 characters; use a long random value.",
    });
  }

  if (config.authEnabled && config.defaultUserPassword === DEFAULT_DEMO_PASSWORD) {
    issues.push({
      level: prod ? "error" : "warn",
      message: "The default demo password is unchanged. Set DEFAULT_USER_PASSWORD before exposing the service.",
    });
  }

  if (prod && config.apiKeys.length === 0) {
    issues.push({
      level: "warn",
      message: "API_KEYS is unset; only user authentication protects the API. Set API_KEYS for defence in depth.",
    });
  }

  if (prod) {
    const riskyOrigins = config.allowedOrigins.filter((o) => o === "*" || o.includes("localhost") || o.includes("127.0.0.1"));
    if (riskyOrigins.length > 0) {
      issues.push({
        level: "warn",
        message: `FRONTEND_ORIGINS contains non-production origins: ${riskyOrigins.join(", ")}.`,
      });
    }
    if (!config.requireHttps) {
      issues.push({ level: "warn", message: "REQUIRE_HTTPS is not enabled; cookies are not marked Secure without TLS." });
    }
    if (!config.securityHeadersEnabled) {
      issues.push({ level: "warn", message: "Security response headers are disabled." });
    }
  }

  if (!config.authEnabled) {
    issues.push({
      level: prod ? "error" : "warn",
      message: "AUTH_ENABLED=false — processing endpoints are open to anyone who can reach the API.",
    });
  }

  return issues;
}

export function auditSecurityConfig(): void {
  const issues = collectSecurityIssues();
  for (const issue of issues) {
    if (issue.level === "error") logger.error(`Security: ${issue.message}`);
    else logger.warn(`Security: ${issue.message}`);
  }

  const fatal = issues.filter((i) => i.level === "error");
  if (config.securityStrict && fatal.length > 0) {
    throw new Error(
      `Refusing to start with ${fatal.length} insecure configuration error(s). Fix them or set SECURITY_STRICT=false.`,
    );
  }
}
