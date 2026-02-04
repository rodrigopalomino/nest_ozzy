//* src/common/utils/prisma-query-builder.ts

import { BadRequestException } from '@nestjs/common';
import { QueryOptionsSchemaType } from '../schema/query-options.schema';

// ===================================================================================
export interface PrismaPaginationResult {
  take?: number;
  skip?: number;
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
}

// ===================================================================================
// export function buildPagination(
//   options?: QueryOptionsSchemaType,
// ): PrismaPaginationResult {
//   const page = options?.page ? Number(options.page) : undefined;
//   const limit = options?.limit ? Number(options.limit) : undefined;
//   // const sortBy = options?.sortBy ?? 'id';
//   const order = options?.order ?? 'asc';

//   const pagination: PrismaPaginationResult = {
//     orderBy: { [sortBy]: order },
//   };

//   if (limit !== undefined) {
//     pagination.take = limit;
//     pagination.skip = page ? (page - 1) * limit : 0;
//   }

//   return pagination;
// }

// ===================================================================================
export function buildPagination(
  options?: QueryOptionsSchemaType,
): PrismaPaginationResult {
  const page = options?.page ? Number(options.page) : undefined;
  const limit = options?.limit ? Number(options.limit) : undefined;

  const pagination: PrismaPaginationResult = {};

  // ✅ soportar string | string[]
  const sortBy = options?.sortBy;
  const order = options?.order;

  const sortByArr = Array.isArray(sortBy) ? sortBy : sortBy ? [sortBy] : [];
  const orderArr = Array.isArray(order) ? order : order ? [order] : [];

  if (sortByArr.length > 0) {
    pagination.orderBy = sortByArr.map((field, index) => ({
      [field]: orderArr[index] ?? orderArr[0],
    }));
  }

  if (limit !== undefined) {
    pagination.take = limit;
    pagination.skip = page ? (page - 1) * limit : 0;
  }

  return pagination;
}

// ===================================================================================
// export function buildFilters<T>(filters?: Record<string, unknown>): T {
//   if (!filters) return {} as T;

//   const parsed: Record<string, unknown> = {};

//   const numericRegex = /^-?\d+(\.\d+)?$/;

//   const toNumberIfNumeric = (val: string) =>
//     numericRegex.test(val) ? Number(val) : val;

//   const toArray = (val: string) =>
//     val.split(',').map((v) => toNumberIfNumeric(v.trim()));

//   for (const [key, value] of Object.entries(filters)) {
//     // Caso: filtros[campo][operador] = X
//     if (typeof value === 'object' && value !== null) {
//       const inner = value as Record<string, unknown>;
//       const parsedInner: Record<string, unknown> = {};

//       for (const [op, raw] of Object.entries(inner)) {
//         const strVal = String(raw);

//         if (op === 'in' || op === 'notIn') {
//           parsedInner[op] = toArray(strVal);
//           continue;
//         }

//         if (['gt', 'gte', 'lt', 'lte', 'equals'].includes(op)) {
//           parsedInner[op] = numericRegex.test(strVal) ? Number(strVal) : raw;
//           continue;
//         }

//         if (['contains', 'startsWith', 'endsWith'].includes(op)) {
//           parsedInner[op] = strVal;
//           continue;
//         }

//         parsedInner[op] = raw;
//       }

//       parsed[key] = parsedInner;
//       continue;
//     }

//     // Caso simple: filtros[campo] = "1" → 1
//     // if (typeof value === 'string' && numericRegex.test(value)) {
//     //   parsed[key] = Number(value);
//     //   continue;
//     // }

//     // Caso simple: filtros[campo] = "1,2,3"
//     if (typeof value === 'string' && value.includes(',')) {
//       parsed[key] = { in: toArray(value) };
//       continue;
//     }

//     // Caso simple: texto → contains
//     if (typeof value === 'string') {
//       parsed[key] = { contains: value };
//       continue;
//     }

//     parsed[key] = value;
//   }

