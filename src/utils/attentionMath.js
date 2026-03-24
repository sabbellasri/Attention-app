export const DEFAULT_SENTENCE = "The model helps you upskill in tech";

export const defaultTokens = [
  "Model[0]:The",
  "Model[1]:model",
  "Model[2]:helps",
  "Model[3]:you",
  "Model[4]:upskill",
  "Model[5]:tech"
];

export const defaultQ = [0.78, 0.55, 0.69, 0.61];
export const defaultK = [
  [0.91, 0.33, 0.72, 0.64],
  [0.66, 0.45, 0.58, 0.57],
  [0.74, 0.61, 0.71, 0.67],
  [0.81, 0.58, 0.77, 0.53],
  [0.85, 0.52, 0.69, 0.75],
  [0.77, 0.47, 0.65, 0.61]
];

export const defaultV = [
  [0.9, 0.8, 0.7, 0.8],
  [0.6, 0.7, 0.8, 0.7],
  [0.8, 0.9, 0.7, 0.6],
  [0.7, 0.6, 0.8, 0.8],
  [0.9, 0.8, 0.9, 0.7],
  [0.8, 0.7, 0.7, 0.9]
];

export const defaultRawScores = [1.29, 0.81, 0.95, 1.11, 1.05, 1.02];
export const defaultSoftmax = [20.2, 12.5, 14.4, 17.0, 15.9, 20.0];

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function parseTokens(sentence) {
  const words = parseWords(sentence);
  return words.map((word, idx) => `Model[${idx}]:${word}`);
}

export function parseWords(sentence) {
  return sentence
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9'-]/g, ""))
    .filter(Boolean)
    .slice(0, 16);
}

export function dot(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

export function softmax(values) {
  const max = Math.max(...values);
  const exps = values.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

export function weightedSum(weights, vectors) {
  if (!vectors.length) return [];
  const width = vectors[0].length;
  const out = Array(width).fill(0);
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = 0; j < width; j += 1) {
      out[j] += weights[i] * vectors[i][j];
    }
  }
  return out;
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function buildVectorFromToken(token, dModel = 8) {
  const rand = mulberry32(hashString(token.toLowerCase()));
  return Array.from({ length: dModel }, () => Number((rand() * 2 - 1).toFixed(4)));
}

function buildProjectionMatrix(seed, inDim, outDim) {
  const rand = mulberry32(seed);
  return Array.from({ length: inDim }, () =>
    Array.from({ length: outDim }, () => Number(((rand() * 2 - 1) * 0.7).toFixed(4)))
  );
}

function transpose(matrix) {
  if (!matrix.length) return [];
  return matrix[0].map((_, c) => matrix.map((row) => row[c]));
}

function matMul(a, b) {
  if (!a.length || !b.length) return [];
  const rows = a.length;
  const cols = b[0].length;
  const shared = b.length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      for (let k = 0; k < shared; k += 1) {
        sum += a[r][k] * b[k][c];
      }
      out[r][c] = sum;
    }
  }
  return out;
}

function roundMatrix(matrix, digits = 4) {
  return matrix.map((row) => row.map((v) => Number(v.toFixed(digits))));
}

function buildScores(q, k, scale = true) {
  const kT = transpose(k);
  const raw = matMul(q, kT);
  if (!scale || !q[0]?.length) return raw;
  const factor = Math.sqrt(q[0].length);
  return raw.map((row) => row.map((v) => v / factor));
}

function rowWiseSoftmax(scoreMatrix) {
  return scoreMatrix.map((row) => {
    const safe = row.map((v) => (Number.isFinite(v) ? v : -1e9));
    return softmax(safe);
  });
}

