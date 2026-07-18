export interface Session {
  login: string;
  token: string;
}

const SESSION_KEY = "session";
const KNOWN_ACCOUNTS_KEY = "knownAccounts";

export function getSession(): Session | undefined {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : undefined;
}

export function setSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function addKnownAccount(login: string): void {
  const raw = localStorage.getItem(KNOWN_ACCOUNTS_KEY);
  const stored: { login: string }[] = raw ? JSON.parse(raw) : [];

  const logins = new Set(stored.map((entry) => entry.login));
  logins.add(login);

  const updated = Array.from(logins).map((login) => ({ login }));
  localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(updated));
}
