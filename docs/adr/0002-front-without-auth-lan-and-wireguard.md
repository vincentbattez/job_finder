# Front without authentication, reachable only on the LAN and through WireGuard

The front has no authentication: the Candidate is picked from a menu, with no password. This choice only holds because the front is never exposed to the internet. It listens on the Mac mini's local network, and remote access goes through the existing WireGuard VPN. Exposing it, even behind a tunnel, would give anyone the Candidates' personal data and the ability to start Claude Code sessions on Vincent's subscription.

## Considered Options

- **A public tunnel protected by a shared password.** Rejected: it means writing and maintaining authentication code for a personal project with two users, while both already have VPN access.
