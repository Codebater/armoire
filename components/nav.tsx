"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ICalendar, IChart, IGrid, IHanger, IPlus } from "./icons";

const TABS = [
  { href: "/", label: "Studio", icon: IHanger },
  { href: "/closet", label: "Closet", icon: IGrid },
  { href: "/add", label: "Add", icon: IPlus, center: true },
  { href: "/looks", label: "Looks", icon: ICalendar },
  { href: "/insights", label: "Insights", icon: IChart },
];

function Wordmark() {
  return (
    <Link href="/" className="group inline-flex items-baseline gap-2">
      <span className="font-display text-[19px] font-semibold tracking-[0.34em] text-ink">
        ARMOIRE
      </span>
      <span className="hidden text-[10px] uppercase tracking-[0.22em] text-faint md:inline">
        digital wardrobe
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <Wordmark />
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                  active(t.href) ? "bg-ink text-card" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="micro text-faint md:hidden">est. today</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 md:px-8 md:pb-20 md:pt-8">{children}</main>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-end justify-between px-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const is = active(t.href);
            if (t.center) {
              return (
                <Link key={t.href} href={t.href} aria-label="Add pieces" className="-mt-6">
                  <span className="btn-bronze grid h-13 w-13 place-items-center rounded-full" style={{ width: 52, height: 52 }}>
                    <Icon className="h-5.5 w-5.5" style={{ width: 22, height: 22 }} />
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "flex w-14 flex-col items-center gap-1 pb-1 pt-1 transition-colors",
                  is ? "text-ink" : "text-faint",
                )}
              >
                <Icon style={{ width: 21, height: 21 }} />
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
