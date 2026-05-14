"use client";
import dynamic from "next/dynamic";
import { REGIONS, RISK_FILL } from "@/lib/regions";

const RegionMap = dynamic(() => import("@/components/RegionMap"), { ssr: false });

const SEG_NAMES: Record<number, string> = {
  0: "A — Commercial Producer",
  1: "B — Diversified Transitional",
  2: "D — Vulnerable Subsistence",
  3: "B — Diversified Transitional (land-secure)",
};

const SEG_COLORS: Record<number, string> = {
  0: "#16a34a",
  1: "#2563eb",
  2: "#dc2626",
  3: "#7c3aed",
};

export default function MapPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kenya Agroecological Zones</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-2xl">
          The scoring model was calibrated on RHoMIS data across five Kenyan agroecological zones.
          Circle size reflects approximate household coverage; colour reflects typical credit risk level.
          Click a region for details.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-gray-600">Risk level:</div>
        {(["low", "medium", "high"] as const).map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: RISK_FILL[r] }} />
            <span className="capitalize text-gray-700">{r}</span>
          </div>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border border-gray-300 bg-gray-200" />
          <span className="text-gray-500 text-xs">Circle size ∝ household coverage</span>
        </div>
      </div>

      {/* Map */}
      <RegionMap height={480} />

      {/* Region cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REGIONS.map((region) => (
          <div key={region.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{region.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{region.description}</p>
              </div>
              <span
                className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                style={{ background: RISK_FILL[region.typicalRisk] + "20", color: RISK_FILL[region.typicalRisk] }}
              >
                {region.typicalRisk}
              </span>
            </div>

            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Projects</span>
                <span className="font-mono">{region.projects.join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Est. households</span>
                <span>~{region.approxHouseholds.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg risk score</span>
                <span>{(region.avgRiskScore * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="text-xs">
              <p className="text-gray-400 mb-1">Dominant segments</p>
              <div className="flex flex-wrap gap-1">
                {region.dominantSegments.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-full text-white text-xs"
                    style={{ background: SEG_COLORS[s] }}
                  >
                    {SEG_NAMES[s]?.split("—")[0].trim()}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">
              <span className="font-medium text-gray-600">Challenges:</span> {region.challenges}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
        Household counts and risk scores are representative estimates derived from the RHoMIS project
        distribution across 3,952 Kenya training records. Region boundaries are approximate
        agroecological zones, not administrative county boundaries.
      </p>
    </div>
  );
}
