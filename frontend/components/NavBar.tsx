"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",         label: "Overview"  },
  { href: "/score",    label: "Score"     },
  { href: "/intake",   label: "Intake"    },
  { href: "/segments", label: "Segments"  },
  { href: "/map",      label: "Map"       },
  { href: "/model",    label: "Model"     },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-green-700 text-lg">
          <svg viewBox="0 0 30 20" width="30" height="20" aria-label="Kenya flag" className="rounded-sm shrink-0">
            <rect width="30" height="6.67" fill="#000" />
            <rect y="6.67" width="30" height="1.5" fill="#fff" />
            <rect y="8.17" width="30" height="3.66" fill="#BB0000" />
            <rect y="11.83" width="30" height="1.5" fill="#fff" />
            <rect y="13.33" width="30" height="6.67" fill="#006600" />
          </svg>
          <span className="hidden sm:inline">RHoMIS Finance Kenya</span>
          <span className="sm:hidden">RHoMIS Kenya</span>
        </Link>
        <nav className="flex gap-1">
          {links.map(({ href, label }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-green-700 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
