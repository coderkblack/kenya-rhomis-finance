"use client";
import { useEffect, useState } from "react";
import type { Metadata, ModelResult } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const MODEL_DISPLAY: Record<string, string> = {
  gb: "Gradient Boosting (primary)",
  rf: "Random Forest",
  xgb: "XGBoost",
  lr: "Logistic Regression",
  dt: "Decision Tree",
  stacking: "Stacking ensemble",
};

function fmt(v:number|undefined|null, d=3):string {
  if (v==null||isNaN(v as number)) return "—";
  return (v as number).toFixed(d);
}
function aucColor(v:number):string {
  if (isNaN(v)) return "text-gray-400";
  if (v>=0.75) return "text-green-700 font-semibold";
  if (v>=0.70) return "text-blue-700";
  return "text-gray-600";
}

export default function ModelPage() {
  const [meta,setMeta]=useState<Metadata|null>(null);
  const [loaded,setLoaded]=useState<string[]>([]);
  const [err,setErr]=useState("");

  useEffect(()=>{
    fetch(`${API}/metadata`).then(r=>r.json()).then(setMeta).catch(()=>setErr("Could not load model data. Make sure the scoring backend is running, then refresh this page."));
    fetch(`${API}/health`).then(r=>r.json()).then(h=>setLoaded(h.models_loaded??[])).catch(()=>{});
  },[]);

  if (err) return <p className="text-red-600 py-12 text-center">{err}</p>;
  if (!meta) return <p className="text-gray-400 py-12 text-center animate-pulse">Loading model data…</p>;

  const results = [...(meta.all_results??[])].filter(Boolean).sort((a,b)=>{
    const av=isNaN(a.kenya_test_auc)?-1:a.kenya_test_auc;
    const bv=isNaN(b.kenya_test_auc)?-1:b.kenya_test_auc;
    return bv-av;
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Model transparency</h1>
        <p className="text-gray-500 mt-1">
          All models were trained on {meta.n_train.toLocaleString()} household records across 15 countries.
          The Kenya 2019 temporal holdout (marked ★) is the most honest measure of how well the model generalises to new households.
        </p>
      </div>

      {loaded.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
          <p className="font-semibold text-green-800 mb-1">Active models (loaded)</p>
          <p className="text-green-700">
            {loaded.filter(k => MODEL_DISPLAY[k]).map(k => MODEL_DISPLAY[k]).join(" · ")}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Model","Train CV AUC","95% CI","Kenya AUC (full)","Kenya 2019 Test ★","Gap","F1 (wt)"].map(h=>(
                <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${h.includes("★")?"bg-green-50":""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r:ModelResult,i:number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                <td className={`px-4 py-3 font-mono ${aucColor(r.auc_rep_mean)}`}>{fmt(r.auc_rep_mean)}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {r.auc_rep_ci_lo!=null&&!isNaN(r.auc_rep_ci_lo)
                    ? `[${fmt(r.auc_rep_ci_lo)}–${fmt(r.auc_rep_ci_hi)}]`
                    : "—"}
                </td>
                <td className={`px-4 py-3 font-mono ${aucColor(r.kenya_auc)}`}>{fmt(r.kenya_auc)}</td>
                <td className={`px-4 py-3 font-mono bg-green-50 ${aucColor(r.kenya_test_auc)}`}>{fmt(r.kenya_test_auc)}</td>
                <td className={`px-4 py-3 font-mono text-xs ${r.kenya_gap<-0.1?"text-red-500":"text-gray-500"}`}>
                  {r.kenya_gap!=null&&!isNaN(r.kenya_gap)?(r.kenya_gap>0?"+":"")+fmt(r.kenya_gap):"—"}
                </td>
                <td className="px-4 py-3 font-mono text-gray-600">{fmt(r.f1_w_mean)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500 space-y-2 bg-gray-50 rounded-xl p-4">
        <p>★ <strong>Kenya 2019 test AUC</strong> is the honest estimate — the model never saw 2019 Kenya records during training. Prefer this column when evaluating model quality.</p>
        <p><strong>Gap</strong> = Kenya AUC (full) − Train CV AUC. A large negative gap flags overfitting to training countries; a positive gap means Kenya generalises better than the average training fold.</p>
        <p><strong>Primary model:</strong> Gradient Boosting (tuned) — highest Kenya 2019 test AUC (0.744) across all deployed models. Stacking (LR meta) reflects a retrained ensemble with 150 base estimators; the original full-depth stacking (363 estimators) achieved 0.754 on the same holdout.</p>
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Feature Set — {meta.independent_feats.length} independent features</h2>
        <div className="flex flex-wrap gap-2">
          {meta.independent_feats.map(f=>(
            <code key={f} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200">{f}</code>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">All Type A only — no concurrent food-security measures included to prevent label leakage.</p>
      </section>
    </div>
  );
}
