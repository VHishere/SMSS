// Roles that use the FPT "Stitch" portal design (deep blue sidebar, FPT logo
// brand, Material Symbols icons, logout pinned at the bottom). Shared here so
// every component that needs to branch on it (sidebar, shell, header,
// dropdowns...) imports one source of truth instead of redeclaring the role
// list in each file.
export const STITCH_ROLES = [
  "STAFF",
  "HOMEROOM_TEACHER",
  "SUBJECT_TEACHER",
  "DORM_SUPERVISOR",
  "PARENT",
  "ADMIN",
  "STUDENT",
];

export function isStitchUser(user) {
  return Boolean(
    user?.roles?.some((role) => {
      const roleName = typeof role === "string" ? role : role.roleName;
      return STITCH_ROLES.includes(roleName);
    }),
  );
}
