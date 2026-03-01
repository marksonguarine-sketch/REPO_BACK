import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Activity, Zap } from "lucide-react";
import { useDays } from "../hooks/use-days";
import { DayCard } from "../components/DayCard";
import { DayDialog } from "../components/DayDialog";
import { DeleteDialog } from "../components/DeleteDialog";
import type { Day } from "@shared/schema";

export default function Home() {
  const { data: days, isLoading, isError } = useDays();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dayToEdit, setDayToEdit] = useState<Day | null>(null);
  const [dayToDelete, setDayToDelete] = useState<Day | null>(null);

  const handleEdit = (day: Day) => {
    setDayToEdit(day);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setDayToEdit(null);
    setIsDialogOpen(true);
  };

  // Sort days by dayNumber
  const sortedDays = days ? [...days].sort((a, b) => a.dayNumber - b.dayNumber) : [];

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-8 pb-20">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="glass-panel flex-1 p-5 w-full">
          <h1 className="m-0 text-[clamp(18px,2.3vw,26px)] tracking-[0.2px] flex gap-3 items-center flex-wrap drop-shadow-md">
            <span className="flex items-center gap-2 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              <Zap size={24} className="text-[#7c5cff]" />
              Ebona Lock-In Logs
            </span>
            <span className="text-[12px] px-3 py-1.5 rounded-full border border-white/10 bg-[#7c5cff]/10 text-[#e9e4ff] whitespace-nowrap shadow-sm font-medium tracking-wide">
              Type + sets/reps only
            </span>
          </h1>
        </div>
        
        <button onClick={handleAddNew} className="premium-button whitespace-nowrap w-full md:w-auto shadow-xl">
          <Plus size={18} /> Add Log
        </button>
      </header>

      <div className="flex gap-3 flex-wrap my-5" aria-label="Legend">
        <span className="rounded-full px-3 py-2 border border-white/10 bg-[#0f1624]/80 text-[#eaf0ff] text-xs inline-flex gap-2 items-center shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" /> 
          Logged
        </span>
        <span className="rounded-full px-3 py-2 border border-white/10 bg-[#0f1624]/80 text-[#eaf0ff] text-xs inline-flex gap-2 items-center shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_0_4px_rgba(245,158,11,0.14)]" /> 
          Planned
        </span>
      </div>

      <section aria-label="Workout timeline" className="mt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#a7b3d6]">
            <Activity className="animate-pulse mb-4 text-[#7c5cff]" size={40} />
            <p className="font-medium tracking-wide">Loading your logs...</p>
          </div>
        ) : isError ? (
          <div className="glass-panel p-8 text-center border-red-500/20 bg-red-500/5">
            <p className="text-red-400">Failed to load logs. Please try refreshing.</p>
          </div>
        ) : sortedDays.length === 0 ? (
          <div className="glass-panel p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Dumbbell size={32} className="text-[#a7b3d6]/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">No logs found</h3>
            <p className="text-[#a7b3d6] max-w-md mb-6">
              You haven't logged any days yet. Start your journey by adding your first workout log!
            </p>
            <button onClick={handleAddNew} className="premium-button">
              <Plus size={18} /> Start Logging
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {sortedDays.map((day, i) => (
              <motion.div 
                key={day.id}
                className="col-span-12 md:col-span-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.25, 0.25, 0, 1] }}
              >
                <DayCard 
                  day={day} 
                  onEdit={handleEdit} 
                  onDelete={setDayToDelete} 
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <DayDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        dayToEdit={dayToEdit} 
      />
      
      <DeleteDialog
        dayToDelete={dayToDelete}
        onClose={() => setDayToDelete(null)}
      />
    </div>
  );
}
