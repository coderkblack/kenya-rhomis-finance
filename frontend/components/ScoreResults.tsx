"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { HouseholdInput, ScoreResult } from "@/lib/types";
import { generateNarrative } from "@/lib/groq";
import { PROJECT_TO_REGION, REGION_BY_ID, RISK_FILL } from "@/lib/regions";
import RiskGauge from "./RiskGauge";

const RegionMap = dynamic(() => import("@/components/RegionMap"), { ssr: false });

const MODEL_LABELS: Record<string, string> = {
  gb: "Gradient Boosting (primary)", rf: "Random Forest", xgb: "XGBoost",
  lr: "Logistic Regression", dt: "Decision Tree", stacking: "Stacking Ensemble",
};

const MONTH_LABELS: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April",
  may: "May", jun: "June", jul: "July", aug: "August",
  sep: "September", oct: "October", nov: "November", dec: "December",
};

// Plain-English labels for model feature names
const FEATURE_LABELS: Record<string, string> = {
  log_total_income_ppp: "Total household income",
  asset_index: "Combined land and livestock assets",
  market_orientation: "Proportion of crops sold at market",
  offfarm_income_share: "Share of income from off-farm work",
  land_per_member: "Land available per household member",
  edu_level: "Education level of the household head",
  is_female_headed: "Female-headed household",
  livestock_tlu_capped: "Livestock holdings",
  land_cultivated_ha_capped: "Land farmed",
  income_div_index: "Income diversity (number of income types)",
  asset_x_market: "Asset base combined with market activity",
  livestock_income_share: "Share of income from livestock",
  hh_size_members: "Number of household members",
  land_formal: "Formal land title",
  has_homegarden: "Has a home garden",
  has_irrigation: "Uses irrigation",
  manages_trees: "Manages trees on farm",
  has_agroforestry: "Practices agroforestry",
  receives_aid: "Receives aid or transfers",
  agric_modern_index: "Level of agricultural modernisation",
  resilience_buffer: "Resilience buffer (garden, trees, agroforestry)",
  crop_count_num: "Number of different crops grown",
  cattle_tlu_capped: "Cattle holdings",
  small_ruminant_tlu_capped: "Goat and sheep holdings",
  female_income_control: "Proportion of income controlled by women",
  hh_type_encoded: "Household type",
};

interface Props {
  result: ScoreResult;
  inputs?: Partial<HouseholdInput>;
}

function bandSentence(band: string): string {
  if (band === "low") {
    return `This household has a low likelihood of food insecurity. It is a reasonable candidate for market-rate credit, subject to your institution's policy.`;
  }
  if (band === "medium") {
    return `This household has a moderate likelihood of food insecurity. Consider a smaller initial loan amount with close monitoring at 30 and 90 days.`;
  }
  return `This household has a high likelihood of food insecurity. Standard market-rate credit carries significant risk. Consider a savings-linked product or a graduated pathway before extending credit.`;
}

