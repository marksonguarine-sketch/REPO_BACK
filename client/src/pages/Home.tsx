import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap, Home as HomeIcon, Dumbbell, MessageCircle } from "lucide-react";
import { useDays } from "../hooks/use-days";
import { DayCard } from "../components/DayCard";
import { IntensityGraph } from "../components/IntensityGraph";
import { DailyIntake } from "../components/DailyIntake";
import type { Day } from "@shared/schema";

export default function HomePage() {
  const [category, setCategory] = useState<"home" | "gym">("home");
  const { data: days, isLoading, isError } = useDays(category);

  const sortedDays = days ? [...days].sort((a, b) => a.dayNumber - b.dayNumber) : [];

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6 pb-20">
      <header className="mb-5">
        <div className="glass-panel p-5">
          <h1 className="m-0 text-[clamp(18px,2.3vw,26px)] tracking-[0.2px] flex gap-3 items-center flex-wrap drop-shadow-md">
            <span className="flex items-center gap-2 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              <Zap size={24} className="text-[#7c5cff]" />
              Ebona Lock-In Logs
            </span>
            <span className="text-[12px] px-3 py-1.5 rounded-full border border-white/10 bg-[#7c5cff]/10 text-[#e9e4ff] whitespace-nowrap shadow-sm font-medium tracking-wide">
              Manage via Telegram Bot
            </span>
          </h1>
        </div>
      </header>

      <div className="flex gap-2 mb-5" data-testid="category-toggle">
        <button
          onClick={() => setCategory("home")}
          data-testid="button-home-workout"
          className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 border ${
            category === "home"
              ? "bg-gradient-to-b from-[#7c5cff]/30 to-[#7c5cff]/10 border-[#7c5cff]/40 text-white shadow-[0_0_20px_rgba(124,92,255,0.2)]"
              : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
          }`}
        >
          <HomeIcon size={18} />
          Home Workout
        </button>
        <button
          onClick={() => setCategory("gym")}
          data-testid="button-gym-workout"
          className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 border ${
            category === "gym"
              ? "bg-gradient-to-b from-[#38bdf8]/30 to-[#38bdf8]/10 border-[#38bdf8]/40 text-white shadow-[0_0_20px_rgba(56,189,248,0.2)]"
              : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
          }`}
        >
          <Dumbbell size={18} />
          Gym Workout
        </button>
      </div>

      {!isLoading && !isError && sortedDays.length > 0 && (
        <motion.div
          key={`graph-${category}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <IntensityGraph days={sortedDays} category={category} />
        </motion.div>
      )}

      {category === "home" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <DailyIntake />
        </motion.div>
      )}

      <div className="flex gap-3 flex-wrap mb-5" aria-label="Legend">
        <span className="rounded-full px-3 py-2 border border-white/10 bg-[#0f1624]/80 text-[#eaf0ff] text-xs inline-flex gap-2 items-center shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" /> 
          Logged
        </span>
        <span className="rounded-full px-3 py-2 border border-white/10 bg-[#0f1624]/80 text-[#eaf0ff] text-xs inline-flex gap-2 items-center shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_0_4px_rgba(245,158,11,0.14)]" /> 
          Planned
        </span>
        <span className="rounded-full px-3 py-2 border border-white/10 bg-[#0f1624]/80 text-[#eaf0ff] text-xs inline-flex gap-2 items-center shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-sm font-medium ml-auto">
          <MessageCircle size={12} className="text-[#38bdf8]" />
          Edit via Telegram
        </span>
      </div>

      <section aria-label="Workout timeline" data-testid="workout-timeline">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#a7b3d6]">
            <Activity className="animate-pulse mb-4 text-[#7c5cff]" size={40} />
            <p className="font-medium tracking-wide">Loading your logs...</p>
          </div>
        ) : isError ? (
          <div className="glass-panel p-8 text-center border-red-500/20 bg-red-500/5">
            <p className="text-red-400" data-testid="text-error">Failed to load logs. Please try refreshing.</p>
          </div>
        ) : sortedDays.length === 0 ? (
          <div className="glass-panel p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Dumbbell size={32} className="text-[#a7b3d6]/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">No logs yet</h3>
            <p className="text-[#a7b3d6] max-w-md mb-2">
              Use the Telegram bot to start logging your {category} workouts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {sortedDays.map((day, i) => (
              <motion.div 
                key={day.id}
                className="col-span-12 md:col-span-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.25, 0.25, 0, 1] }}
              >
                <DayCard day={day} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
