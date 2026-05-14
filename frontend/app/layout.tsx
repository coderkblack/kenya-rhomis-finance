import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RHoMIS Finance Kenya",
  description: "Kenya smallholder credit scoring and farmer segmentation — decision support tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-400 flex flex-wrap justify-between gap-2">
            <span>Decision support only — not a standalone credit decision engine.</span>
            <div className="flex gap-4">
              <a href="/about" className="hover:text-gray-600 underline underline-offset-2">About this model</a>
              <a href="mailto:?subject=RHoMIS%20Finance%20Kenya%20%E2%80%94%20Problem%20report" className="hover:text-gray-600 underline underline-offset-2">Report a problem</a>
              <span>Data: ILRI / Wageningen University RHoMIS · 15 countries</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
