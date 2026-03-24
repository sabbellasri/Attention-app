import { CheckCircle2, Circle, ListChecks } from "lucide-react";

export default function LeftSidebar({ steps, currentStep, visited, onStepChange }) {
  const progress = Math.round((visited.size / steps.length) * 100);

  return (
    <aside className="glass col-span-12 lg:col-span-2 rounded-2xl p-4 h-[calc(100vh-7.5rem)] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 text-cyan-300 mb-3">
        <ListChecks size={18} />
        <h2 className="text-sm tracking-wide uppercase">Steps</h2>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2 mb-3">
        <div
          className="bg-gradient-to-r from-accent to-accent2 h-2 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-300 mb-4">Progress: {progress}%</p>
      <div className="space-y-2 overflow-auto scrollbar-thin pr-1">
        {steps.map((step) => {
          const done = visited.has(step.id);
          const active = step.id === currentStep;
          return (
            <button
              type="button"
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                active
                  ? "border-accent bg-cyan-950/40"
                  : "border-slate-700 bg-slate-900/30 hover:border-slate-500"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-slate-200">
                {done ? <CheckCircle2 size={14} className="text-ok" /> : <Circle size={14} className="text-slate-500" />}
                <span>{step.title.replace("Step ", "")}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
