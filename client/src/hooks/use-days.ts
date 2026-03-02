import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useDays(category: string) {
  return useQuery({
    queryKey: [api.days.list.path, category],
    queryFn: async () => {
      const res = await fetch(`${api.days.list.path}?category=${category}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch days");
      const data = await res.json();
      return parseWithLogging(api.days.list.responses[200], data, "days.list");
    },
    refetchInterval: 10000,
  });
}
