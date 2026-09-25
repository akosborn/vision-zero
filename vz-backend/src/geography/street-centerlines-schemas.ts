import { z } from 'zod';

export const getStreetCenterlinesSchema = z.object({
  fullStreetName: z.string().trim(),
  crossStreet1: z.string().trim(),
  crossStreet2: z.string().trim(),
  bufferInFeet: z.number().optional().default(0),
});

export type GetStreetCenterlinesParams = z.infer<typeof getStreetCenterlinesSchema>;
