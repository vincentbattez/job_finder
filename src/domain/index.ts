import { z } from 'zod/v4';

// The domain types: past the anti-corruption layers, the code only handles these (ADR-0005).
// Every schema ends with .brand<'Domain'>(): only a value parsed by a domain schema carries the
// brand, so a database row or an API response cannot pass for a domain value. z.object drops the
// fields the domain does not know.
export const CANDIDAT_SCHEMA = z.object({ id: z.string(), name: z.string() }).brand<'Domain'>();

export type Candidat = z.infer<typeof CANDIDAT_SCHEMA>;

export type DomainValue = z.$brand<'Domain'>;
