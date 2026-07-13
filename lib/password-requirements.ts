export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

const WEAK_PATTERNS = [
  "1234",
  "12345",
  "123456",
  "1234567",
  "12345678",
  "qwerty",
  "password",
  "abc123",
  "letmein",
  "welcome",
  "admin",
  "passw0rd",
  "iloveyou",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "football",
  "shadow",
];

const REQUIREMENT_DEFS = [
  { id: "length", label: "Use 8+ characters." },
  { id: "number", label: "Include at least one number." },
  { id: "special", label: "Include at least one special character (like !, @, #, or ?)." },
  {
    id: "weak",
    label: 'Do not use personal info or obvious patterns (like "1234" or "qwerty").',
  },
] as const;

export const PASSPHRASE_TIP =
  "For something easy to remember, combine 3 unrelated words into one passphrase.";

function hasWeakPattern(password: string): boolean {
  const lower = password.toLowerCase();
  return WEAK_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isRequirementMet(id: (typeof REQUIREMENT_DEFS)[number]["id"], password: string): boolean {
  switch (id) {
    case "length":
      return password.length >= 8;
    case "number":
      return /\d/.test(password);
    case "special":
      return /[!@#?]/.test(password);
    case "weak":
      return password.length > 0 && !hasWeakPattern(password);
    default:
      return false;
  }
}

export function getPasswordRequirementState(password: string): PasswordRequirement[] {
  return REQUIREMENT_DEFS.map(({ id, label }) => ({
    id,
    label,
    met: isRequirementMet(id, password),
  }));
}

export function allPasswordRequirementsMet(password: string): boolean {
  return getPasswordRequirementState(password).every((req) => req.met);
}
