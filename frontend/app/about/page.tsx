import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About this model — RHoMIS Finance Kenya",
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    <div className="text-gray-700 leading-relaxed space-y-2">{children}</div>
  </section>
);

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-black text-gray-900">About this model</h1>
        <p className="text-gray-500 mt-2">How the credit scoring tool works, what data it uses, and what its limitations are.</p>
      </div>

      <Section title="What this tool does">
        <p>
          This tool estimates the likelihood that a smallholder farming household in Kenya is food insecure, using
          information about their income, land, livestock, and farming practices. That estimate is used as a proxy
          for credit risk: households with a lower likelihood of food insecurity are generally better placed to
          service a loan.
        </p>
        <p>
          The tool also assigns each household to one of four farmer segments based on their asset profile and
          market engagement, and suggests a financial product suited to that segment.
        </p>
      </Section>

      <Section title="Training data">
        <p>
          The model was trained on the{" "}
          <a href="https://www.rhomis.org" target="_blank" rel="noopener noreferrer" className="text-green-700 underline">
            RHoMIS (Rural Household Multi-Indicator Survey)
          </a>{" "}
          dataset, which covers over 32,000 smallholder farming households across 15 countries in sub-Saharan
          Africa and South Asia. The Kenya subset used for training contains approximately 54,000 household observations.
        </p>
        <p>
          Data were collected by ILRI (International Livestock Research Institute) and Wageningen University &amp;
          Research. Income values are expressed in USD at purchasing power parity (PPP) to allow comparison across
          years and regions.
        </p>
      </Section>

      <Section title="Model architecture">
        <p>
          Four separate classification models were trained: Random Forest, XGBoost, Logistic Regression, and a
          Decision Tree. The primary score shown in the tool comes from the Random Forest model (AUC ≈ 0.82 on the
          held-out Kenya validation set). The other three models are shown in the &quot;Technical details&quot; section for
          reference. Their predictions should be broadly consistent; large disagreements between models may indicate
          an unusual or edge-case household profile.
        </p>
        <p>
          The farmer segments are produced by a K-Means clustering model trained on the same dataset. The
          clustering uses asset holdings, market orientation, and farming practices as inputs.
        </p>
      </Section>

      <Section title="What the model cannot do">
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>It cannot assess creditworthiness on its own. It provides decision support only.</li>
          <li>It does not verify the data you enter. Garbage in, garbage out.</li>
          <li>
            It was trained on survey data, not loan repayment records. Food insecurity is used as a proxy for
            credit risk — this is a reasonable approximation but not a direct measurement.
          </li>
          <li>
            The model may not generalise well to regions or household types that were underrepresented in the
            RHoMIS dataset.
          </li>
          <li>
            Scores should not be compared directly across different loan officers or field sessions unless the
            same input methodology is used.
          </li>
        </ul>
      </Section>

      <Section title="How to use the score responsibly">
        <p>
          Every credit decision must combine the model score with your field assessment and your institution&apos;s
          lending policy. The score should be one input among several — not the sole determinant of approval or
          rejection.
        </p>
        <p>
          If a household&apos;s score seems inconsistent with what you observed in the field, trust your field
          assessment. Document the discrepancy and{" "}
          <a href="mailto:?subject=RHoMIS%20Finance%20Kenya%20%E2%80%94%20Score%20discrepancy" className="text-green-700 underline">
            report it
          </a>{" "}
          so the model can be improved.
        </p>
      </Section>

      <Section title="Data privacy">
        <p>
          Household data entered into this tool is sent to the scoring backend (running locally or on your
          institution&apos;s server) and, if the AI narrative feature is enabled, a summary is sent to the Groq API
          for text generation. No personally identifiable information should be entered into this tool. The tool is
          designed for anonymised household profiles only.
        </p>
      </Section>

      <div className="border-t border-gray-200 pt-6 text-xs text-gray-400 space-y-1">
        <p>Model version: V3. Training data: RHoMIS Kenya subset, 54K households.</p>
        <p>
          Questions about the model?{" "}
          <a href="mailto:?subject=RHoMIS%20Finance%20Kenya%20%E2%80%94%20Model%20question" className="underline">
            Send us a message.
          </a>
        </p>
      </div>
    </div>
  );
}
