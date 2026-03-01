import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { X, Dumbbell, Save, Loader2 } from "lucide-react";
import { useCreateDay, useUpdateDay } from "../hooks/use-days";
import { useToast } from "../hooks/use-toast";
import type { Day } from "@shared/schema";

const formSchema = z.object({
  dayNumber: z.coerce.number().min(1, "Day number must be at least 1"),
  status: z.enum(["Logged", "Planned"]),
  exercisesText: z.string().min(1, "Enter at least one exercise"),
});

type FormData = z.infer<typeof formSchema>;

interface DayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dayToEdit?: Day | null;
}

export function DayDialog({ isOpen, onClose, dayToEdit }: DayDialogProps) {
  const { toast } = useToast();
  const createDay = useCreateDay();
  const updateDay = useUpdateDay();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dayNumber: 1,
      status: "Logged",
      exercisesText: "",
    },
  });

  useEffect(() => {
    if (dayToEdit) {
      reset({
        dayNumber: dayToEdit.dayNumber,
        status: dayToEdit.status as "Logged" | "Planned",
        exercisesText: dayToEdit.exercises.join("\n"),
      });
    } else {
      reset({
        dayNumber: 1,
        status: "Logged",
        exercisesText: "",
      });
    }
  }, [dayToEdit, isOpen, reset]);

  const isPending = createDay.isPending || updateDay.isPending;

  const onSubmit = async (data: FormData) => {
    const exercisesArray = data.exercisesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    try {
      if (dayToEdit) {
        await updateDay.mutateAsync({
          id: dayToEdit.id,
          dayNumber: data.dayNumber,
          status: data.status,
          exercises: exercisesArray,
        });
        toast({ title: "Day updated successfully" });
      } else {
        await createDay.mutateAsync({
          dayNumber: data.dayNumber,
          status: data.status,
          exercises: exercisesArray,
        });
        toast({ title: "Day logged successfully" });
      }
      onClose();
    } catch (error) {
      toast({
        title: "Error saving log",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass-panel w-full max-w-lg pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {dayToEdit ? "Edit Log" : "New Log"}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto">
                <form id="day-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-[#a7b3d6]">Day Number</label>
                      <input
                        type="number"
                        {...register("dayNumber")}
                        className="premium-input"
                        placeholder="e.g. 1"
                      />
                      {errors.dayNumber && (
                        <p className="text-red-400 text-xs">{errors.dayNumber.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-[#a7b3d6]">Status</label>
                      <select {...register("status")} className="premium-input appearance-none">
                        <option value="Logged" className="bg-[#121b2c]">Logged</option>
                        <option value="Planned" className="bg-[#121b2c]">Planned</option>
                      </select>
                      {errors.status && (
                        <p className="text-red-400 text-xs">{errors.status.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#a7b3d6] flex items-center gap-2">
                      <Dumbbell size={14} /> Exercises
                    </label>
                    <p className="text-xs text-[#a7b3d6]/70 mb-2">
                      Enter each exercise on a new line (e.g. "Diamond push-ups — 1×40")
                    </p>
                    <textarea
                      {...register("exercisesText")}
                      className="premium-input min-h-[160px] resize-y"
                      placeholder="Squats (25kg) — 1×30&#10;Diamond push-ups — 1×40"
                    />
                    {errors.exercisesText && (
                      <p className="text-red-400 text-xs">{errors.exercisesText.message}</p>
                    )}
                  </div>
                </form>
              </div>

              <div className="p-5 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="premium-button-ghost"
                >
                  Cancel
                </button>
                <button
                  form="day-form"
                  type="submit"
                  disabled={isPending}
                  className="premium-button"
                >
                  {isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {dayToEdit ? "Save Changes" : "Log Day"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
