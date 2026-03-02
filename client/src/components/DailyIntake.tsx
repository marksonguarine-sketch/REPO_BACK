import { Pill, Zap } from "lucide-react";

const supplements = [
  { name: "Creatine", amount: "5g", color: "#7c5cff" },
  { name: "Whey", amount: "132g (33g = 50g of protein)", color: "#38bdf8" },
  { name: "Caffeine", amount: "700mg", color: "#f59e0b" },
  { name: "L-Citrulline", amount: "8,000 mg", color: "#22c55e" },
  { name: "Beta-Alanine", amount: "3,200 mg", color: "#ec4899" },
  { name: "L-Theanine", amount: "400 mg", color: "#a78bfa" },
  { name: "Dicaffeine Malate", amount: "300 mg", color: "#f97316" },
  { name: "BioPerine (Piperine 50:1)", amount: "4.8 mg", color: "#14b8a6" },
  { name: "Capsaicine", amount: "3 mg", color: "#ef4444" },
  { name: "Neurocore Secret Blend", amount: "5,523 mg", color: "#8b5cf6" },
];

export function DailyIntake() {
  return (
    <div className="glass-panel p-4 mb-5" data-testid="daily-intake">
      <h3 className="text-sm font-bold text-white/90 flex items-center gap-2 uppercase tracking-wider mb-3">
        <Pill size={16} className="text-[#22c55e]" />
        Daily Intake
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {supplements.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-3 bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
              <span className="text-[13px] text-white/85 font-medium">{s.name}</span>
            </div>
            <span className="text-[12px] text-white/50 font-mono whitespace-nowrap">{s.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
