"use client";
import { useReducer, useRef, useEffect, useState } from "react";
import type { HouseholdInput, ScoreResult } from "@/lib/types";
import { DEFAULT_INPUT } from "@/lib/types";
import { scoreHousehold } from "@/lib/api";
import { extractVariables, type Message } from "@/lib/groq";
import ScoreResults from "@/components/ScoreResults";

// ── Plain-English field labels for the "What we understood" display ───────────
const FIELD_LABELS: Record<string, string> = {
  total_income_lcu: "Total household income (KES/year)",
  crop_income_lcu: "Crop sales income (KES/year)",
  livestock_income_lcu: "Livestock sales income (KES/year)",
  offfarm_income_lcu: "Off-farm income (KES/year)",
  land_ha: "Land farmed (hectares)",
  land_irrigated: "Uses irrigation",
  land_tenure: "Land tenure type",
  cattle: "Cattle",
  goats: "Goats",
  sheep: "Sheep",
  pigs: "Pigs",
  chicken: "Chickens",
  hh_size: "Household members",
  edu_level: "Education level of household head",
  hh_type: "Household type",
  is_female_headed: "Female-headed household",
  female_income_control: "Proportion of income controlled by women",
  homegarden: "Has home garden",
  agroforestry: "Practices agroforestry",
  manage_trees: "Manages trees on farm",
  improvedseeds: "Uses improved seeds",
  crop_count: "Number of crops grown",
  aidreceived: "Receives aid or transfers",
  id_proj: "Region or project code",
};

const REQUIRED_LABELS: Record<string, string> = {
  total_income_lcu: "the household's total annual income in KES",
  land_ha: "the size of land farmed in hectares or acres",
  hh_size: "the number of people in the household",
  cattle: "the number of cattle (or other livestock)",
};

// ── State machine ──────────────────────────────────────────────────────────────
type Phase = "IDLE" | "WAITING_FOR_INPUT" | "EXTRACTING" | "CONFIRMING" | "SCORING" | "COMPLETE" | "ERROR";

interface AppState {
  phase: Phase;
  qIdx: number;
  messages: Message[];
  extracted: Partial<HouseholdInput>;
  confirmed: HouseholdInput;
  originalTexts: string[];
  result: ScoreResult | null;
  error: string;
  extractionError: "timeout" | "unavailable" | "parse_error" | null;
  missingRequiredFields: string[];
}

type Action =
  | { type: "START" }
  | { type: "USER_SENT"; text: string }
  | { type: "EXTRACTION_SUCCESS"; fields: Partial<HouseholdInput>; missingFields: string[] }
  | { type: "EXTRACTION_ERROR"; error: "timeout" | "unavailable" | "parse_error" }
  | { type: "ALL_QUESTIONS_DONE"; merged: HouseholdInput; missingRequired: string[] }
  | { type: "CONFIRM_FIELD"; key: keyof HouseholdInput; value: unknown }
  | { type: "SCORE_START" }
  | { type: "SCORE_SUCCESS"; result: ScoreResult }
  | { type: "SCORE_ERROR"; message: string }
  | { type: "RESET" };

const QUESTIONS = [
  "How large is this household? How many people live there, and who heads it?",
  "How much land does the household farm? Give the size in acres or hectares and whether the title is owned, communal, or leased. Is any of it irrigated?",
  "What livestock does the household keep? Give counts for cattle, goats, sheep, pigs, and chickens.",
  "What are the income sources? Give approximate annual amounts in KES for crop sales, livestock sales, off-farm work, and the total if you know it.",
  "What farming practices do they use? Mention any home garden, agroforestry, tree management, or improved seeds. How many different crops do they grow? Do they receive any aid or transfers?",
  "What is the highest education level of the household head, and roughly what share of income do women in the household control?",
];

