import Link from "next/link";
import { fetchMetadata } from "@/lib/api";
import StatusIndicator from "@/components/StatusIndicator";

export const dynamic = "force-dynamic";

const COUNTRY_NAMES: Record<string,string> = {
  BF:"Burkina Faso",ET:"Ethiopia",KE:"Kenya",TZ:"Tanzania",ML:"Mali",
  IN:"India",GH:"Ghana",BI:"Burundi",CD:"DR Congo",ZM:"Zambia",
  UG:"Uganda",KH:"Cambodia",MW:"Malawi",GT:"Guatemala",NI:"Nicaragua",
};
const SEG_COLORS = ["#16a34a","#2563eb","#dc2626","#7c3aed"];

export default async function HomePage() {
  let meta: Awaited<ReturnType<typeof fetchMetadata>> | null = null;
  try { meta = await fetchMetadata(); }
  catch { /* API unavailable — show static content only */ }

  const segments = meta
    ? Object.entries(meta.segment_profiles).map(([key,p],i) => ({
        key, profile:p, color: SEG_COLORS[i % SEG_COLORS.length],
        name: meta!.segment_names[key] ?? `Segment ${key}`,
        product: Object.entries(meta!.product_map).find(
          ([k]) => k.startsWith((meta!.segment_names[key]??"")[0])
        )?.[1],
      }))
    : [];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-3">Kenya Smallholder Credit Scoring</h1>
            <p className="text-green-100 text-lg leading-relaxed max-w-2xl">
              A decision support tool for loan officers assessing smallholder farmer households in Kenya.
              Enter household data to receive a food-insecurity risk score and segment-based product recommendation.
            </p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2">
            <StatusIndicator />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/score" className="bg-white text-green-800 font-semibold px-5 py-2.5 rounded-lg hover:bg-green-50 transition-colors">
            Score a household
          </Link>
          <Link href="/intake" className="border border-green-300 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors">
            Conversational intake
          </Link>
        </div>
      </div>

      {/* Stats */}
      {meta && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:"Training households", value:meta.n_train.toLocaleString()},
            {label:"Kenya households",    value:meta.n_kenya.toLocaleString()},
            {label:"Training countries",  value:String(meta.train_countries.length)},
            {label:"Kenya test accuracy (AUC)", value:meta.noppi_kenya_2019_auc.toFixed(3), note:"AUC measures how well the model separates high-risk from low-risk households. Closer to 1.0 is better."},
          ].map(({label,value,note}) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-green-700">{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
              {note && <div className="text-xs text-gray-400 mt-1">{note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Decision support tool only.</strong> This tool gives you a food-insecurity risk score and farmer segment assignment. It is not a standalone credit decision engine.
        Final lending decisions must include your own field judgement and your institution&apos;s lending policy.
      </div>

      {/* Segment cards */}
      {segments.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Kenya Farmer Segments</h2>
          <p className="text-sm text-gray-500 mb-4">
            Households in Kenya are grouped into four segments based on income, land, livestock, and farming practices.
            Each segment has a recommended financial product.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {segments.map(({key,name,profile,product,color}) => (
              <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="h-1.5" style={{backgroundColor:color}} />
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                      style={{backgroundColor:color}}>
                      {name[0]}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{name}</h3>
                      <p className="text-xs text-gray-400">{profile.pct.toFixed(1)}% of Kenya surveyed households</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      ["Combined assets", profile.asset_index.toFixed(2)],
                      ["Crops sold at market", (profile.market_orientation*100).toFixed(0)+"%"],
                      ["Livestock (TLU)", profile.livestock_tlu_capped.toFixed(1)],
                    ].map(([l,v]) => (
                      <div key={l as string} className="bg-gray-50 rounded p-2">
                        <div className="text-gray-400">{l}</div>
                        <div className="font-semibold text-gray-700">{v}</div>
                      </div>
                    ))}
                  </div>
                  {product && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-green-700">Recommended product: </span>{product.primary}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Countries */}
      {meta && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Training Countries</h2>
          <p className="text-sm text-gray-500 mb-3">
            The model was trained on household data from 15 countries. Kenya data drives the final calibration.
          </p>
          <div className="flex flex-wrap gap-2">
            {meta.train_countries.map(c => (
              <span key={c} className={`px-3 py-1 rounded-full text-sm font-medium ${
                c==="KE"?"bg-green-100 text-green-800 border border-green-300":"bg-gray-100 text-gray-600"
              }`}>
                {COUNTRY_NAMES[c]??c}{c==="KE"?" ★":""}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Kenya (★) contributes roughly 11% of training data. The model uses stratified cross-validation to preserve Kenya&apos;s share in every training fold.
          </p>
        </section>
      )}

      {/* API offline placeholder */}
      {!meta && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 space-y-2">
          <p className="font-medium">Segment and model data could not be loaded.</p>
          <p className="text-sm">The scoring service is not reachable. Check that the backend server is running, then refresh this page.</p>
          <code className="block text-xs bg-gray-100 rounded px-4 py-2 inline-block mt-2 text-gray-400">
            cd api &amp;&amp; uvicorn main:app --reload
          </code>
        </div>
      )}
    </div>
  );
}
