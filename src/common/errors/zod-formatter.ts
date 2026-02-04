//* src/common/errors/zod.formatter.ts

import type { ZodError } from 'zod';

// ===================================================================================
export const formatZodErrors = (error: ZodError) => {
  const flat = error.flatten((issue) => issue.message);

  const details: Record<string, string[]> = {};

  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((v) => typeof v === 'string');

  for (const key of Object.keys(flat.fieldErrors)) {
    if (isStringArray(flat.fieldErrors[key])) {
      details[key] = flat.fieldErrors[key].slice();
    }
  }

  if (isStringArray(flat.formErrors)) {
    details._form = flat.formErrors.slice();
  }

  return details;
};
