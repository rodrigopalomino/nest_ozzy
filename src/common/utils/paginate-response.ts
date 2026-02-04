//* src/common/utils/paginate-response.ts

// ===================================================================================
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number | null;
    total: number;
    totalPages: number | null;
  };
}

// ===================================================================================
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit?: number,
): PaginatedResponse<T> {
  const totalPages = limit && limit > 0 ? Math.ceil(total / limit) : null;

  return {
    data,
    meta: {
      page,
      limit: limit ?? null,
      total,
      totalPages,
    },
  };
}
