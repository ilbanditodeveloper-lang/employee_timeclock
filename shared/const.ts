export const COOKIE_NAME = "app_session_id";

/** Session lifetime — aligned with JWT expiration (7 days). */
export const SESSION_MAX_AGE_DAYS = 7;
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/** @deprecated Use SESSION_MAX_AGE_MS for session cookies. */
export const ONE_YEAR_MS = SESSION_MAX_AGE_MS;

export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/** Bump when employee privacy notice text changes materially. */
export const EMPLOYEE_PRIVACY_NOTICE_VERSION = "2026-06-22-v2";
export const PLATFORM_TERMS_VERSION = "2026-06-22";

/** Bump when legal template texts (privacy/terms/DPA) change materially. */
export const LEGAL_TEMPLATES_VERSION = "2026-06";

/** Shown when registerBusiness hits unique email constraint (PostgreSQL 23505). */
export const DUPLICATE_ADMIN_EMAIL_MSG =
  "Ya existe una cuenta de administrador con ese email. Inicia sesión o usa otro email.";

export const GENERIC_AUTH_FAILURE_MSG = "Credenciales inválidas";

export const RATE_LIMIT_MSG = "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";

export const GENERIC_SERVER_ERROR_MSG = "Ha ocurrido un error. Inténtalo de nuevo más tarde.";
