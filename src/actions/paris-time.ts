// The start of an Interview as a datetime-local field holds it, in Paris time, reached through the
// actions only (ADR-0003); without zod, so the front's bundle may import it
export { parisDateTimeOf } from '#/domain/paris-time.ts';
