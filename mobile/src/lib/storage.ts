import * as SecureStore from "expo-secure-store";

/**
 * Server URL and session token persistence.
 *
 * SecureStore is the iOS keychain / Android keystore, so the session token is
 * never written to plain AsyncStorage. Keys are namespaced per server so that
 * switching machines does not reuse a token issued by a different backend.
 */

const SERVER_KEY = "pictools.serverUrl";
const tokenKeyFor = (baseUrl: string) => `pictools.token.${baseUrl}`;

export async function loadServerUrl(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SERVER_KEY);
  } catch {
    return null;
  }
}

export async function saveServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_KEY, normaliseServerUrl(url));
}

export async function loadToken(baseUrl: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(tokenKeyFor(baseUrl));
  } catch {
    return null;
  }
}

export async function saveToken(baseUrl: string, token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(tokenKeyFor(baseUrl), token);
  } catch {
    // SecureStore rejects values containing characters outside its allowed set
    // on older Android versions. A base64url session token is always safe, but
    // degrade to an in-memory session rather than crashing the app.
  }
}

export async function clearToken(baseUrl: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(tokenKeyFor(baseUrl));
  } catch {
    // Ignore: the token is gone for this session either way.
  }
}

/** Trim whitespace and drop trailing slashes so paths can be appended safely. */
export function normaliseServerUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

/**
 * Accepts "192.168.1.5", "192.168.1.5:4000" or a full URL and returns a
 * complete origin. Defaults to port 4000, which is the backend's default.
 */
export function toServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter your computer's address.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  if (!url.port) url.port = "4000";
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http:// and https:// are supported.");
  return normaliseServerUrl(url.toString());
}
