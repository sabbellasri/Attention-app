import { BlockMath, InlineMath } from "react-katex";
import { Sparkles, Sigma, Layers3, ScanLine, Gauge } from "lucide-react";
import { useState } from "react";
import { applyRoPE, formatPercent, gqaMemoryEstimate, sinusoidalEncoding } from "../utils/attentionMath";

function valueToColor(v) {
  const clamped = Math.max(0, Math.min(1, v));
  const blue = Math.round(60 + clamped * 170);
  const green = Math.round(25 + clamped * 190);
  const red = Math.round(20 + clamped * 70);
  return `rgb(${red}, ${green}, ${blue})`;
}

function Heatmap({ matrix, rowLabels, colLabels }) {
  if (!matrix?.length) return null;
  return (
    <div className="overflow-auto scrollbar-thin">
      <div
        className="grid gap-1 min-w-[480px]"
        style={{ gridTemplateColumns: `140px repeat(${matrix[0].length}, minmax(48px,1fr))` }}
      >
        <div className="text-xs text-slate-400" />
        {colLabels.map((label, i) => (
          <div key={`col-${i}`} className="text-[10px] text-slate-400 text-center truncate px-1" title={label}>
            {label}
          </div>
        ))}
        {matrix.map((row, rIdx) => (
          <div key={`row-${rIdx}`} className="contents">
            <div className="text-[10px] text-slate-400 truncate px-1 py-2" title={rowLabels[rIdx]}>
              {rowLabels[rIdx]}
            </div>
            {row.map((v, cIdx) => {
              const finite = Number.isFinite(v);
              const display = finite ? v.toFixed(2) : "-inf";
              const normalized = finite ? Math.min(1, Math.max(0, v)) : 0;
              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className="heat-cell text-[10px] py-2 text-center rounded"
                  style={{
                    background: finite ? valueToColor(normalized) : "rgb(60, 20, 20)",
                    opacity: finite ? 1 : 0.6
                  }}
                  title={`q${rIdx} -> k${cIdx}: ${display}`}
                >
                  {display}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallMatrix({ title, matrix, maxRows = 4 }) {
  return (
    <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
      <h3 className="text-sm text-cyan-300 mb-2">{title}</h3>
      <div className="space-y-1 text-xs text-slate-300 font-mono">
        {matrix.slice(0, maxRows).map((row, idx) => (
          <div key={`${title}-${idx}`}>[{row.map((v) => Number(v).toFixed(3)).join(", ")}]</div>
        ))}
      </div>
    </div>
  );
}

function TokenEmbeddingExplorer({ tokens, embeddings, enableHover }) {
  const [hoveredIdx, setHoveredIdx] = useState(0);

  return (
    <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
      <h3 className="text-sm text-cyan-300 mb-2">Tokens from User Input</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {tokens.map((token, idx) => (
          <button
            key={token}
            type="button"
            className={`text-xs rounded-full px-2 py-1 border transition ${
              hoveredIdx === idx ? "border-cyan-400 bg-cyan-900/30" : "border-slate-700 bg-slate-900/60"
            }`}
            onMouseEnter={() => enableHover && setHoveredIdx(idx)}
            onFocus={() => enableHover && setHoveredIdx(idx)}
            onClick={() => setHoveredIdx(idx)}
            title={token}
          >
            {token}
          </button>
        ))}
      </div>
      {enableHover ? (
        <div className="text-xs text-slate-300 font-mono rounded-lg border border-slate-700 bg-slate-900/60 p-2">
          <div className="text-cyan-300 mb-1">Embedding for {tokens[hoveredIdx]}</div>
          <div>[{(embeddings[hoveredIdx] || []).map((v) => Number(v).toFixed(3)).join(", ")}]</div>
          <p className="text-slate-400 mt-2 font-sans">
            Hover or click a token chip to inspect its embedding vector.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Embedding details unlock in Step 2.</p>
      )}
    </div>
  );
}

export default function VisualizationPanel({ currentStep, stepData, tokens, dynamicAttention, advanced, setAdvanced }) {
  const {
    embeddings,
    qMatrix,
    kMatrix,
    vMatrix,
    scaledScores,
    attentionWeights,
    queryIndex,
    qVector,
    queryRawScores,
    queryScaledScores,
    queryWeights,
    queryOutput,
    multiHeadMaps,
    combinedOutput
  } = dynamicAttention;

  const sin = sinusoidalEncoding(advanced.position, 8);
  const ropeInput = qMatrix[queryIndex] || [0.91, 0.33, 0.72, 0.64];
  const ropeOutput = applyRoPE(ropeInput, advanced.position, advanced.ropeTheta);

  const gqaInfo = gqaMemoryEstimate({
    seqLen: advanced.seqLen,
    heads: advanced.headCount,
    groupFactor: advanced.groupFactor,
    dim: advanced.headDim
  });

  const detailRows = [
    { label: "Focus", value: stepData.focus },
    { label: "What Happens", value: stepData.whatHappens },
    { label: "How It Is Generated", value: stepData.howGenerated },
    { label: "Why It Matters", value: stepData.whyItMatters }
  ].filter((row) => row.value);

  return (
    <main className="glass col-span-12 lg:col-span-7 rounded-2xl p-5 h-[calc(100vh-7.5rem)] overflow-auto scrollbar-thin">
      <h2 className="text-xl font-semibold text-cyan-100 mb-2">{stepData.title}</h2>
      <p className="text-slate-300 mb-3">{stepData.body}</p>
      {!!detailRows.length && (
        <section className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 mb-3 space-y-2">
          {detailRows.map((row) => (
            <div key={row.label}>
              <h3 className="text-xs uppercase tracking-wide text-cyan-300">{row.label}</h3>
              <p className="text-sm text-slate-300 mt-1">{row.value}</p>
            </div>
          ))}
          {Array.isArray(stepData.keyTerms) && stepData.keyTerms.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-cyan-300">Key Terms</h3>
              <p className="text-sm text-slate-300 mt-1">{stepData.keyTerms.join(" | ")}</p>
            </div>
          )}
          {Array.isArray(stepData.misconceptions) && stepData.misconceptions.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-cyan-300">Common Misconceptions</h3>
              <ul className="text-sm text-slate-300 mt-1 list-disc list-inside">
                {stepData.misconceptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(stepData.aiTutorPrompts) && stepData.aiTutorPrompts.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-cyan-300">Ask The AI Tutor</h3>
              <ul className="text-sm text-slate-300 mt-1 list-disc list-inside">
                {stepData.aiTutorPrompts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      <div className="text-sm text-slate-300 mb-3">
        <BlockMath math="Attention(Q, K, V) = softmax\\left(\\frac{QK^T}{\\sqrt{d}}\\right)V" />
        {Array.isArray(stepData.formulas) && stepData.formulas.map((formula) => (
          <BlockMath key={formula} math={formula} />
        ))}
      </div>

      {currentStep >= 3 && (
        <section className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 mb-3">
          <label className="text-xs text-slate-300 block mb-1">
            Focus query token: {tokens[queryIndex] || "Model[0]"}
          </label>
          <input
            type="range"
            min="0"
            max={Math.max(0, tokens.length - 1)}
            value={queryIndex}
            onChange={(e) => setAdvanced((prev) => ({ ...prev, queryIndex: Number(e.target.value) }))}
            className="w-full"
          />
        </section>
      )}

      {currentStep === 1 && (
        <section className="space-y-3">
          <TokenEmbeddingExplorer tokens={tokens} embeddings={embeddings} enableHover={false} />
        </section>
      )}

      {currentStep === 2 && (
        <section className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <TokenEmbeddingExplorer tokens={tokens} embeddings={embeddings} enableHover />
            <SmallMatrix title="Embeddings (X)" matrix={embeddings} />
          </div>
        </section>
      )}

      {currentStep === 3 && (
        <section className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <TokenEmbeddingExplorer tokens={tokens} embeddings={embeddings} enableHover />
            <SmallMatrix title="Embeddings (X)" matrix={embeddings} />
            <SmallMatrix title="Query Matrix (Q)" matrix={qMatrix} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <SmallMatrix title="Key Matrix (K)" matrix={kMatrix} />
            <SmallMatrix title="Value Matrix (V)" matrix={vMatrix} />
          </div>
        </section>
      )}

      {[4, 5, 6, 7, 9, 11, 12].includes(currentStep) && (
        <section className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-slate-200 flex items-center gap-2">
                <Sigma size={14} /> Raw Dot Scores
              </h3>
              <p className="text-xs text-slate-300 mt-2">{queryRawScores.map((v) => v.toFixed(3)).join(", ")}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-slate-200">Scaled by sqrt(d)</h3>
              <p className="text-xs text-slate-300 mt-2">
                {queryScaledScores.map((v) => (Number.isFinite(v) ? v.toFixed(3) : "-inf")).join(", ")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-slate-200">Softmax</h3>
              <p className="text-xs text-slate-300 mt-2">{queryWeights.map((v) => formatPercent(v)).join(" | ")}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
            <h3 className="text-sm text-cyan-300">Weighted V Output for Selected Query</h3>
            <p className="font-mono text-sm mt-2">[{queryOutput.map((v) => v.toFixed(3)).join(", ")}]</p>
            <p className="text-xs text-slate-400 mt-2">Live computed from your sentence, not fixed demo values.</p>
          </div>

          <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 text-xs text-slate-300">
            Selected query vector: [{qVector.map((v) => v.toFixed(3)).join(", ")}]
          </div>
        </section>
      )}

      {currentStep === 8 && (
        <section className="space-y-3">
          <h3 className="text-sm text-cyan-300">Self-Attention Heatmap (Dynamic N x N)</h3>
          <Heatmap matrix={attentionWeights} rowLabels={tokens} colLabels={tokens} />
        </section>
      )}

      {currentStep === 10 && (
        <section className="rounded-xl border border-slate-700 p-4 bg-slate-950/35">
          <h3 className="text-sm text-cyan-300 mb-3 flex items-center gap-2">
            <Sparkles size={14} /> End-to-End Pipeline Animation
          </h3>
          <div className="grid md:grid-cols-4 gap-2 text-xs">
            {["Tokenize", "Embed", "QKV", "Positional", "Mask", "Multi-Head", "Softmax", "Output"].map((name, i) => (
              <div key={name} className="rounded-lg border border-slate-700 p-2 bg-slate-900/50 animate-drift" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="text-slate-200">{name}</div>
                <div className="h-1 mt-2 rounded bg-cyan-500/30 animate-pulseLine" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Current pipeline uses your exact input tokens and recomputes all matrices on each edit.
          </p>
        </section>
      )}

      {currentStep === 13 && (
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
            <h3 className="text-sm text-cyan-300 flex items-center gap-2">
              <Layers3 size={14} /> Multi-Head Explorer (Dynamic)
            </h3>
            <label className="text-xs text-slate-300 block mt-2 mb-1">Head count</label>
            <input
              type="range"
              min="1"
              max="8"
              value={advanced.headCount}
              onChange={(e) => setAdvanced((prev) => ({ ...prev, headCount: Number(e.target.value) }))}
              className="w-full"
            />
            <p className="text-xs text-slate-400">Toggle active heads to inspect specialization.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Array.from({ length: advanced.headCount }, (_, i) => i).map((h) => {
                const active = advanced.activeHeads.includes(h);
                return (
                  <button
                    key={`head-${h}`}
                    type="button"
                    onClick={() =>
                      setAdvanced((prev) => {
                        const exists = prev.activeHeads.includes(h);
                        const next = exists ? prev.activeHeads.filter((x) => x !== h) : [...prev.activeHeads, h];
                        return { ...prev, activeHeads: next.length ? next : [h] };
                      })
                    }
                    className={`px-2 py-1 text-xs rounded-lg border ${
                      active ? "border-cyan-500 bg-cyan-900/40" : "border-slate-600 bg-slate-900"
                    }`}
                  >
                    Head {h + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {multiHeadMaps.slice(0, advanced.headCount).map((map, idx) => (
              <div key={`hm-${idx}`} className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
                <h4 className="text-xs text-slate-300 mb-2">Head {idx + 1}</h4>
                <Heatmap matrix={map} rowLabels={tokens} colLabels={tokens} />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 text-xs text-slate-300">
            <div>Concatenation + projection: <InlineMath math="[head_1 \\Vert head_2 \\Vert \\cdots \\Vert head_h]W_O" /></div>
            <div className="mt-2">Combined output (selected query): [{combinedOutput.map((v) => v.toFixed(3)).join(", ")}]</div>
          </div>
        </section>
      )}

      {currentStep === 14 && (
        <section className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-cyan-300">Sinusoidal Position Encoding</h3>
              <label className="text-xs text-slate-300 block mt-2">Position: {advanced.position}</label>
              <input
                type="range"
                min="0"
                max="64"
                value={advanced.position}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, position: Number(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-slate-300 mt-2">[{sin.map((v) => v.toFixed(3)).join(", ")}]</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-amber-300">RoPE Rotation</h3>
              <label className="text-xs text-slate-300 block mt-2">Theta: {advanced.ropeTheta}</label>
              <input
                type="range"
                min="1000"
                max="20000"
                step="500"
                value={advanced.ropeTheta}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, ropeTheta: Number(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-slate-300 mt-2">RoPE(q): [{ropeOutput.map((v) => v.toFixed(3)).join(", ")}]</p>
            </div>
          </div>
          <BlockMath math="\\text{RoPE}(x, p)=R_{\\Theta,p}x,\\quad \\langle \\text{RoPE}(q,p_i), \\text{RoPE}(k,p_j)\\rangle \\propto f(p_i-p_j)" />
        </section>
      )}

      {currentStep === 15 && (
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={advanced.causalMask}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, causalMask: e.target.checked }))}
              />
              Enable triangular causal mask
            </label>
            <p className="text-xs text-slate-400 mt-2">Future tokens are set to -inf before softmax in decoder-only generation.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-cyan-300">Scores (after mask)</h3>
              <Heatmap matrix={scaledScores} rowLabels={tokens} colLabels={tokens} />
            </div>
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-emerald-300">Softmax Rows</h3>
              <Heatmap matrix={attentionWeights} rowLabels={tokens} colLabels={tokens} />
            </div>
          </div>
        </section>
      )}

      {currentStep === 16 && (
        <section className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35">
              <h3 className="text-sm text-cyan-300 flex items-center gap-2">
                <Gauge size={14} /> GQA Controls
              </h3>
              <label className="text-xs text-slate-300 block mt-2">Grouping factor: {advanced.groupFactor}</label>
              <input
                type="range"
                min="1"
                max="8"
                value={advanced.groupFactor}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, groupFactor: Number(e.target.value) }))}
                className="w-full"
              />
              <label className="text-xs text-slate-300 block mt-2">Sequence length: {advanced.seqLen}</label>
              <input
                type="range"
                min="128"
                max="4096"
                step="128"
                value={advanced.seqLen}
                onChange={(e) => setAdvanced((prev) => ({ ...prev, seqLen: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 text-xs text-slate-300">
              <p>Full MHA KV elements: {gqaInfo.full.toLocaleString()}</p>
              <p>GQA KV elements: {gqaInfo.gqa.toLocaleString()}</p>
              <p>KV heads in GQA: {gqaInfo.kvHeads}</p>
              <p className="text-emerald-300 mt-1">Memory reduction: {gqaInfo.reduction}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 text-xs text-slate-300">
              <h3 className="text-sm text-amber-300 mb-2">Flash-style Block Compute</h3>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 16 }, (_, i) => (
                  <div
                    key={`blk-${i}`}
                    className="h-8 rounded bg-cyan-800/40 animate-pulseLine"
                    style={{ animationDelay: `${i * 0.08}s` }}
                    title="Tile processed in SRAM-like blocks"
                  />
                ))}
              </div>
              <p className="mt-2">No full attention matrix is stored at once in this style of computation.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 p-3 bg-slate-950/35 text-xs text-slate-300 flex items-center gap-2">
            <ScanLine size={14} />
            Simplified sparsity view: grouped KV heads retain quality while reducing cache bandwidth.
          </div>
        </section>
      )}
    </main>
  );
}
