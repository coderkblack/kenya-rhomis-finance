import { fetchMetadata } from "@/lib/api";

export const dynamic = "force-dynamic";

const SEG_COLORS = ["#16a34a","#2563eb","#dc2626","#7c3aed"];
const MONTHS: Record<string,string> = {
  jan:"January",feb:"February",mar:"March",apr:"April",may:"May",jun:"June",
  jul:"July",aug:"August",sep:"September",oct:"October",nov:"November",dec:"December",
};

export default async function SegmentsPage() {
  const meta = await fetchMetadata();
  const segs = Object.entries(meta.segment_profiles).map(([key,p],i) => ({
    key,profile:p,color:SEG_COLORS[i%SEG_COLORS.length],
    name:meta.segment_names[key]??`Segment ${key}`,
    product:Object.entries(meta.product_map).find(
      ([k]) => k.startsWith((meta.segment_names[key]??"")[0])
    )?.[1],
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kenya farmer segments</h1>
        <p className="text-gray-500 mt-1 max-w-2xl">
          Households are grouped into four segments using K-Means clustering on 14 household characteristics
          including assets, market activity, and farming practices. Your segment assignment drives the product recommendation.
        </p>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Segment","Households","% of Kenya","Asset score","Market activity","Avg livestock (TLU)","Hunger gap month","Female-headed","Recommended product"].map(h=>(
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {segs.map(({key,name,profile,product,color}) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium text-gray-900">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:color}} />
                    {name}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600">{profile.n.toLocaleString()}</td>
                <td className="px-3 py-3 text-gray-600">{profile.pct.toFixed(1)}%</td>
                <td className="px-3 py-3 font-mono text-gray-600">{profile.asset_index.toFixed(3)}</td>
                <td className="px-3 py-3 text-gray-600">{(profile.market_orientation*100).toFixed(0)}%</td>
                <td className="px-3 py-3 text-gray-600">{profile.livestock_tlu_capped.toFixed(1)}</td>
                <td className="px-3 py-3 text-gray-600">{MONTHS[profile.worst_month]??profile.worst_month}</td>
                <td className="px-3 py-3 text-gray-600">{profile.female_headed_pct.toFixed(0)}%</td>
                <td className="px-3 py-3 text-gray-600 text-xs max-w-[160px]">{product?.primary??"-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {segs.map(({key,name,profile,product,color}) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="h-1.5" style={{backgroundColor:color}} />
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{name}</h2>
                <p className="text-sm text-gray-400">{profile.n.toLocaleString()} households · {profile.pct.toFixed(1)}% of Kenya</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {([
                  ["Asset score",           profile.asset_index.toFixed(3)],
                  ["Market activity",       (profile.market_orientation*100).toFixed(0)+"%"],
                  ["Estimated income (USD PPP/yr)", profile.log_total_income_ppp.toFixed(2)],
                  ["Livestock holdings (TLU)",  profile.livestock_tlu_capped.toFixed(1)],
                  ["Land farmed (hectares)",    profile.land_cultivated_ha_capped.toFixed(2)],
                  ["Agricultural modernisation (0–4)",  ((profile.agric_modern_index??0)).toFixed(1)],
                  ["Female income control", (profile.female_income_control*100).toFixed(0)+"%"],
                  ["Female-headed",         profile.female_headed_pct.toFixed(0)+"%"],
                ] as [string,string][]).map(([l,v]) => (
                  <div key={l} className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-400">{l}</div>
                    <div className="font-semibold text-gray-700">{v}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                <p><span className="font-medium text-gray-700">Hunger gap: </span>
                  <span className="text-gray-600">{MONTHS[profile.worst_month]??profile.worst_month} — time loan disbursement before this month so the household has funds when food is hardest to find.</span></p>
                {product && <>
                  <p><span className="font-medium text-green-700">Product: </span><span className="text-gray-700">{product.primary}</span></p>
                  <p><span className="font-medium text-gray-700">Delivery: </span><span className="text-gray-600">{product.delivery}</span></p>
                </>}
                {profile.female_headed_pct>18 && (
                  <div className="bg-purple-50 rounded p-2 text-xs text-purple-700 mt-1">
                    More than 1 in 5 households in this segment are female-headed. Consider women-led VSLA or chama group products.
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
