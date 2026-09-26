import { z } from 'zod';

export const getStreetCenterlinesSchema = z.object({
  fullStreetName: z.string().trim(),
  crossStreet1: z.string().trim(),
  crossStreet2: z.string().trim(),
});

export type GetStreetCenterlinesParams = z.infer<typeof getStreetCenterlinesSchema>;

export const getBufferedStreetSchema = getStreetCenterlinesSchema.extend({
  bufferInFeet: z.coerce.number().optional().default(0),
});

export type GetBufferedStreetParams = z.infer<typeof getBufferedStreetSchema>;
