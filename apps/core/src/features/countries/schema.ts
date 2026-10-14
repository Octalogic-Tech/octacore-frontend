import { z } from 'zod';

// Only what the page uses. The service also sends `name` (the legacy UPPERCASE form), `status` and the
// created, updated and deleted dates; unknown keys are dropped, so they cannot break the page.
//
// The service's seed data (converted from the legacy dump) spells "no ISO3 code" as the text NULL for 13
// countries. It is turned into an empty string here, so the sentinel never reaches the screen or the search.
const noneIfNullText = (code: string) => (code.trim().toUpperCase() === 'NULL' ? '' : code);

export const countrySchema = z.object({
  id: z.number().int(),
  iso: z.string(),
  iso3: z.string().transform(noneIfNullText),
  nicename: z.string(),
  numcode: z.number().int(),
  phonecode: z.number().int(),
});

export const countriesSchema = z.array(countrySchema);

export type Country = z.infer<typeof countrySchema>;
