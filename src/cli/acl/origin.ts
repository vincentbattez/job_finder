import { hostname } from 'node:os';

// The port the lpm service web serves the front on (.lpm.yml, mise run web)
const WEB_PORT = 5180;

// The address of the front on the LAN, which jf ical builds its links on unless --origin names another
// (ADR-0002): the machine's name, which Bonjour answers under .local
export function findDefaultOrigin(): string {
  const name = hostname();
  const host = name.includes('.') ? name : `${name}.local`;
  return `http://${host}:${String(WEB_PORT)}`;
}
