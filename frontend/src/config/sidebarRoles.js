// Roles that use the FPT "Stitch" portal design (deep blue sidebar, FPT logo
// brand, Material Symbols icons, logout pinned at the bottom). Shared here so
// every component that needs to branch on it (sidebar, shell, header,
// dropdowns...) imports one source of truth instead of redeclaring the role
// list in each file.
export const STITCH_ROLES = [
  "HOMEROOM_TEACHER",
  "SUBJECT_TEACHER",
  "DORM_SUPERVISOR",
  "PARENT",
  "ADMIN",
];

export function isStitchUser(user) {
  return Boolean(user?.roles?.some((r) => STITCH_ROLES.includes(r.roleName)));
}