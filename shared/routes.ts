import { z } from 'zod';
import { insertDaySchema, days } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  days: {
    list: {
      method: 'GET' as const,
      path: '/api/days' as const,
      responses: {
        200: z.array(z.custom<typeof days.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/days/:id' as const,
      responses: {
        200: z.custom<typeof days.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/days' as const,
      input: insertDaySchema,
      responses: {
        201: z.custom<typeof days.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/days/:id' as const,
      input: insertDaySchema.partial(),
      responses: {
        200: z.custom<typeof days.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/days/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type DayInput = z.infer<typeof api.days.create.input>;
export type DayResponse = z.infer<typeof api.days.create.responses[201]>;
export type DayUpdateInput = z.infer<typeof api.days.update.input>;
export type DaysListResponse = z.infer<typeof api.days.list.responses[200]>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
export type InternalError = z.infer<typeof errorSchemas.internal>;
