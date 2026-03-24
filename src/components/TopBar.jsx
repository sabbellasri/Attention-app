import { RotateCcw, Share2, Download } from "lucide-react";

export default function TopBar({ sentence, onSentenceChange, onReset, onShare, onExport }) {
  return (
    <header className="glass rounded-2xl p-4 mb-4 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
      <div className="w-full lg:flex-1">
        <label htmlFor="sentence" className="text-xs uppercase tracking-wider text-slate-300 block mb-1">
          Editable Sentence
        </label>
        <input
          id="sentence"
          value={sentence}
          onChange={(e) => onSentenceChange(e.target.value)}
          className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-accent"
          placeholder="The model helps you upskill in tech"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm border border-slate-600 flex items-center gap-2"
        >
          <RotateCcw size={15} />
          Reset to Example
        </button>
        <button
          type="button"
          onClick={onShare}
          className="px-3 py-2 rounded-xl bg-cyan-900/45 hover:bg-cyan-800/50 text-sm border border-cyan-700 flex items-center gap-2"
          title="Copy shareable URL with encoded state"
        >
          <Share2 size={15} />
          Share URL
        </button>
        <button
          type="button"
          onClick={onExport}
          className="px-3 py-2 rounded-xl bg-amber-900/45 hover:bg-amber-800/50 text-sm border border-amber-700 flex items-center gap-2"
        >
          <Download size={15} />
          Export JSON
        </button>
      </div>
    </header>
  );
}
