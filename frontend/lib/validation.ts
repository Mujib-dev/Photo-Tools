/**
 * Centralized Validation & Regular Expression Engine for PicTools
 *
 * Implements strict, industry-standard Regular Expressions for:
 * - Anti-Query & Anti-Injection Protection (SQL Injection, XSS Script Injection, Path Traversal)
 * - RFC 5322 Compliant Email Validation
 * - NIST / OWASP Password Strength & Complexity Evaluation
 * - International E.164 Phone & WhatsApp Numbers
 * - Unicode Multi-Language Human Names
 * - Valid Web URLs & Protocols
 * - Numeric Dimensions, DPI & Aspect Ratios
 * - Hexadecimal Color Codes
 * - Safe System Filenames
 */

// 1. Core Regular Expressions
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
export const PHONE_FORMATTED_REGEX = /^\+?[\d\s().-]{7,20}$/;

export const FULL_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}' .–-]{1,99}$/u;

export const URL_REGEX =
  /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)$/i;

export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const DIMENSION_REGEX = /^\d+(\.\d{1,2})?$/;
export const INTEGER_ONLY_REGEX = /^\d+$/;

export const FILENAME_SAFE_REGEX = /^[^<>:"/\\|?*\x00-\x1F]+$/;

// Common vulnerable passwords blocklist
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "welcome1",
  "admin123",
  "letmein",
]);

