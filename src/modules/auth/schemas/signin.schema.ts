import { z } from 'zod';

export const SigninSchema = z.object({
  username: z.string().min(3, 'Username must have at least 3 characters'),

  password: z
    .string()
    .min(2, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
});

export type SigninSchemaType = z.infer<typeof SigninSchema>;
