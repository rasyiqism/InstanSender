const runtimeConfig = window.__APP_CONFIG__ ?? {}

export const appName =
  runtimeConfig.appName?.trim() ||
  import.meta.env.VITE_APP_NAME?.trim() ||
  "App"

// Agency self-registration page (/register-agency). When false the route is
// closed (redirects to /login) while the page code stays intact — flip to
// true (or set VITE_AGENCY_REGISTRATION=true) to reopen it.
export const agencyRegistrationEnabled =
  runtimeConfig.agencyRegistrationEnabled ??
  import.meta.env.VITE_AGENCY_REGISTRATION === "true"

// Base URL for the API. Precedence: runtime config (set at deploy time) →
// VITE_API_BASE_URL (.env) → "/api". The trailing slash is stripped so that
// `apiBaseUrl + "/api-keys"` never produces a double slash.
export const apiBaseUrl = (
  runtimeConfig.apiBaseUrl?.trim() ||
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "/api"
).replace(/\/+$/, "") || "/api"
