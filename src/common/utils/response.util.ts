//* src/common/utils/response.util.ts

import { PaginatedResponse } from './paginate-response';

// ===================================================================================
export type PagenatedMeta = PaginatedResponse<unknown>['meta'];

// ===================================================================================
export class CoreResponse {
  // ===================================================================================
  static created<T>(message: string, data: T) {
    return {
      status: 'created',
      message,
      data,
    };
  }

  // ===================================================================================
  static updated<T>(message: string, data: T) {
    return {
      status: 'updated',
      message,
      data,
    };
  }

  // ===================================================================================
  static deleted(message: string) {
    return {
      status: 'deleted',
      message,
    };
  }
  // ===================================================================================
  static success<T>(message: string, data: T) {
    return {
      status: 'success',
      message,
      data,
    };
  }
}
