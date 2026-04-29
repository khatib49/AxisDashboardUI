import React from "react";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import { AxisMark } from "../../components/common/AxisLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-gray-50 z-1 dark:bg-gray-950">
      <div className="relative grid w-full min-h-screen lg:grid-cols-2">
        {/* Form column */}
        <div className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="inline-flex items-center gap-3 mb-10 lg:hidden"
              aria-label="AXIS Admin home"
            >
              <AxisMark size={36} />
              <span className="font-display tracking-[0.2em] text-sm text-gray-900 dark:text-white">
                AXIS
              </span>
            </Link>
            {children}
          </div>
        </div>

        {/* Brand column */}
        <div className="relative hidden overflow-hidden bg-[#0b1220] lg:block">
          <div className="absolute inset-0 axis-grid-bg opacity-80" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 35%, rgba(91,141,239,0.22) 0%, rgba(91,141,239,0.05) 45%, transparent 75%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(11,18,32,0.95) 10%, transparent 100%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-12 text-center text-white">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl opacity-60 bg-brand-500 rounded-3xl scale-110" />
              <div className="relative">
                <AxisMark size={96} />
              </div>
            </div>

            <h2 className="mt-10 font-display text-2xl tracking-[0.16em] text-white">
              AXIS<span className="text-brand-400"> ADMIN</span>
            </h2>
            <p className="mt-4 max-w-sm font-mono text-[11px] tracking-[0.32em] uppercase text-brand-300/80">
              Operations Console
            </p>
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-gray-400">
              Run the lounge from one place — sessions, kitchen, cashier and
              accounting, in real time.
            </p>

            <div className="mt-12 flex items-center gap-6 text-[10px] font-mono uppercase tracking-[0.24em] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(91,141,239,0.8)]" />
                Live
              </div>
              <span className="text-gray-700">/</span>
              <span>v2.0</span>
              <span className="text-gray-700">/</span>
              <span>Secure</span>
            </div>
          </div>

          {/* Corner ticks */}
          <CornerTick className="top-6 left-6" />
          <CornerTick className="top-6 right-6 rotate-90" />
          <CornerTick className="bottom-6 right-6 rotate-180" />
          <CornerTick className="bottom-6 left-6 -rotate-90" />
        </div>

        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}

const CornerTick: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    aria-hidden="true"
    className={`absolute text-brand-500/40 ${className}`}
  >
    <path d="M1 1H8M1 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
  </svg>
);
