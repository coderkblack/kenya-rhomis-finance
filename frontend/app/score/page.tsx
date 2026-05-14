"use client";
import { useState } from "react";
import type { HouseholdInput, ScoreResult } from "@/lib/types";
import { scoreHousehold } from "@/lib/api";
import { DEFAULT_INPUT } from "@/lib/types";
import ScoreResults from "@/components/ScoreResults";

type Step = "income" | "land" | "livestock" | "demographics" | "practices";
const STEPS: Step[] = ["income", "land", "livestock", "demographics", "practices"];
const STEP_LABELS: Record<Step, string> = {
  income: "Household income",
  land: "Land and region",
  livestock: "Livestock",
  demographics: "Household members",
  practices: "Farming practices",
};

function computeTLU(inp: HouseholdInput) {
  return inp.cattle * 0.7 + inp.goats * 0.1 + inp.sheep * 0.1 + inp.pigs * 0.3 + inp.chicken * 0.01;
}

interface FieldProps {
  label: string;
  hint?: string;
  rangeNote?: string;
  children: React.ReactNode;
}
function Field({ label, hint, rangeNote, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
      {rangeNote && (
        <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mt-1">{rangeNote}</p>
      )}
    </div>
  );
}

function NumInput({ value, onChange, min = 0, step = 1, placeholder = "0" }: {
  value: number | null; onChange: (v: number) => void; min?: number; step?: number; placeholder?: string;
}) {
  return (
    <input
      type="number" min={min} step={step}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-green-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? "left-5" : "left-1"}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function incomeValidationError(inp: HouseholdInput): string | null {
  const componentSum = inp.crop_income_lcu + inp.livestock_income_lcu + inp.offfarm_income_lcu;
  if (inp.total_income_lcu > 0 && componentSum > inp.total_income_lcu * 1.1) {
    return `The sum of crop (${inp.crop_income_lcu.toLocaleString()} KES), livestock (${inp.livestock_income_lcu.toLocaleString()} KES), and off-farm income (${inp.offfarm_income_lcu.toLocaleString()} KES) adds up to ${componentSum.toLocaleString()} KES. This exceeds the total income of ${inp.total_income_lcu.toLocaleString()} KES by more than 10%. Check all income figures before submitting.`;
  }
  return null;
}

function plainEnglishSummary(inp: HouseholdInput): string {
  const tlu = computeTLU(inp).toFixed(1);
  const hhDesc = inp.is_female_headed
    ? `female-headed household of ${inp.hh_size} members`
    : `household of ${inp.hh_size} members`;
  const hhTypeLabels: Record<string, string> = {
    married_couple: "married couple", polygamous: "polygamous family",
    woman_single: "woman (single or divorced)", man_single: "man (single or divorced)", widowed: "widowed",
  };
  const hhType = hhTypeLabels[inp.hh_type] ?? inp.hh_type;
  const totalIncome = inp.total_income_lcu > 0
    ? `Total household income is ${inp.total_income_lcu.toLocaleString()} KES per year.`
    : "No total income was entered.";
  const incomeBreakdown = [
    inp.crop_income_lcu > 0 ? `crop sales (${inp.crop_income_lcu.toLocaleString()} KES)` : null,
    inp.livestock_income_lcu > 0 ? `livestock sales (${inp.livestock_income_lcu.toLocaleString()} KES)` : null,
    inp.offfarm_income_lcu > 0 ? `off-farm work (${inp.offfarm_income_lcu.toLocaleString()} KES)` : null,
  ].filter(Boolean);
  const incomeDesc = incomeBreakdown.length > 0
    ? `Income sources include ${incomeBreakdown.join(", ")}.`
    : "No income source breakdown was entered.";
  const landDesc = inp.land_ha > 0
    ? `The household farms ${inp.land_ha} hectares${inp.land_irrigated ? " with irrigation" : ""}.`
    : "No land size was entered.";
  const livestockDesc = parseFloat(tlu) > 0
    ? `Livestock holdings total ${tlu} TLU (Tropical Livestock Units, a standard measure of livestock size and value), including ${[
        inp.cattle > 0 ? `${inp.cattle} cattle` : null,
        inp.goats > 0 ? `${inp.goats} goats` : null,
        inp.sheep > 0 ? `${inp.sheep} sheep` : null,
        inp.pigs > 0 ? `${inp.pigs} pigs` : null,
        inp.chicken > 0 ? `${inp.chicken} chickens` : null,
      ].filter(Boolean).join(", ")}.`
    : "No livestock was entered.";

  return [
    `This is a ${hhType} — a ${hhDesc}.`,
    totalIncome,
    incomeDesc,
    landDesc,
    livestockDesc,
  ].join(" ");
}

export default function ScorePage() {
  const [step, setStep] = useState<Step>("income");
  const [inp, setInp] = useState<HouseholdInput>({ ...DEFAULT_INPUT });
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof HouseholdInput>(key: K, val: HouseholdInput[K]) {
    setInp(prev => ({ ...prev, [key]: val }));
  }

  const stepIdx = STEPS.indexOf(step);
  const isLastStep = stepIdx === STEPS.length - 1;

  async function handleSubmit() {
    const validationErr = incomeValidationError(inp);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await scoreHousehold(inp);
      setResult(res);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message.includes("income")
          ? e.message
          : "The scoring service could not be reached. Check that the backend server is running, then try again."
        );
      } else {
        setError("Scoring failed. Check that the backend server is running, then try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const tluValue = computeTLU(inp);
  const incomeError = step === "income" ? incomeValidationError(inp) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Score a household</h1>
        <p className="text-gray-500 mt-1">Enter household data across five steps to receive a food-insecurity risk score and farmer segment.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-5">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">
                Step {stepIdx + 1} of {STEPS.length} — {STEP_LABELS[step]}
              </span>
              <span className="text-xs text-gray-400">{STEPS.length - stepIdx - 1} step{STEPS.length - stepIdx - 1 !== 1 ? "s" : ""} remaining</span>
            </div>
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i < stepIdx ? "bg-green-600" :
                    i === stepIdx ? "bg-green-400" : "bg-gray-200"
                  }`}
                  title={STEP_LABELS[s]}
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

            {/* INCOME */}
            {step === "income" && <>
              <Field
                label="Total annual household income (KES)"
                hint="Include all sources — crops, livestock, and any work outside the farm"
                rangeNote="Most Kenya smallholder households earn between 20,000 and 300,000 KES per year."
              >
                <NumInput value={inp.total_income_lcu} onChange={v => set("total_income_lcu", v)} step={1000} />
              </Field>
              <Field
                label="Income from crop sales (KES per year)"
                rangeNote="Crop income is often 30 to 70% of total income for mixed farming households."
              >
                <NumInput value={inp.crop_income_lcu} onChange={v => set("crop_income_lcu", v)} step={1000} />
              </Field>
              <Field
                label="Income from livestock sales (KES per year)"
                rangeNote="Livestock income varies widely. Pastoralist households may earn 50,000 KES or more."
              >
                <NumInput value={inp.livestock_income_lcu} onChange={v => set("livestock_income_lcu", v)} step={1000} />
              </Field>
              <Field
                label="Income from off-farm work (KES per year)"
                hint="Includes employment, casual labour, petty trade, and remittances"
                rangeNote="Off-farm income above 20% of total income is a positive sign for loan repayment."
              >
                <NumInput value={inp.offfarm_income_lcu} onChange={v => set("offfarm_income_lcu", v)} step={1000} />
              </Field>
              <Field
                label="Currency conversion factor (KES to USD PPP)"
                hint="Leave at 90 for Kenya shillings. PPP means Purchasing Power Parity — a way to compare incomes across countries."
              >
                <NumInput value={inp.currency_conversion_lcu_to_ppp} onChange={v => set("currency_conversion_lcu_to_ppp", v)} step={1} />
              </Field>
              {incomeError && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800">
                  {incomeError}
                </div>
              )}
            </>}

            {/* LAND */}
            {step === "land" && <>
              <Field
                label="Land cultivated (hectares)"
                hint="1 acre equals 0.405 hectares. 1 hectare equals 2.47 acres."
                rangeNote="Most Kenya smallholders farm between 0.2 and 3 hectares."
              >
                <NumInput value={inp.land_ha} onChange={v => set("land_ha", v)} step={0.1} />
              </Field>
              <Field
                label="Land tenure type"
                hint="Enter 'certificate' if the household holds a formal title deed."
              >
                <input type="text" value={inp.land_tenure}
                  onChange={e => set("land_tenure", e.target.value)}
                  placeholder="e.g. certificate, communal, leased"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </Field>
              <Toggle value={inp.land_irrigated} onChange={v => set("land_irrigated", v)} label="Household uses irrigation" />
              <Field
                label="Project or region code"
                hint="Enter the code for the area where this household is located."
                rangeNote="Valid codes: SRL, CM1, CM2, LTE, G2C, LSE, ESS, LCS, CAN, STU, adn"
              >
                <input type="text" value={inp.id_proj}
                  onChange={e => set("id_proj", e.target.value)}
                  placeholder="e.g. CM1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </Field>
            </>}

            {/* LIVESTOCK */}
            {step === "livestock" && <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-0.5">
                  Livestock holdings: {tluValue.toFixed(2)} TLU (Tropical Livestock Units, a standard measure of livestock size and value)
                </p>
                <p className="text-xs text-blue-600">
                  This updates as you enter animal counts. Most Kenya smallholders hold between 0.5 and 5 TLU.
                </p>
              </div>
              {([
                ["Number of cattle", "cattle",  0.70, "Each cow or bull equals 0.7 TLU."],
                ["Number of goats",  "goats",   0.10, "Each goat equals 0.1 TLU."],
                ["Number of sheep",  "sheep",   0.10, "Each sheep equals 0.1 TLU."],
                ["Number of pigs",   "pigs",    0.30, "Each pig equals 0.3 TLU."],
                ["Number of chickens","chicken", 0.01, "Each chicken equals 0.01 TLU."],
              ] as [string, keyof HouseholdInput, number, string][]).map(([label, key, , rangeNote]) => (
                <Field key={key} label={label} rangeNote={rangeNote}>
                  <NumInput value={inp[key] as number} onChange={v => set(key, v)} />
                </Field>
              ))}
            </>}

            {/* DEMOGRAPHICS */}
            {step === "demographics" && <>
              <Field
                label="Total number of household members"
                rangeNote="Kenya smallholder households typically have 4 to 8 members."
              >
                <NumInput value={inp.hh_size} onChange={v => set("hh_size", v)} min={1} />
              </Field>
              <Field label="Household type">
                <select value={inp.hh_type} onChange={e => set("hh_type", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {[
                    ["married_couple","Married couple"],
                    ["polygamous","Polygamous family"],
                    ["woman_single","Woman (single or divorced)"],
                    ["man_single","Man (single or divorced)"],
                    ["widowed","Widowed"],
                  ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Highest education level of the household head">
                <select value={inp.edu_level ?? 2} onChange={e => set("edu_level", parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value={0}>None or not literate</option>
                  <option value={1}>Primary school</option>
                  <option value={2}>Secondary school</option>
                  <option value={3}>Tertiary or university</option>
                </select>
              </Field>
              <Toggle value={inp.is_female_headed} onChange={v => set("is_female_headed", v)} label="Female-headed household" />
              <Field
                label="Proportion of household income controlled by women (0 to 100%)"
                hint="Move the slider to show the percentage of income managed by women in this household."
              >
                <input type="range" min={0} max={1} step={0.1} value={inp.female_income_control}
                  onChange={e => set("female_income_control", parseFloat(e.target.value))}
                  className="w-full accent-green-600" />
                <span className="text-xs text-gray-500">{(inp.female_income_control * 100).toFixed(0)}%</span>
              </Field>
            </>}

            {/* PRACTICES */}
            {step === "practices" && <>
              <Field
                label="Number of different crops grown"
                rangeNote="Growing 3 or more crops reduces food insecurity risk."
              >
                <NumInput value={inp.crop_count} onChange={v => set("crop_count", v)} />
              </Field>
              {([
                ["homegarden",    "Has a home or kitchen garden"],
                ["agroforestry",  "Practices agroforestry (trees with crops or livestock)"],
                ["manage_trees",  "Actively manages trees on the farm"],
                ["improvedseeds", "Uses improved or hybrid seeds"],
                ["aidreceived",   "Receives aid payments or transfers"],
              ] as [keyof HouseholdInput, string][]).map(([key, label]) => (
                <Toggle key={key} value={inp[key] as boolean} onChange={v => set(key, v)} label={label} />
              ))}
              <Field
                label="Progress out of Poverty Index likelihood (optional)"
                hint="PPI (Progress out of Poverty Index) likelihood score, if your institution collects it. Leave blank if unknown."
              >
                <NumInput value={inp.ppi_likelihood ?? null} onChange={v => set("ppi_likelihood", v)} step={0.01} />
              </Field>

              {/* Confirmation summary */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Summary before scoring</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{plainEnglishSummary(inp)}</p>
              </div>
            </>}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(STEPS[Math.max(0, stepIdx - 1)])}
                disabled={stepIdx === 0}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Back
              </button>
              {!isLastStep ? (
                <button onClick={() => setStep(STEPS[stepIdx + 1])}
                  className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800">
                  Next step
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !!incomeValidationError(inp)}
                  title={incomeValidationError(inp) ?? ""}
                  className="px-5 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-60 font-semibold"
                >
                  {loading ? "Scoring…" : "Get risk score"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Results panel */}
        <div>
          {result ? (
            <ScoreResults result={result} inputs={inp} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 space-y-3">
              <div className="text-4xl">🌾</div>
              <p className="font-medium">The risk score will appear here after you submit</p>
              <p className="text-sm">Complete all five steps and click Get risk score</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

