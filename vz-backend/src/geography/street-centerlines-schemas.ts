import { z } from 'zod';

export const getStreetCenterlinesSchema = z.object({
  fullStreetName: z.string().trim(),
  crossStreet1: z.string().trim(),
  crossStreet2: z.string().trim(),
});

export type GetStreetCenterlinesParams = z.infer<typeof getStreetCenterlinesSchema>;
