import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useDeleteDay } from "../hooks/use-days";
import { useToast } from "../hooks/use-toast";
import type { Day } from "@shared/schema";

interface DeleteDialogProps {
  dayToDelete: Day | null;
  onClose: () => void;
}

export function DeleteDialog({ dayToDelete, onClose }: DeleteDialogProps) {
  const { toast } = useToast();
  const deleteDay = useDeleteDay();

  const handleDelete = async () => {
    if (!dayToDelete) return;
    try {
      await deleteDay.mutateAsync(dayToDelete.id);
      toast({ title: "Day deleted successfully" });
      onClose();
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const isOpen = !!dayToDelete;

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
              className="glass-panel w-full max-w-sm pointer-events-auto overflow-hidden flex flex-col p-6 text-center items-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Delete Day {dayToDelete.dayNumber}?</h2>
              <p className="text-[#a7b3d6] text-sm mb-6">
                This action cannot be undone. All logged exercises for this day will be permanently removed.
              </p>
              
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="premium-button-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteDay.isPending}
                  className="premium-button-danger flex-1"
                >
                  {deleteDay.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
