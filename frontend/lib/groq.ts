import type { HouseholdInput } from "./types";

export interface Message { role: "user" | "assistant"; content: string; }

export interface ExtractionResult {
  fields: Partial<HouseholdInput>;
  complete: boolean;
  missingFields: string[];
  fromGroq: boolean;
  error?: "timeout" | "unavailable" | "parse_error";
}

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant for a Kenya smallholder credit scoring tool.
Extract household variables from the loan officer's conversation and return ONLY a JSON object.

Variables to extract (use null if not mentioned):
- total_income_lcu: total annual household income in local currency (KES)
- crop_income_lcu: annual crop income in KES
- livestock_income_lcu: annual livestock income in KES
- offfarm_income_lcu: annual off-farm income in KES
- currency_conversion_lcu_to_ppp: conversion factor (default 90 for KES)
- land_ha: land cultivated in hectares (1 acre = 0.405 ha)
- land_irrigated: true/false — does household irrigate?
- land_tenure: type of land tenure (e.g. "certificate", "communal", "leased")
- cattle: number of cattle
- goats: number of goats
- sheep: number of sheep
- pigs: number of pigs
- chicken: number of chickens
- hh_size: total household members
- edu_level: 0=none, 1=primary, 2=secondary, 3=tertiary
- hh_type: one of "married_couple","woman_single","man_single","polygamous","widowed"
- is_female_headed: true/false
- female_income_control: 0.0 to 1.0 — proportion of income controlled by women
- homegarden: true/false — home kitchen garden?
- agroforestry: true/false — practices agroforestry?
- manage_trees: true/false — manages trees on farm?
- improvedseeds: true/false — uses improved/hybrid seeds?
- crop_count: number of distinct crops grown
- aidreceived: true/false — receives aid/transfers?
- id_proj: project code if known (SRL, CM1, CM2, LTE, G2C, LSE, ESS, LCS, CAN, STU, adn)

Return JSON only. No prose. Example:
{"total_income_lcu": 45000, "crop_income_lcu": 20000, "cattle": 2, "hh_size": 5, ...}`;

const NARRATIVE_SYSTEM_PROMPT = `You are a credit assessment assistant helping Kenyan microfinance loan officers make fast, confident lending decisions for smallholder farmers. You write in plain, direct English. You do not use hyphens to join ideas. You do not use bullet points unless explicitly asked. You write in short, complete sentences of no more than 20 words each. You never use the words "robust", "leverage", "utilise", "holistic", or "streamlined". You do not use colons to introduce lists mid-sentence. When a number matters, you state it plainly. When a risk exists, you name it plainly. You write exactly three paragraphs.

Paragraph 1 — Household snapshot: Who is this farmer? State their segment name, their income level in plain KES or USD PPP, their land and livestock holdings, and their household composition. One to three sentences only.

Paragraph 2 — Key risk and strength: Name the single biggest risk factor for this household and the single strongest protective factor. State each in one sentence. Then state what this means for the repayment likelihood in one sentence. Do not hedge excessively.

Paragraph 3 — Product recommendation: State the recommended product and delivery mechanism in one sentence. State the disbursement timing relative to Kenya's seasonal calendar in one sentence. If the household is female-headed, add one sentence on the gender-lens consideration. End with one sentence on what to monitor at the 30-day and 90-day mark.`;

export async function extractVariables(messages: Message[]): Promise<ExtractionResult> {
  const groqEnabled = process.env.NEXT_PUBLIC_GROQ_ENABLED === "true";
  if (!groqEnabled) return { fields: {}, complete: false, missingFields: ALL_FIELDS, fromGroq: false };

  try {
    const res = await fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: EXTRACTION_SYSTEM_PROMPT }, ...messages],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    const data = await res.json();

    if (res.status === 504) {
      return { fields: {}, complete: false, missingFields: ALL_FIELDS, fromGroq: false, error: "timeout" };
    }
    if (!res.ok) {
      return { fields: {}, complete: false, missingFields: ALL_FIELDS, fromGroq: false, error: "unavailable" };
    }

    const text = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    } catch {
      return { fields: {}, complete: false, missingFields: ALL_FIELDS, fromGroq: false, error: "parse_error" };
    }

    // Drop null/undefined so they don't overwrite values extracted in earlier turns
    const fields = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
    ) as Partial<HouseholdInput>;
    const missingFields = REQUIRED_FIELDS.filter((f) => {
      const v = (fields as Record<string, unknown>)[f];
      return v === null || v === undefined;
    });
    return { fields, complete: missingFields.length === 0, missingFields, fromGroq: true };
  } catch {
    return { fields: {}, complete: false, missingFields: ALL_FIELDS, fromGroq: false, error: "unavailable" };
  }
}