const initialState: AppState = {
  phase: "IDLE",
  qIdx: 0,
  messages: [],
  extracted: {},
  confirmed: { ...DEFAULT_INPUT },
  originalTexts: [],
  result: null,
  error: "",
  extractionError: null,
  missingRequiredFields: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        phase: "WAITING_FOR_INPUT",
        messages: [{ role: "assistant", content: QUESTIONS[0] }],
      };
    case "USER_SENT":
      return {
        ...state,
        phase: "EXTRACTING",
        messages: [...state.messages, { role: "user", content: action.text }],
        originalTexts: [...state.originalTexts, action.text],
      };
    case "EXTRACTION_SUCCESS": {
      const merged = { ...state.extracted, ...action.fields };
      const nextQ = state.qIdx + 1;
      if (nextQ < QUESTIONS.length) {
        return {
          ...state,
          phase: "WAITING_FOR_INPUT",
          qIdx: nextQ,
          extracted: merged,
          extractionError: null,
          messages: [
            ...state.messages,
            { role: "assistant", content: QUESTIONS[nextQ] },
          ],
        };
      }
      // All questions answered — move to confirming
      const confirmedMerged: HouseholdInput = { ...DEFAULT_INPUT, ...merged };
      const missingRequired = Object.keys(REQUIRED_LABELS).filter((f) => {
        const v = (confirmedMerged as unknown as Record<string, unknown>)[f];
        return v === 0 || v === null || v === undefined;
      });
      return {
        ...state,
        phase: "CONFIRMING",
        extracted: merged,
        confirmed: confirmedMerged,
        missingRequiredFields: missingRequired,
        extractionError: null,
        messages: [
          ...state.messages,
          { role: "assistant", content: "Thank you. Please check the values below before scoring." },
        ],
      };
    }
    case "EXTRACTION_ERROR":
      return {
        ...state,
        phase: "WAITING_FOR_INPUT",
        extractionError: action.error,
      };
    case "ALL_QUESTIONS_DONE":
      return {
        ...state,
        phase: "CONFIRMING",
        confirmed: action.merged,
        missingRequiredFields: action.missingRequired,
      };
    case "CONFIRM_FIELD":
      return {
        ...state,
        confirmed: { ...state.confirmed, [action.key]: action.value },
        missingRequiredFields: state.missingRequiredFields.filter((f) => {
          if (f !== action.key) return true;
          return action.value === 0 || action.value === null || action.value === undefined;
        }),
      };
    case "SCORE_START":
      return { ...state, phase: "SCORING", error: "" };
    case "SCORE_SUCCESS":
      return { ...state, phase: "COMPLETE", result: action.result };
    case "SCORE_ERROR":
      return { ...state, phase: "ERROR", error: action.message };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

