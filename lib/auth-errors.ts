import { AuthError } from "@netlify/identity";

/** User-facing messages for Netlify Identity auth errors. */
export function formatAuthError(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.status === 404 || /not found/i.test(error.message)) {
      return "Identity is unavailable on this server. Use npx netlify dev, or restart npm run dev after setting NEXT_PUBLIC_NETLIFY_IDENTITY_URL.";
    }
    if (error.status === 401 || error.status === 400) {
      return "Invalid email or password.";
    }
    if (error.status === 422) {
      return "Please check your email and password.";
    }
    if (error.status === 403) {
      return "Access denied. Contact support if you believe this is a mistake.";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
