import { config } from "../config.js";
import { AppError } from "../utils/errors.js";

/**
 * Password policy for registration. Deliberately lightweight (no dictionary of
 * millions) but blocks the passwords that dominate credential-stuffing and
 * password-spray traffic, plus the obvious "email as password" case.
 */
const COMMON_PASSWORDS = new Set<string>([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "12345",
  "111111",
  "000000",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "abc123",
  "letmein",
  "welcome",
  "welcome1",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "admin",
  "admin123",
  "administrator",
  "root",
  "guest",
  "user",
  "test",
  "test123",
  "test1234",
  "changeme",
  "secret",
  "master",
  "shadow",
  "superman",
  "trustno1",
  "photo",
  "pictools",
]);

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

/** Pure policy evaluation — shared by the route and its tests. */
export function checkPassword(password: unknown, email?: string): PasswordCheck {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, message: "A password is required." };
  }
  if (password.length < config.passwordMinLength) {
    return { ok: false, message: `Your password must be at least ${config.passwordMinLength} characters.` };
  }
  if (password.length > config.passwordMaxLength) {
    return { ok: false, message: `Your password must be at most ${config.passwordMaxLength} characters.` };
  }

  const lower = password.toLowerCase();
  if (config.passwordBlocklistEnabled && COMMON_PASSWORDS.has(lower)) {
    return { ok: false, message: "That password is too common. Please choose something less predictable." };
  }

  if (email) {
    const local = email.split("@")[0]?.trim().toLowerCase();
    if (local && local.length >= 3 && lower.includes(local)) {
      return { ok: false, message: "Your password must not contain your email address." };
    }
  }

  if (config.passwordRequireComplexity) {
    const hasLetter = /[a-z]/i.test(password);
    const hasDigit = /\d/.test(password);
    if (!hasLetter || !hasDigit) {
      return { ok: false, message: "Your password must include at least one letter and one number." };
    }
  }

  return { ok: true };
}

/** Throwing wrapper used by the auth routes. */
export function assertStrongPassword(password: unknown, email?: string): asserts password is string {
  const result = checkPassword(password, email);
  if (!result.ok) {
    throw new AppError(400, result.message ?? "Your password does not meet the security requirements.");
  }
}