export default function IntakePage() {
  const groqEnabled = process.env.NEXT_PUBLIC_GROQ_ENABLED === "true";
  const [state, dispatch] = useReducer(reducer, initialState);
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groqEnabled) dispatch({ type: "START" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groqEnabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.phase]);

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || state.phase !== "WAITING_FOR_INPUT") return;
    setInputText("");
    dispatch({ type: "USER_SENT", text });

    const newMessages: Message[] = [...state.messages, { role: "user", content: text }];
    const { fields, fromGroq, error: extractErr } = await extractVariables(newMessages);

    if (!fromGroq || extractErr) {
      dispatch({ type: "EXTRACTION_ERROR", error: extractErr ?? "unavailable" });
      return;
    }

    dispatch({ type: "EXTRACTION_SUCCESS", fields, missingFields: [] });
  }

  async function handleScore() {
    dispatch({ type: "SCORE_START" });
    try {
      const res = await scoreHousehold(state.confirmed);
      dispatch({ type: "SCORE_SUCCESS", result: res });
    } catch (e) {
      dispatch({
        type: "SCORE_ERROR",
        message: e instanceof Error
          ? `Scoring failed: ${e.message}. Check that the backend server is running, then try again.`
          : "Scoring failed. Check that the backend server is running, then try again.",
      });
    }
  }

  if (!groqEnabled) {
    return (
      <div className="max-w-xl mx-auto text-center py-24 space-y-4">
        <p className="text-gray-700 font-medium">Conversational intake requires a Groq API key.</p>
        <p className="text-sm text-gray-500">
          Add <code className="bg-gray-100 px-1 rounded">GROQ_API_KEY</code> to your{" "}
          <code className="bg-gray-100 px-1 rounded">.env.local</code> file and set{" "}
          <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_GROQ_ENABLED=true</code>. Then restart the development server.
        </p>
        <a href="/score" className="inline-block bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors">
          Use the manual form instead
        </a>
      </div>
    );
  }

  const isLoading = state.phase === "EXTRACTING" || state.phase === "SCORING";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversational intake</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Describe the farmer&apos;s household as you would in a field note. The assistant extracts the data needed for scoring.
          </p>
        </div>
        {state.phase !== "IDLE" && (
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            Clear and start over
          </button>
        )}
      </div>

      {/* Chat */}
      {(state.phase === "WAITING_FOR_INPUT" || state.phase === "EXTRACTING") && (
        <>
          {/* Progress */}
          <div className="flex gap-1.5 items-center">
            {QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < state.qIdx ? "bg-green-600" : i === state.qIdx ? "bg-green-300" : "bg-gray-200"
              }`} />
            ))}
            <span className="text-xs text-gray-400 ml-1 shrink-0">
              Question {state.qIdx + 1} of {QUESTIONS.length}
            </span>
          </div>

          {/* Helper card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">How to answer</p>
            <p>Describe the farmer&apos;s household as you would in a field note. Include income sources, land size, livestock, and family situation. You can speak naturally — no need to use exact numbers in every answer.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: "380px" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {state.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-green-700 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {/* Extraction error messages */}
              {state.extractionError === "timeout" && (
                <div className="flex justify-start">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%]">
                    The AI service took too long to respond. Your answer was not lost. Please try sending it again.
                  </div>
                </div>
              )}
              {state.extractionError === "unavailable" && (
                <div className="flex justify-start">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%]">
                    The AI service could not be reached. You can continue answering and fill in any missed values manually in the review step.
                  </div>
                </div>
              )}
              {state.extractionError === "parse_error" && (
                <div className="flex justify-start">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%]">
                    The AI returned an unexpected response. Please try rephrasing your answer with specific numbers for the key values.
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-gray-200 p-3 flex gap-2">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type your answer…"
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputText.trim()}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-40 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirm phase */}
      {state.phase === "CONFIRMING" && (
        <div className="space-y-5">
          {/* Side-by-side: original text vs extracted values */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">What you described</h3>
              <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
                {state.originalTexts.map((t, i) => (
                  <p key={i} className="text-xs text-gray-500 border-b border-gray-100 pb-2 last:border-0">
                    <span className="text-gray-400 font-medium">Q{i + 1}:</span> {t}
                  </p>
                ))}
              </div>
            </div>
            <div className="bg-white border border-green-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-1">What we understood</h3>
              <p className="text-xs text-gray-500 mb-3">Check these values before scoring. Correct anything that looks wrong.</p>
              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {Object.entries(state.extracted).map(([k, v]) => (
                  v !== null && v !== undefined && (
                    <div key={k} className="flex justify-between gap-2 border-b border-gray-50 py-0.5">
                      <span className="text-gray-500">{FIELD_LABELS[k] ?? k}</span>
                      <span className="font-medium text-gray-800">{String(v)}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>

          {/* Missing required field warnings */}
          {state.missingRequiredFields.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-800">Some required values are missing</p>
              {state.missingRequiredFields.map((f) => (
                <p key={f} className="text-xs text-amber-700">
                  We could not find {REQUIRED_LABELS[f] ?? f}. Please enter it in the table below before scoring.
                </p>
              ))}
            </div>
          )}

          {/* Editable confirm table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Review and correct all values</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {(Object.entries(state.confirmed) as [keyof HouseholdInput, unknown][])
                    .filter(([k]) => !["ppi_likelihood", "has_debt", "currency_conversion_lcu_to_ppp"].includes(k))
                    .map(([key, val]) => (
                      <tr key={key} className={state.missingRequiredFields.includes(key) ? "bg-amber-50" : ""}>
                        <td className="px-4 py-2 text-gray-600 text-xs w-1/2">
                          {FIELD_LABELS[key] ?? key}
                          {state.missingRequiredFields.includes(key) && (
                            <span className="ml-1 text-amber-600 font-semibold">*</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {typeof val === "boolean" ? (
                            <select
                              value={String(val)}
                              onChange={(e) => dispatch({ type: "CONFIRM_FIELD", key, value: e.target.value === "true" })}
                              className="border border-gray-200 rounded px-2 py-1 text-xs"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={typeof val === "number" ? "number" : "text"}
                              value={val === null || val === undefined ? "" : String(val)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = typeof val === "number" ? (raw === "" ? 0 : parseFloat(raw)) : raw;
                                dispatch({ type: "CONFIRM_FIELD", key, value: parsed });
                              }}
                              className="border border-gray-200 rounded px-2 py-1 text-xs w-full"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleScore}
              disabled={state.missingRequiredFields.length > 0}
              title={state.missingRequiredFields.length > 0 ? "Fill in the required fields above before scoring" : ""}
              className="flex-1 bg-green-700 text-white font-semibold py-3 rounded-xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm and score this household
            </button>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
            >
              Clear and start over
            </button>
          </div>
        </div>
      )}

      {/* Scoring */}
      {state.phase === "SCORING" && (
        <div className="text-center py-16 text-gray-400 space-y-3">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="font-medium">Scoring this household…</p>
        </div>
      )}

      {/* Error */}
      {state.phase === "ERROR" && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{state.error}</div>
          <button onClick={() => dispatch({ type: "RESET" })} className="text-sm text-green-700 hover:underline">
            Start over
          </button>
        </div>
      )}

      {/* Results */}
      {state.phase === "COMPLETE" && state.result && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Risk assessment complete</h2>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="text-sm text-green-700 hover:underline"
            >
              Score another household
            </button>
          </div>
          <ScoreResults result={state.result} inputs={state.confirmed} />
        </div>
      )}
    </div>
  );
}