export default function ScoreResults({ result, inputs = {} }: Props) {
  const [tab, setTab] = useState<"risk" | "segment" | "product" | "map" | "brief">("risk");
  const [narrative, setNarrative] = useState<string>("");
  const [narrativeSource, setNarrativeSource] = useState<"groq" | "fallback" | "loading">("loading");
  const [modelsExpanded, setModelsExpanded] = useState(true);

  const region = inputs.id_proj ? PROJECT_TO_REGION[inputs.id_proj] : undefined;
  const regionProfile = region ? REGION_BY_ID[region] : undefined;

  useEffect(() => {
    setNarrativeSource("loading");
    generateNarrative(result, inputs).then((n) => {
      setNarrative(n.text);
      setNarrativeSource(n.fromGroq ? "groq" : "fallback");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.segment, result.probability]);

  const tabs = [
    { id: "risk",    label: "Risk score" },
    { id: "segment", label: "Segment"    },
    { id: "product", label: "Product"    },
    { id: "map",     label: "Map"        },
    { id: "brief",   label: "Assessment" },
  ] as const;

  const hungerGap = MONTH_LABELS[result.hunger_gap_month] ?? result.hunger_gap_month;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap px-2 ${
              tab === t.id
                ? "border-b-2 border-green-700 text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* ── Risk ──────────────────────────────────────────────────── */}
        {tab === "risk" && (
          <div className="space-y-6">
            {/* Dominant risk band display */}
            <div className="flex flex-col items-center gap-3">
              <RiskGauge
                probability={result.probability}
                color={result.risk_band_color}
                band={result.risk_band}
              />
              <p className="text-sm text-center text-gray-600 max-w-xs leading-relaxed">
                {bandSentence(result.risk_band)}
              </p>
              {result.unclassified && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  This household could not be assigned to a segment. The risk score is still valid, but segment-based product recommendations are unavailable.
                </div>
              )}
            </div>

            {/* Segment + product — shown prominently before model details */}
            {!result.unclassified && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-sm">
                  <span className="font-semibold text-gray-700">Farmer segment: </span>
                  <span className="text-gray-800">{result.segment_name}</span>
                </p>
                {result.recommended_product?.primary && (
                  <p className="text-sm">
                    <span className="font-semibold text-green-700">Recommended product: </span>
                    <span className="text-gray-800">{result.recommended_product.primary}</span>
                  </p>
                )}
                {result.recommended_product?.delivery && (
                  <p className="text-xs text-gray-500">Delivery: {result.recommended_product.delivery}</p>
                )}
              </div>
            )}

            {/* Top risk drivers */}
            {result.top_risk_drivers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Key factors driving this score</h4>
                <div className="space-y-2">
                  {result.top_risk_drivers.map((d) => {
                    const label = FEATURE_LABELS[d.feature] ?? d.label;
                    return (
                      <div key={d.feature} className="flex justify-between items-center text-sm gap-3">
                        <span className="text-gray-700">{label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-green-600"
                              style={{ width: `${Math.min(100, d.importance * 500)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Model comparison — collapsed by default */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setModelsExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium">Technical details — model votes</span>
                <span className="text-gray-400">{modelsExpanded ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {modelsExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 pt-3">
                    This score combines four separate models. The Random Forest score is used as the primary result. You can see how each model voted below.
                  </p>
                  <div className="space-y-2">
                    {Object.entries(result.model_scores).map(([key, prob]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-36">{MODEL_LABELS[key] ?? key}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${(prob * 100).toFixed(1)}%`,
                              backgroundColor: key === "rf" ? result.risk_band_color : "#94a3b8",
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono w-12 text-right">{(prob * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Primary score from Random Forest. Other models shown for reference only.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Segment ────────────────────────────────────────────────── */}
        {tab === "segment" && (
          <div className="space-y-4">
            {result.unclassified ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                This household could not be assigned to a segment. Check that livestock and land data were entered correctly.
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <div className="text-4xl font-black text-green-700 leading-none">
                    {result.segment_name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{result.segment_name}</h3>
                    <p className="text-sm text-gray-500">
                      {result.segment_profile.pct?.toFixed(1)}% of Kenya households surveyed
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Combined assets", result.segment_profile.asset_index?.toFixed(2)],
                    ["Crops sold at market", (result.segment_profile.market_orientation * 100)?.toFixed(0) + "%"],
                    ["Average livestock (TLU, a standard measure of livestock size)", result.segment_profile.livestock_tlu_capped?.toFixed(1)],
                    ["Average land farmed (hectares)", result.segment_profile.land_cultivated_ha_capped?.toFixed(2)],
                    ["Level of agricultural modernisation (0 to 4)", result.segment_profile.agric_modern_index?.toFixed(1)],
                    ["Female-headed households in this segment", result.segment_profile.female_headed_pct?.toFixed(0) + "%"],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="font-semibold text-gray-800">{val}</div>
                    </div>
                  ))}
                </div>

                {hungerGap && hungerGap !== "unknown" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <span className="font-semibold">Hunger gap month: </span>{hungerGap}. Time loans to disburse before this month to give the household access to funds when food is scarce.
                  </div>
                )}

                {result.is_female_headed && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
                    This is a female-headed household. Consider women-led group lending products such as VSLA or chama structures.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Product ────────────────────────────────────────────────── */}
        {tab === "product" && (
          <div className="space-y-4">
            {result.unclassified ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                No product recommendation is available for an unclassified household. Use the risk score and your field judgement to make a lending decision.
              </div>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h3 className="font-bold text-green-900 text-lg">{result.recommended_product.primary}</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Delivery: <span className="font-medium">{result.recommended_product.delivery}</span>
                  </p>
                </div>

                <div className="text-sm text-gray-600 space-y-2">
                  <p>
                    <span className="font-medium">Farmer segment: </span>{result.segment_name}. {segmentProductNote(result.segment_name)}
                  </p>
                  {hungerGap && hungerGap !== "unknown" && (
                    <p>
                      <span className="font-medium">Repayment timing: </span>
                      Align repayments with post-harvest cash flow. Avoid scheduling repayments in <strong>{hungerGap}</strong>, when this segment typically faces the most food stress.
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 border">
                  This recommendation is decision support only. Final credit decisions must include your field assessment and compliance with your institution&apos;s lending policy.
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Map ────────────────────────────────────────────────────── */}
        {tab === "map" && (
          <div className="space-y-4">
            {regionProfile ? (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{regionProfile.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{regionProfile.description}</p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: RISK_FILL[regionProfile.typicalRisk] + "20", color: RISK_FILL[regionProfile.typicalRisk] }}
                >
                  {regionProfile.typicalRisk} typical risk
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No region identified from the project code. All zones are shown.</p>
            )}

            <RegionMap highlightRegion={region} height={300} />

            {/* Map legend */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2">
              <p className="font-semibold text-gray-600">Map legend</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block bg-green-600" />
                  <span className="text-gray-600">Low typical risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block bg-amber-500" />
                  <span className="text-gray-600">Medium typical risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block bg-red-600" />
                  <span className="text-gray-600">High typical risk</span>
                </div>
              </div>
              <p className="text-gray-400">Circle size shows approximate household coverage in the RHoMIS survey data. Larger circles mean more households were surveyed in that region. The highlighted region matches the project code you entered.</p>
            </div>

            {regionProfile && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 mb-0.5">Common livelihoods</p>
                  <p className="text-gray-700">{regionProfile.livelihoods}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 mb-0.5">Key challenges</p>
                  <p className="text-gray-700">{regionProfile.challenges}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Assessment summary (Briefing) ──────────────────────────── */}
        {tab === "brief" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Assessment summary</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                narrativeSource === "groq"
                  ? "bg-blue-100 text-blue-700"
                  : narrativeSource === "fallback"
                  ? "bg-gray-100 text-gray-500"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {narrativeSource === "groq" ? "AI generated" : narrativeSource === "fallback" ? "Template" : "Loading…"}
              </span>
            </div>

            {narrativeSource === "loading" ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/6" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {narrative.split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} className="text-gray-700 leading-relaxed mb-3 last:mb-0">{para}</p>
                ))}
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
              This summary is generated to support your lending decision. It does not replace your field assessment or your institution&apos;s credit policy.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function segmentProductNote(name: string): string {
  if (name.startsWith("A")) return "Commercial producers benefit from offtake-linked value chain finance delivered through M-Pesa aggregators.";
  if (name.startsWith("B")) return "Diversified transitional households suit M-Pesa-linked chama or SACCO group lending.";
  if (name.startsWith("D")) return "Vulnerable subsistence households are better served by cash transfer support with a graduation pathway to M-Shwari savings before credit.";
  if (name.startsWith("C")) return "Asset-rich agropastoral households qualify for TLU-backed credit combined with livestock insurance.";
  return "See the segment profile for full product details.";
}
