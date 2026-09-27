function configuredEmails(): Set<string> {
  const raw = process.env.AI_SECRETARY_BETA_EMAILS ?? "";
  return new Set(
    raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
  );
}

export function isBetaTester(email: string | undefined): boolean {
  if (!email) return false;
  return configuredEmails().has(email.trim().toLowerCase());
}

export function betaStatus(email: string | undefined) {
  const active = isBetaTester(email);
  return { active, source: active ? "beta" : "subscription" } as const;
}
