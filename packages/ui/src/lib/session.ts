export interface Session {
  login: string;
  token: string;
}

export interface KnownAccount {
  login: string;
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

export function getKnownAccounts(): KnownAccount[] {
  const raw = localStorage.getItem(KNOWN_ACCOUNTS_KEY);
  return raw ? (JSON.parse(raw) as KnownAccount[]) : [];
}

export function addKnownAccount(login: string): void {
  const logins = new Set(getKnownAccounts().map((entry) => entry.login));
  logins.add(login);

  const updated = Array.from(logins).map((login) => ({ login }));
  localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(updated));
}