//   return parsed as T;
// }
// ===================================================================================
export function buildFilters<T>(filters?: Record<string, unknown>): T {
  if (!filters) return {} as T;

  const parsed: Record<string, unknown> = {};

  const numericRegex = /^-?\d+(\.\d+)?$/;

  const toNumberIfNumeric = (val: string) =>
    numericRegex.test(val) ? Number(val) : val;

  const toArray = (val: string) =>
    val.split(',').map((v) => toNumberIfNumeric(v.trim()));

  // ✅ GLOBAL SEARCH (OR dinámico con keys del front)
  const globalValue =
    typeof filters.global === 'string' ? filters.global.trim() : '';

  const globalKeysRaw =
    typeof filters.globalKeys === 'string' ? filters.globalKeys.trim() : '';

  const globalKeys = globalKeysRaw
    ? globalKeysRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  parsed.OR = globalKeys.map((field) => {
    // ✅ soporta plan.c_nomcur
    const keys = field.split('.');

    // ✅ si no tiene ".", normal
    if (keys.length === 1) {
      return {
        [field]: { contains: globalValue },
      };
    }

    // ✅ construir objeto anidado
    let obj: Record<string, any> = {};
    let current = obj;

    keys.forEach((k, index) => {
      const isLast = index === keys.length - 1;

      if (isLast) {
        current[k] = { contains: globalValue };
      } else {
        current[k] = {};
        current = current[k];
      }
    });

    return obj;
  });

  for (const [key, value] of Object.entries(filters)) {
    // ✅ Evitar que global y globalKeys entren como filtros normales
    if (key === 'global' || key === 'globalKeys') continue;

    // Caso: filtros[campo][operador] = X
    if (typeof value === 'object' && value !== null) {
      const inner = value as Record<string, unknown>;
      const parsedInner: Record<string, unknown> = {};

      for (const [op, raw] of Object.entries(inner)) {
        // ✅ SOLO: si es string numérico => number
        if (typeof raw === 'string' && numericRegex.test(raw.trim())) {
          parsedInner[op] = Number(raw);
          continue;
        }

        parsedInner[op] = raw;
      }

      parsed[key] = parsedInner;
      continue;
    }

    // Caso simple: filtros[campo] = "1" → 1
    if (typeof value === 'string' && numericRegex.test(value)) {
      parsed[key] = Number(value);
      continue;
    }

    // Caso simple: filtros[campo] = "1,2,3"
    if (typeof value === 'string' && value.includes(',')) {
      parsed[key] = { in: toArray(value) };
      continue;
    }

    // Caso simple: texto → contains
    if (typeof value === 'string') {
      parsed[key] = { contains: value };
      continue;
    }

    parsed[key] = value;
  }
  if (Array.isArray(parsed.OR) && parsed.OR.length === 0) {
    delete parsed.OR;
  }

  return parsed as T;
}

// ===================================================================================
// export function buildInclude(
//   raw?: string[] | string,
//   allowed?: string[],
// ): Record<string, unknown> {
//   if (!raw) return {};

//   const includeList = Array.isArray(raw)
//     ? raw.flatMap((v) => v.split(','))
//     : String(raw).split(',');

//   const include: Record<string, unknown> = {};
//   const invalid: string[] = [];

//   includeList.forEach((item) => {
//     const key = item.trim();
//     if (!key) return;

//     if (allowed && !allowed.includes(key)) {
//       invalid.push(key);
//       return;
//     }

//     include[key] = true;
//   });

//   if (invalid.length > 0) {
//     throw new BadRequestException({
//       message: 'Parámetros de include inválidos.',
//       invalid,
//       allowed: allowed ?? null,
//     });
//   }

//   return include;
// }

type PrismaIncludeValue = true | PrismaIncludeObject;

interface PrismaIncludeObject {
  include: PrismaIncludeTree;
}

interface PrismaIncludeTree {
  [key: string]: PrismaIncludeValue;
}

export function buildInclude(
  raw?: string[] | string,
  allowed?: string[],
): PrismaIncludeTree {
  if (!raw) return {};

  const includeList = Array.isArray(raw)
    ? raw.flatMap((v) => v.split(','))
    : String(raw).split(',');

  const include: PrismaIncludeTree = {};
  const invalid: string[] = [];

  for (const item of includeList) {
    const path = item.trim();
    if (!path) continue;

    // ✅ validar whitelist
    if (allowed && !allowed.includes(path)) {
      invalid.push(path);
      continue;
    }

    const keys = path.split('.');

    // ✅ include simple
    if (keys.length === 1) {
      include[keys[0]] = true;
      continue;
    }

    // ✅ include anidado
    let current: PrismaIncludeTree = include;

    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;

      if (isLast) {
        current[key] = true;
        return;
      }

      const existing = current[key];

      // ✅ Si no existe o es true, lo convertimos en objeto con include
      if (!existing || existing === true) {
        current[key] = { include: {} };
      }

      // ✅ Ahora TS sabe que es PrismaIncludeObject
      current = (current[key] as PrismaIncludeObject).include;
    });
  }

  if (invalid.length > 0) {
    throw new BadRequestException({
      message: 'Parámetros de include inválidos.',
      invalid,
      allowed: allowed ?? null,
    });
  }

  return include;
}

// ===================================================================================
export function prismaQueryBuilder<
  WhereType,
  IncludeType extends Record<string, unknown>,
>(options: QueryOptionsSchemaType, allowedIncludes?: string[]) {
  return {
    ...buildPagination(options),
    where: buildFilters<WhereType>(options.filtros),
    include: buildInclude(options.include, allowedIncludes) as IncludeType,
  };
}