// 2. Anti-Query & Anti-Injection Protection Patterns
const SQL_INJECTION_PATTERNS = [
  /\b(UNION\s+SELECT|SELECT\s+.*?\s+FROM|INSERT\s+INTO|DROP\s+(?:TABLE|DATABASE)|DELETE\s+FROM|UPDATE\s+.*?\s+SET|ALTER\s+TABLE)\b/i,
  /(?:'|--|\bOR\b|\bAND\b)\s*['"]?\s*\d+\s*=\s*\d+/i,
  /(?:'|--|\bOR\b|\bAND\b)\s*['"]?[a-zA-Z]+['"]?\s*=\s*['"]?[a-zA-Z]+/i,
  /\b(EXEC|EXECUTE)\s*\(/i,
  /;\s*--/,
  /\/\*[\s\S]*?\*\//,
  /\bxp_\w+/i,
];

const XSS_SCRIPT_PATTERNS = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /data:text\/html/i,
  /vbscript\s*:/i,
  /on(error|load|click|mouseover|focus|blur|change|submit)\s*=/i,
  /<iframe/i,
  /<svg.*?onload/i,
  /<img.*?onerror/i,
  /eval\s*\(/i,
];

const SYSTEM_TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/,
  /(?:\/etc\/passwd|c:\\windows|cmd\.exe|powershell\.exe)/i,
  /;\s*(?:rm\s+-rf|del\s+\/|chmod|curl\s+.*?\||wget)/i,
];

/**
 * Checks whether an input contains malicious query injections (SQL, XSS, Path Traversal)
 */
export function hasQueryInjection(input: string): boolean {
  if (typeof input !== "string" || !input) return false;
  return (
    SQL_INJECTION_PATTERNS.some((p) => p.test(input)) ||
    XSS_SCRIPT_PATTERNS.some((p) => p.test(input)) ||
    SYSTEM_TRAVERSAL_PATTERNS.some((p) => p.test(input))
  );
}

/**
 * Sanitizes input string by stripping dangerous HTML, SQL and script query characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "") // strip HTML brackets
    .replace(/javascript:/gi, "") // strip inline javascript protocol
    .replace(/['"`;]/g, "") // strip quotes and semicolons
    .replace(/--/g, "") // strip SQL comment tokens
    .trim();
}

// 3. High-Level Field Validators

export interface ValidationResult {
  isValid: boolean;
  valid?: boolean;
  error?: string;
}

export interface PasswordStrengthResult extends ValidationResult {
  score: number; // 0 to 4 (0 = very weak, 4 = very strong)
  label: "Too Weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  checks: {
    minLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    notCommon: boolean;
    notEmail: boolean;
  };
}

/**
 * Validates email with RFC 5322 regex, anti-query checking, and length limits
 */
export function validateEmail(email: string): ValidationResult {
  const clean = email.trim();
  if (!clean) {
    return { isValid: false, error: "Email address is required." };
  }
  if (hasQueryInjection(clean)) {
    return { isValid: false, error: "Email contains invalid or unsafe query characters." };
  }
  if (clean.length > 254) {
    return { isValid: false, error: "Email address cannot exceed 254 characters." };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { isValid: false, error: "Please enter a valid email address (e.g. name@company.com)." };
  }
  return { isValid: true };
}

/**
 * Validates password with NIST / OWASP complexity rules and regex patterns
 */
export function validatePassword(password: string, emailContext?: string): PasswordStrengthResult {
  const p = password;
  const minLength = p.length >= 8;
  const hasLower = /[a-z]/.test(p);
  const hasUpper = /[A-Z]/.test(p);
  const hasNumber = /\d/.test(p);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);
  const notCommon = !COMMON_PASSWORDS.has(p.toLowerCase());

  let notEmail = true;
  if (emailContext && emailContext.includes("@")) {
    const localPart = emailContext.split("@")[0].trim().toLowerCase();
    if (localPart.length >= 3 && p.toLowerCase().includes(localPart)) {
      notEmail = false;
    }
  }

  // Calculate score (0-4)
  let score = 0;
  if (minLength) score++;
  if (hasLower && hasUpper) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;
  if (p.length >= 12 && hasSpecial && hasNumber) score = 4;
  if (!notCommon || !notEmail) score = Math.min(1, score);

  const labels: PasswordStrengthResult["label"][] = [
    "Too Weak",
    "Weak",
    "Fair",
    "Strong",
    "Excellent",
  ];
  const label = labels[score];

  const checks = {
    minLength,
    hasLower,
    hasUpper,
    hasNumber,
    hasSpecial,
    notCommon,
    notEmail,
  };

  if (!p) {
    return { isValid: false, score: 0, label: "Too Weak", checks, error: "Password is required." };
  }
  if (!minLength) {
    return {
      isValid: false,
      score,
      label,
      checks,
      error: "Password must be at least 8 characters.",
    };
  }
  if (!hasLower || !hasUpper) {
    return {
      isValid: false,
      score,
      label,
      checks,
      error: "Password must include both uppercase and lowercase letters.",
    };
  }
  if (!hasNumber) {
    return {
      isValid: false,
      score,
      label,
      checks,
      error: "Password must include at least one number (0-9).",
    };
  }
  if (!notCommon) {
    return {
      isValid: false,
      score,
      label,
      checks,
      error: "This password is too common and easily guessed.",
    };
  }
  if (!notEmail) {
    return {
      isValid: false,
      score,
      label,
      checks,
      error: "Password must not contain parts of your email address.",
    };
  }

  return { isValid: true, score, label, checks };
}

/**
 * Validates international phone numbers and blocks query injections
 */
export function validatePhone(phone: string): ValidationResult {
  const clean = phone.trim();
  if (!clean) {
    return { isValid: false, error: "Phone number is required." };
  }
  if (hasQueryInjection(clean)) {
    return { isValid: false, error: "Phone number contains invalid query characters." };
  }
  if (!PHONE_FORMATTED_REGEX.test(clean)) {
    return {
      isValid: false,
      error: "Enter a valid phone number (e.g. +1 555-0199 or 7-15 digits).",
    };
  }
  const digits = clean.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      error: "Phone number must contain between 7 and 15 digits.",
    };
  }
  return { isValid: true };
}

/**
 * Validates personal full name and prevents script/query injection
 */
