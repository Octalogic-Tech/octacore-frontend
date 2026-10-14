import { z } from 'zod';

export const technologySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().min(1, 'Description is required'),
  categoryId: z.number().int().nullable(),
});

export type TechnologyInput = z.infer<typeof technologySchema>;

/** What a save sends. `categoryId` is left out when the categories could not be loaded, so a PATCH keeps the link. */
export type TechnologyChanges = Omit<TechnologyInput, 'categoryId'> & { categoryId?: number | null };

// Only what the page uses. The service also sends `status`, the dates, `resourceLink` and `imageLink`; unknown
// keys are dropped. A technology saved without a description comes back with null, which the page treats as an
// empty one. The service embeds the whole category beside `categoryId`; only its name is kept, as `categoryName`
// (empty when there is no category, or when it was deleted since: then `category` is null and `categoryId`
// stays).
export const technologyRowSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().transform((text) => text ?? ''),
    categoryId: z.number().int().nullable(),
    category: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  })
  .transform(({ category, ...row }) => ({ ...row, categoryName: category?.name ?? '' }));

export const technologyRowsSchema = z.array(technologyRowSchema);