export function computeAttentionFromSentence(sentence, advanced = {}) {
  const words = parseWords(sentence);
  const safeWords = words.length ? words : parseWords(DEFAULT_SENTENCE);
  const tokens = safeWords.map((word, idx) => `Model[${idx}]:${word}`);

  const dModel = 8;
  const dHead = 4;
  const embeddings = safeWords.map((word, i) => {
    const base = buildVectorFromToken(word, dModel);
    const pos = sinusoidalEncoding(i + 1, dModel);
    return base.map((v, j) => v + 0.25 * pos[j]);
  });

  const WQ = buildProjectionMatrix(11, dModel, dHead);
  const WK = buildProjectionMatrix(23, dModel, dHead);
  const WV = buildProjectionMatrix(37, dModel, dHead);

  const Q = matMul(embeddings, WQ);
  const K = matMul(embeddings, WK);
  const V = matMul(embeddings, WV);

  const rawScores = buildScores(Q, K, false);
  let scaledScores = buildScores(Q, K, true);
  if (advanced.causalMask) {
    scaledScores = applyCausalMask(scaledScores);
  }
  const attentionWeights = rowWiseSoftmax(scaledScores);
  const outputs = matMul(attentionWeights, V);

  const queryIndex = clamp(advanced.queryIndex || 0, 0, tokens.length - 1);
  const qVector = Q[queryIndex] || [];

  const headCount = clamp(advanced.headCount || 8, 1, 8);
  const multiHeadMaps = [];
  const headOutputs = [];
  for (let h = 0; h < headCount; h += 1) {
    const hWQ = buildProjectionMatrix(101 + h * 13, dModel, dHead);
    const hWK = buildProjectionMatrix(167 + h * 17, dModel, dHead);
    const hWV = buildProjectionMatrix(251 + h * 19, dModel, dHead);
    const hQ = matMul(embeddings, hWQ);
    const hK = matMul(embeddings, hWK);
    const hV = matMul(embeddings, hWV);
    let hScore = buildScores(hQ, hK, true);
    if (advanced.causalMask) hScore = applyCausalMask(hScore);
    const hWeights = rowWiseSoftmax(hScore);
    const hOut = matMul(hWeights, hV);
    multiHeadMaps.push(roundMatrix(hWeights, 2));
    headOutputs.push(hOut[queryIndex]);
  }

  const activeHeads = (advanced.activeHeads || Array.from({ length: headCount }, (_, i) => i)).filter(
    (h) => h < headCount
  );
  const selectedHeads = activeHeads.length ? activeHeads : [0];
  const concat = selectedHeads.flatMap((h) => headOutputs[h] || Array(dHead).fill(0));
  const WO = buildProjectionMatrix(409, concat.length || dHead, dHead);
  const combinedOutput = matMul([concat.length ? concat : Array(dHead).fill(0)], WO)[0];

  return {
    words: safeWords,
    tokens,
    embeddings: roundMatrix(embeddings, 4),
    qMatrix: roundMatrix(Q, 4),
    kMatrix: roundMatrix(K, 4),
    vMatrix: roundMatrix(V, 4),
    rawScores: roundMatrix(rawScores, 4),
    scaledScores: roundMatrix(scaledScores, 4),
    attentionWeights: roundMatrix(attentionWeights, 4),
    outputs: roundMatrix(outputs, 4),
    queryIndex,
    qVector: (qVector || []).map((v) => Number(v.toFixed(4))),
    queryRawScores: (rawScores[queryIndex] || []).map((v) => Number(v.toFixed(4))),
    queryScaledScores: (scaledScores[queryIndex] || []).map((v) => (Number.isFinite(v) ? Number(v.toFixed(4)) : v)),
    queryWeights: (attentionWeights[queryIndex] || []).map((v) => Number(v.toFixed(4))),
    queryOutput: (outputs[queryIndex] || []).map((v) => Number(v.toFixed(4))),
    multiHeadMaps,
    combinedOutput: combinedOutput.map((v) => Number(v.toFixed(4)))
  };
}

export function buildHeatmap(tokens, seed = 1) {
  const n = tokens.length;
  const matrix = [];
  for (let r = 0; r < n; r += 1) {
    const row = [];
    for (let c = 0; c < n; c += 1) {
      const val = 0.25 + 0.75 * Math.abs(Math.sin((r + 1) * (c + 1) * (0.18 + seed * 0.03)));
      row.push(Number(val.toFixed(2)));
    }
    matrix.push(row);
  }
  return matrix;
}

export function buildMultiHeadMaps(tokens, heads = 8) {
  return Array.from({ length: heads }, (_, i) => buildHeatmap(tokens, i + 1));
}

export function sinusoidalEncoding(position, dModel = 8) {
  const result = [];
  for (let i = 0; i < dModel; i += 1) {
    const denom = Math.pow(10000, (2 * Math.floor(i / 2)) / dModel);
    if (i % 2 === 0) result.push(Math.sin(position / denom));
    else result.push(Math.cos(position / denom));
  }
  return result;
}

export function applyRoPE(vec, position, theta = 10000) {
  const out = [...vec];
  for (let i = 0; i < vec.length; i += 2) {
    const freq = Math.pow(theta, -i / vec.length);
    const angle = position * freq;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x1 = vec[i] ?? 0;
    const x2 = vec[i + 1] ?? 0;
    out[i] = x1 * c - x2 * s;
    if (i + 1 < vec.length) out[i + 1] = x1 * s + x2 * c;
  }
  return out;
}

export function applyCausalMask(scores) {
  return scores.map((row, i) => row.map((v, j) => (j > i ? Number.NEGATIVE_INFINITY : v)));
}

export function gqaMemoryEstimate({ seqLen = 1024, heads = 32, groupFactor = 8, dim = 128 }) {
  const kvHeads = Math.max(1, Math.floor(heads / groupFactor));
  const full = seqLen * heads * dim * 2;
  const gqa = seqLen * kvHeads * dim * 2;
  const reduction = ((1 - gqa / full) * 100).toFixed(1);
  return { kvHeads, full, gqa, reduction };
}

export function formatPercent(v) {
  return `${(v * 100).toFixed(1)}%`;
}

export function normalizePercentArray(arr) {
  const sum = arr.reduce((a, b) => a + b, 0) || 1;
  return arr.map((v) => Number(((v / sum) * 100).toFixed(1)));
}

export function encodeStateToUrl(state) {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeStateFromUrl(raw) {
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
