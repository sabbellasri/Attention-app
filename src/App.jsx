import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import LeftSidebar from "./components/LeftSidebar";
import TopBar from "./components/TopBar";
import RightTutor from "./components/RightTutor";
import VisualizationPanel from "./components/VisualizationPanel";
import { lessonDefaults, lessonMeta, steps } from "./data/steps";
import {
  computeAttentionFromSentence,
  DEFAULT_SENTENCE,
  decodeStateFromUrl,
  encodeStateToUrl,
} from "./utils/attentionMath";

const defaultAdvanced = {
  headCount: lessonDefaults?.advanced?.headCount || 8,
  activeHeads: [0, 1, 2, 3, 4, 5, 6, 7],
  position: lessonDefaults?.advanced?.position || 6,
  ropeTheta: lessonDefaults?.advanced?.ropeTheta || 10000,
  causalMask: lessonDefaults?.advanced?.causalMask ?? true,
  groupFactor: lessonDefaults?.advanced?.groupFactor || 8,
  seqLen: lessonDefaults?.advanced?.seqLen || 1024,
  headDim: lessonDefaults?.advanced?.headDim || 128,
  queryIndex: 0
};

function buildInitialState() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("state");
  if (!raw) {
    return {
      sentence: lessonMeta?.sentenceExample || DEFAULT_SENTENCE,
      currentStep: lessonDefaults?.step || 1,
      advanced: { ...defaultAdvanced }
    };
  }

  const decoded = decodeStateFromUrl(raw);
  if (!decoded) {
    return {
      sentence: lessonMeta?.sentenceExample || DEFAULT_SENTENCE,
      currentStep: lessonDefaults?.step || 1,
      advanced: { ...defaultAdvanced }
    };
  }

  return {
    sentence: decoded.sentence || DEFAULT_SENTENCE,
    currentStep: decoded.currentStep || 1,
    advanced: { ...defaultAdvanced, ...(decoded.advanced || {}) }
  };
}

export default function App() {
  const initial = useMemo(() => buildInitialState(), []);

  const [sentence, setSentence] = useState(initial.sentence);
  const [currentStep, setCurrentStep] = useState(initial.currentStep);
  const [advanced, setAdvanced] = useState(initial.advanced);
  const [visited, setVisited] = useState(new Set([initial.currentStep]));

  const dynamicAttention = useMemo(
    () => computeAttentionFromSentence(sentence, advanced),
    [sentence, advanced]
  );

  const tokens = dynamicAttention.tokens;

  useEffect(() => {
    const maxIdx = Math.max(0, tokens.length - 1);
    if (advanced.queryIndex > maxIdx) {
      setAdvanced((prev) => ({ ...prev, queryIndex: maxIdx }));
    }
  }, [tokens.length, advanced.queryIndex]);

  useEffect(() => {
    setVisited((prev) => new Set(prev).add(currentStep));
    if (currentStep === 16) {
      confetti({ particleCount: 140, spread: 72, origin: { y: 0.65 } });
    }
  }, [currentStep]);

  const appState = {
    sentence,
    tokens,
    currentStep,
    advanced,
    dynamicAttention
  };

  const resetAll = () => {
    setSentence(lessonMeta?.sentenceExample || DEFAULT_SENTENCE);
    setCurrentStep(lessonDefaults?.step || 1);
    setAdvanced({ ...defaultAdvanced });
    setVisited(new Set([lessonDefaults?.step || 1]));
  };

  const onShare = async () => {
    const encoded = encodeStateToUrl(appState);
    const url = `${window.location.origin}${window.location.pathname}?state=${encodeURIComponent(encoded)}`;
    await navigator.clipboard.writeText(url);
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attention-state.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const stepData = steps.find((s) => s.id === currentStep) ?? steps[0];

  return (
    <div className="min-h-screen p-3 md:p-4 lg:p-5">
      <TopBar
        sentence={sentence}
        onSentenceChange={setSentence}
        onReset={resetAll}
        onShare={onShare}
        onExport={onExport}
      />

      <div className="grid grid-cols-12 gap-4">
        <LeftSidebar
          steps={steps}
          currentStep={currentStep}
          visited={visited}
          onStepChange={setCurrentStep}
        />

        <VisualizationPanel
          currentStep={currentStep}
          stepData={stepData}
          tokens={tokens}
          dynamicAttention={dynamicAttention}
          advanced={advanced}
          setAdvanced={setAdvanced}
        />

        <RightTutor appState={appState} />
      </div>
    </div>
  );
}
