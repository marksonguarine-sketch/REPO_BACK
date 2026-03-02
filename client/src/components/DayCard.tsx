import { Dumbbell } from "lucide-react";
import type { Day } from "@shared/schema";

interface DayCardProps {
  day: Day;
}

export function DayCard({ day }: DayCardProps) {
  const isPlanned = day.status === "Planned";
  
  return (
    <article className="glass-panel glass-card col-span-12 md:col-span-6 group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(0,0,0,0.5)]" data-testid={`card-day-${day.dayNumber}`}>
      <div className="p-[14px] pb-[12px] border-b border-white/10 flex items-start justify-between gap-2.5">
        <div className="flex gap-2.5 items-center flex-wrap">
          <h3 className="m-0 text-[15px] tracking-[0.2px] font-bold text-white drop-shadow-sm">
            Day {day.dayNumber}
          </h3>
          <span 
            data-testid={`badge-status-${day.dayNumber}`}
            className={`
              text-[11px] px-2.5 py-1.5 rounded-full border whitespace-nowrap font-medium tracking-wide shadow-sm
              ${isPlanned 
                ? "bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#fff2d3]" 
                : "bg-[#22c55e]/10 border-[#22c55e]/20 text-[#d8ffe4]"
              }
            `}
          >
            {day.status}
          </span>
        </div>
      </div>
      
      <div className="p-[12px] pt-[14px] grid gap-2.5">
        <div className="bg-[#121b2c]/70 border border-white/10 rounded-[14px] p-3 shadow-inner">
          <h4 className="m-0 mb-2 text-[12px] text-[#dbe4ff] tracking-[0.25px] flex gap-2 items-center font-bold uppercase">
            <Dumbbell size={13} className="text-[#38bdf8]" /> Training
          </h4>
          {day.exercises.length > 0 ? (
            <ul className="m-0 pl-[18px] text-[#eaf0ff]/90 leading-[1.6] text-[13px] list-disc marker:text-[#38bdf8]/50">
              {day.exercises.map((ex, i) => (
                <li key={i} className="my-1.5 pl-1">{ex}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#a7b3d6] italic mt-2">No exercises logged yet.</p>
          )}
        </div>
      </div>
    </article>
  );
}
