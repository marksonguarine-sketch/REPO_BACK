import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import type { Day } from "@shared/schema";

function calcIntensity(exercises: string[]): number {
  let score = 0;
  for (const ex of exercises) {
    const lower = ex.toLowerCase();
    if (lower.includes("rest")) continue;
    const setsReps = ex.match(/(\d+)\s*[x\u00D7]\s*(\d+)/i);
    if (setsReps) {
      score += parseInt(setsReps[1]) * parseInt(setsReps[2]);
    } else {
      score += 10;
    }
    const weight = ex.match(/(\d+)\s*kg/i);
    if (weight) {
      score += parseInt(weight[1]) * 0.5;
    }
  }
  return Math.round(score);
}

interface IntensityGraphProps {
  days: Day[];
  category: string;
}

export function IntensityGraph({ days, category }: IntensityGraphProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const intensities = sorted.map(d => ({
    day: d.dayNumber,
    intensity: calcIntensity(d.exercises),
    status: d.status,
  }));
  const maxIntensity = Math.max(...intensities.map(d => d.intensity), 1);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll);
    return () => { if (el) el.removeEventListener("scroll", checkScroll); };
  }, [days]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const accentColor = category === "home" ? "#7c5cff" : "#38bdf8";
  const accentGlow = category === "home" ? "rgba(124,92,255,0.3)" : "rgba(56,189,248,0.3)";

  return (
    <div className="glass-panel p-4 mb-5" data-testid="intensity-graph">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-bold text-white/90 flex items-center gap-2 uppercase tracking-wider">
          <TrendingUp size={16} style={{ color: accentColor }} />
          Daily Intensity
        </h3>
        <div className="flex gap-1">
          {canScrollLeft && (
            <button onClick={() => scroll("left")} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" data-testid="button-scroll-left">
              <ChevronLeft size={16} className="text-white/70" />
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll("right")} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" data-testid="button-scroll-right">
              <ChevronRight size={16} className="text-white/70" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {intensities.map(({ day, intensity, status }) => {
          const height = Math.max(8, (intensity / maxIntensity) * 120);
          const isPlanned = status === "Planned";
          return (
            <div key={day} className="flex flex-col items-center gap-1.5 min-w-[44px]" data-testid={`bar-day-${day}`}>
              <div className="w-8 rounded-t-md relative" style={{ height: 120 }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                  style={{
                    height,
                    background: isPlanned
                      ? `linear-gradient(to top, rgba(245,158,11,0.4), rgba(245,158,11,0.15))`
                      : `linear-gradient(to top, ${accentColor}, ${accentColor}44)`,
                    boxShadow: isPlanned ? "none" : `0 0 12px ${accentGlow}`,
                    border: isPlanned ? "1px dashed rgba(245,158,11,0.4)" : "none",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold text-white/70">D{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
