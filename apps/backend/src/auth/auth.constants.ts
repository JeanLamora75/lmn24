export const DEFAULT_SESSION_COOKIE_NAME = "lmn24_session";
export const DEFAULT_SESSION_TTL_HOURS = 8;

export const LOGIN_RATE_LIMIT = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
} as const;

export const AUTH_FAILURE_MESSAGE = "Email ou mot de passe incorrect.";