export function validateFullName(name: string): ValidationResult {
  const clean = name.trim();
  if (!clean) {
    return { isValid: false, error: "Full name is required." };
  }
  if (hasQueryInjection(clean)) {
    return { isValid: false, error: "Name contains invalid or unsafe query characters." };
  }
  if (clean.length < 2) {
    return { isValid: false, error: "Name must be at least 2 characters long." };
  }
  if (clean.length > 100) {
    return { isValid: false, error: "Name cannot exceed 100 characters." };
  }
  if (!FULL_NAME_REGEX.test(clean)) {
    return {
      isValid: false,
      error: "Name may only contain letters, spaces, hyphens, and apostrophes.",
    };
  }
  return { isValid: true };
}

/**
 * Validates Web URLs and blocks javascript/data query protocols
 */
export function validateUrl(url: string): ValidationResult {
  const clean = url.trim();
  if (!clean) {
    return { isValid: false, error: "URL is required." };
  }
  if (hasQueryInjection(clean)) {
    return { isValid: false, error: "URL contains unsafe query script injections." };
  }
  if (!URL_REGEX.test(clean)) {
    return { isValid: false, error: "Please enter a valid website URL starting with https:// or http://." };
  }
  return { isValid: true };
}

/**
 * Validates number dimension inputs, blocking non-numeric characters and query injection
 */
export function validateDimension(
  value: string | number,
  min = 1,
  max = 10000
): ValidationResult {
  const str = String(value).trim();
  if (!str) {
    return { isValid: false, error: "Dimension value is required." };
  }
  if (hasQueryInjection(str)) {
    return { isValid: false, error: "Dimension contains invalid query tokens." };
  }
  if (!DIMENSION_REGEX.test(str)) {
    return { isValid: false, error: "Must be a valid positive number (e.g. 1920 or 10.5)." };
  }
  const num = parseFloat(str);
  if (Number.isNaN(num) || num < min || num > max) {
    return { isValid: false, error: `Value must be between ${min} and ${max}.` };
  }
  return { isValid: true };
}

/**
 * Validates Hex Color string (e.g. #FFF or #2563EB)
 */
export function validateHexColor(color: string): ValidationResult {
  const clean = color.trim();
  if (!HEX_COLOR_REGEX.test(clean)) {
    return { isValid: false, error: "Enter a valid hex color code (e.g. #2563EB or #FFF)." };
  }
  return { isValid: true };
}

/**
 * Unwraps Google search redirects, video search results, and Google-routed links
 * to their real destination video URLs (YouTube, Vimeo, direct MP4, etc.)
 */
export function unwrapGoogleUrl(rawUrl: string): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // Match google.com, google.co.uk, share.google, goo.gl, etc.
    const isGoogleSearchHost =
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "share.google" ||
      host.endsWith(".google") ||
      host === "goo.gl" ||
      host.endsWith(".goo.gl") ||
      /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host);

    if (isGoogleSearchHost) {
      // 1. Google search redirect: /url?url=... or /url?q=...
      if (parsed.pathname === "/url") {
        const target = parsed.searchParams.get("url") || parsed.searchParams.get("q");
        if (target && /^https?:\/\//i.test(target)) {
          return target;
        }
      }

      // 2. Google images / video preview: /imgres?imgrefurl=... or imgurl=...
      if (parsed.pathname === "/imgres") {
        const imgUrl = parsed.searchParams.get("imgurl");
        const pageUrl = parsed.searchParams.get("imgrefurl");
        if (imgUrl && /\.(mp4|webm|mkv|mov|avi|ts|m3u8)(\?.*)?$/i.test(imgUrl)) {
          return imgUrl;
        }
        if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
          return pageUrl;
        }
        if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
          return imgUrl;
        }
      }

      // 3. Fallback: Any search param that is a full http(s) URL pointing outside google search
      for (const [, val] of parsed.searchParams.entries()) {
        if (/^https?:\/\/(?!([a-z0-9-]+\.)?google\.(?:com|[a-z]{2,3}))/i.test(val)) {
          return val;
        }
      }
    }
  } catch {
    // If not a parseable URL, return trimmed original
  }

  return trimmed;
}
