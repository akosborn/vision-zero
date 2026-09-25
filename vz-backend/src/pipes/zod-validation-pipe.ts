import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        (result.error as z.ZodError).issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      );
    }

    return result.data;
  }
}
