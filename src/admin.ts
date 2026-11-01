export function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.AI_SECRETARY_ADMIN_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
