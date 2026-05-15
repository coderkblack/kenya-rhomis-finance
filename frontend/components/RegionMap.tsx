"use client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { REGIONS, RISK_FILL, type RegionProfile } from "@/lib/regions";

interface Props {
  highlightRegion?: string;
  height?: number;
}

function riskLabel(r: RegionProfile["typicalRisk"]) {
  return r === "low" ? "Low" : r === "medium" ? "Medium" : "High";
}

export default function RegionMap({ highlightRegion, height = 420 }: Props) {
  return (
    <div style={{ height, isolation: "isolate" }} className="rounded-xl overflow-hidden border border-gray-200">
      <MapContainer
        center={[0.4, 37.8]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {REGIONS.map((region) => {
          const isHighlighted = region.id === highlightRegion;
          const isDimmed = !!highlightRegion && !isHighlighted;
          const radius = Math.max(14, Math.sqrt(region.approxHouseholds) / 2.2);
          return (
            <CircleMarker
              key={region.id}
              center={[region.lat, region.lng]}
              radius={radius}
              fillColor={isDimmed ? "#9ca3af" : RISK_FILL[region.typicalRisk]}
              fillOpacity={isDimmed ? 0.35 : 0.75}
              color={isHighlighted ? "#1f2937" : "#ffffff"}
              weight={isHighlighted ? 3 : 1.5}
            >
              <Popup>
                <div style={{ minWidth: 200, fontSize: 13 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>{region.name}</p>
                  <p style={{ color: "#6b7280", marginBottom: 6 }}>{region.description}</p>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "#9ca3af", paddingRight: 8 }}>Projects</td>
                        <td>{region.projects.join(", ")}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#9ca3af", paddingRight: 8 }}>HH (est.)</td>
                        <td>~{region.approxHouseholds.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#9ca3af", paddingRight: 8 }}>Typical risk</td>
                        <td style={{ color: RISK_FILL[region.typicalRisk], fontWeight: 600 }}>
                          {riskLabel(region.typicalRisk)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: "#9ca3af", paddingRight: 8 }}>Livelihoods</td>
                        <td>{region.livelihoods}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
