import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type DayInput, type DayUpdateInput } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useDays() {
  return useQuery({
    queryKey: [api.days.list.path],
    queryFn: async () => {
      const res = await fetch(api.days.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch days");
      const data = await res.json();
      return parseWithLogging(api.days.list.responses[200], data, "days.list");
    },
  });
}

export function useDay(id: number) {
  return useQuery({
    queryKey: [api.days.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.days.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch day");
      const data = await res.json();
      return parseWithLogging(api.days.get.responses[200], data, "days.get");
    },
    enabled: !!id,
  });
}

export function useCreateDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: DayInput) => {
      const validated = api.days.create.input.parse(data);
      const res = await fetch(api.days.create.path, {
        method: api.days.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const resData = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          const error = parseWithLogging(api.days.create.responses[400], resData, "days.create.error");
          throw new Error(error.message);
        }
        throw new Error("Failed to create day");
      }
      return parseWithLogging(api.days.create.responses[201], resData, "days.create.success");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.days.list.path] }),
  });
}

export function useUpdateDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & DayUpdateInput) => {
      const validated = api.days.update.input.parse(updates);
      const url = buildUrl(api.days.update.path, { id });
      const res = await fetch(url, {
        method: api.days.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const resData = await res.json();
        if (res.status === 400) {
          const error = parseWithLogging(api.days.update.responses[400], resData, "days.update.error");
          throw new Error(error.message);
        }
        if (res.status === 404) throw new Error("Day not found");
        throw new Error("Failed to update day");
      }
      const resData = await res.json();
      return parseWithLogging(api.days.update.responses[200], resData, "days.update.success");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.days.list.path] }),
  });
}

export function useDeleteDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.days.delete.path, { id });
      const res = await fetch(url, { 
        method: api.days.delete.method, 
        credentials: "include" 
      });
      if (res.status === 404) throw new Error("Day not found");
      if (!res.ok) throw new Error("Failed to delete day");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.days.list.path] }),
  });
}
