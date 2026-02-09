import { createZodDto } from 'nestjs-zod';
import { SigninSchema } from '../schemas/signin.schema';

export class SigninDto extends createZodDto(SigninSchema) {}
