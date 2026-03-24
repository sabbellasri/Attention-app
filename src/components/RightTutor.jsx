import { useEffect, useMemo, useState } from "react";
import { Bot, RefreshCw, SendHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const fallbackFreeModels = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-coder:free"
];

function isZeroCost(pricing) {
  if (!pricing) return false;
  return String(pricing.prompt) === "0" && String(pricing.completion) === "0";
}

function supportsTextOutput(model) {
  const outputs = model?.architecture?.output_modalities;
  if (!outputs) return true;
  return outputs.includes("text");
}

async function fetchFreeModelIds() {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) {
    throw new Error("Unable to load model catalog from OpenRouter.");
  }

  const payload = await response.json();
  const freeIds = (payload?.data || [])
    .filter((model) => isZeroCost(model.pricing) && supportsTextOutput(model))
    .map((model) => model.id)
    .filter(Boolean);

  return freeIds.length ? freeIds : fallbackFreeModels;
}

function formatModelLabel(modelId) {
  const maxLen = 42;
  if (modelId.length <= maxLen) return modelId;
  return `${modelId.slice(0, 39)}...`;
}

async function streamOpenRouter({ apiKey, model, messages, onChunk, onDone, onError }) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Attention Educational Tutor"
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages
      })
    });

    if (!response.ok || !response.body) {
      let details = "Streaming request failed.";
      try {
        const errBody = await response.json();
        details = errBody?.error?.message || errBody?.message || details;
      } catch {
        // Keep default details when body is not JSON.
      }
      throw new Error(`${details} (status ${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finished = false;

    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          finished = true;
          break;
        }
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch {
          // Ignore chunk parse errors from partial frames.
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err.message || "Unexpected streaming error");
  }
}

export default function RightTutor({ appState }) {
  const [apiKey, setApiKey] = useState("");
  const [modelOptions, setModelOptions] = useState(fallbackFreeModels);
  const [model, setModel] = useState(fallbackFreeModels[0]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask me anything about attention math. I only use OpenRouter models that are currently free and I include your live state on every question."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const refreshFreeModels = async () => {
    setLoadingModels(true);
    try {
      const ids = await fetchFreeModelIds();
      setModelOptions(ids);
      setModel((prev) => (ids.includes(prev) ? prev : ids[0]));
    } catch {
      setModelOptions(fallbackFreeModels);
      setModel((prev) => (fallbackFreeModels.includes(prev) ? prev : fallbackFreeModels[0]));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Could not refresh the free model list right now, so I switched to a safe fallback list of known free model IDs."
        }
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    refreshFreeModels();
  }, []);

  const statePayload = useMemo(() => JSON.stringify(appState, null, 2), [appState]);

  const submit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !apiKey.trim() || loading) return;

    const userMessage = { role: "user", content: input.trim() };
    const withUser = [...messages, userMessage];
    const tutorIntro =
      "You are an attention tutor. Explain clearly in clean Markdown with short sections, render formulas in KaTeX syntax like $...$ or $$...$$, and avoid raw escaped table characters unless using a valid Markdown table.";

    const outbound = [
      { role: "system", content: tutorIntro },
      {
        role: "system",
        content: `Current app state JSON (always use this context):\n${statePayload}`
      },
      ...withUser
    ];

    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    await streamOpenRouter({
      apiKey,
      model,
      messages: outbound,
      onChunk: (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: `${last.content}${delta}` };
          return copy;
        });
      },
      onDone: () => setLoading(false),
      onError: (errorMessage) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errorMessage}` }]);
        setLoading(false);
      }
    });
  };

  return (
    <aside className="glass col-span-12 lg:col-span-3 rounded-2xl p-4 h-[calc(100vh-7.5rem)] flex flex-col">
      <div className="flex items-center gap-2 text-accent mb-3">
        <Bot size={18} />
        <h2 className="text-sm uppercase tracking-wide">AI Tutor (OpenRouter)</h2>
      </div>

      <p className="text-[11px] text-slate-400 mb-2">
        Free-only mode enabled. You still need a valid OpenRouter API key.
      </p>

      <label className="text-xs text-slate-300 mb-1">API Key</label>
      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-or-v1-..."
        type="password"
        className="mb-2 bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2 text-sm"
      />

      <label className="text-xs text-slate-300 mb-1">Model</label>
      <div className="flex gap-2 mb-3 min-w-0">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 min-w-0 max-w-full bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2 text-sm"
          title={model}
        >
          {modelOptions.map((m) => (
            <option key={m} value={m} title={m}>
              {formatModelLabel(m)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={refreshFreeModels}
          title="Refresh free models"
          className="px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800"
          disabled={loadingModels}
        >
          <RefreshCw size={14} className={loadingModels ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-2 break-all">Selected: {model}</p>

      <div className="flex-1 overflow-auto scrollbar-thin rounded-xl border border-slate-700 bg-slate-950/45 p-3 space-y-2">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`text-sm rounded-xl px-3 py-2 border ${
              m.role === "assistant"
                ? "text-cyan-100 border-cyan-900/50 bg-cyan-950/20"
                : "text-amber-100 border-amber-900/50 bg-amber-950/20"
            }`}
          >
            <div className="font-semibold mb-1">{m.role === "assistant" ? "Tutor" : "You"}</div>
            {m.role === "assistant" ? (
              <div className="tutor-md break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {m.content || "..."}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="break-words whitespace-pre-wrap">{m.content}</div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this step..."
          className="flex-1 bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 rounded-xl border border-cyan-700 bg-cyan-900/40 hover:bg-cyan-800/50 disabled:opacity-50"
        >
          <SendHorizontal size={16} />
        </button>
      </form>
    </aside>
  );
}
