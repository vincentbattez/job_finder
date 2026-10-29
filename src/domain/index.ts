import { z } from 'zod/v4';

// The domain types: past the anti-corruption layers, the code only handles these (ADR-0005).
// z.object drops the fields the domain does not know, so a database row comes out as a plain
// domain value.
export const CANDIDAT_SCHEMA = z.object({ id: z.string(), name: z.string() });

export type Candidat = z.infer<typeof CANDIDAT_SCHEMA>;
