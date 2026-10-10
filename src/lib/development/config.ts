/** Login is deferred only in local development. Hosted builds always require identity. */
export function developmentWorkspace() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.CRM_DEFER_AUTH !== "false"
  );
}
export const developmentAdminId = "a1000000-0000-4000-8000-000000000001";