export interface NarrativeResult { text: string; fromGroq: boolean; }

export async function generateNarrative(
  result: {
    probability: number;
    risk_band: string;
    segment_name: string;
    recommended_product: { primary: string; delivery: string };
    top_risk_drivers?: Array<{ label: string; value: number }>;
    unclassified?: boolean;
  },
  inputs: Partial<HouseholdInput>
): Promise<NarrativeResult> {
  const groqEnabled = process.env.NEXT_PUBLIC_GROQ_ENABLED === "true";
  if (!groqEnabled) return { text: buildFallbackNarrative(result), fromGroq: false };

  const totalIncomePPP = inputs.total_income_lcu
    ? Math.round(inputs.total_income_lcu / (inputs.currency_conversion_lcu_to_ppp ?? 90))
    : null;

  const topDrivers = result.top_risk_drivers
    ? result.top_risk_drivers.map((d) => d.label).join(", ")
    : "income level, land and livestock assets";

  const tlu = (
    (inputs.cattle ?? 0) * 0.7 +
    (inputs.goats ?? 0) * 0.1 +
    (inputs.sheep ?? 0) * 0.1 +
    (inputs.pigs ?? 0) * 0.3 +
    (inputs.chicken ?? 0) * 0.01
  ).toFixed(1);

  const householdType = inputs.is_female_headed ? "female-headed" : "male-headed";
  const regionCluster = inputs.id_proj || "unspecified region";

  const userMsg = [
    `Risk probability: ${(result.probability * 100).toFixed(1)}%.`,
    `Risk band: ${result.risk_band}.`,
    `Segment: ${result.segment_name}.`,
    `Top risk drivers: ${topDrivers}.`,
    totalIncomePPP ? `Total income: USD PPP ${totalIncomePPP.toLocaleString()} per year.` : "",
    inputs.total_income_lcu ? `Total income (KES): ${inputs.total_income_lcu.toLocaleString()} per year.` : "",
    inputs.land_ha ? `Land cultivated: ${inputs.land_ha} hectares.` : "",
    `Livestock (TLU, a standard measure of livestock size): ${tlu}.`,
    `Household type: ${householdType}.`,
    `Household size: ${inputs.hh_size ?? "unknown"} members.`,
    `Region: ${regionCluster}.`,
    result.recommended_product?.primary ? `Recommended product: ${result.recommended_product.primary}.` : "",
    result.recommended_product?.delivery ? `Delivery mechanism: ${result.recommended_product.delivery}.` : "",
  ].filter(Boolean).join(" ");

  try {
    const res = await fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: NARRATIVE_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 280,
      }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error();
    return { text, fromGroq: true };
  } catch {
    return { text: buildFallbackNarrative(result), fromGroq: false };
  }
}

function buildFallbackNarrative(r: {
  probability: number;
  risk_band: string;
  segment_name: string;
  recommended_product?: { primary: string };
}) {
  const pct = (r.probability * 100).toFixed(1);
  const bandText =
    r.risk_band === "low"
      ? "a low likelihood of food insecurity"
      : r.risk_band === "medium"
      ? "a moderate likelihood of food insecurity"
      : "a high likelihood of food insecurity";
  return `This household has ${bandText}, with a risk score of ${pct}%. They are classified as ${r.segment_name}. The recommended financial product is ${r.recommended_product?.primary ?? "to be determined"}. This assessment supports your lending decision. It does not replace field officer judgement or institutional lending policy.`;
}

const REQUIRED_FIELDS: (keyof HouseholdInput)[] = [
  "total_income_lcu", "land_ha", "hh_size", "cattle",
  "is_female_headed", "homegarden", "crop_count",
];
const ALL_FIELDS = REQUIRED_FIELDS as string[];
