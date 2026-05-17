import React from "react";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import BrandLogo from "../../components/common/BrandLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-gray-950">
      <div className="relative flex flex-col w-full min-h-screen lg:flex-row">
        {/* Left: form column */}
        <div className="relative flex w-full flex-col px-6 py-10 sm:px-12 lg:w-1/2 lg:px-16 z-10">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center">
              <BrandLogo variant="full" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-md animate-slide-up">{children}</div>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} AXIS Lounge & Suite. All rights reserved.
          </p>
        </div>

        {/* Right: branded illustration column */}
        <div className="relative hidden w-full bg-mesh dark:bg-gray-950 lg:flex lg:w-1/2 lg:items-center lg:justify-center overflow-hidden">
          {/* Animated gradient mesh background */}
          <div className="absolute inset-0 gradient-brand opacity-90" aria-hidden="true" />
          <div className="absolute inset-0 bg-grid-pattern opacity-30" aria-hidden="true" />

          {/* Floating decorative orbs */}
          <div className="absolute top-12 left-12 h-32 w-32 rounded-full bg-white/15 blur-2xl animate-float" aria-hidden="true" />
          <div className="absolute bottom-16 right-16 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} aria-hidden="true" />
          <div className="absolute top-1/3 right-1/4 h-24 w-24 rounded-full bg-fuchsia-400/30 blur-2xl animate-float" style={{ animationDelay: "0.8s" }} aria-hidden="true" />

          <div className="relative z-10 flex max-w-md flex-col items-center px-8 text-center text-white">
            <div className="mb-6 flex items-center justify-center rounded-3xl bg-white/15 p-5 backdrop-blur-md ring-1 ring-white/30 shadow-2xl">
              <BrandLogo variant="icon" size={64} />
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-tight leading-tight">
              Welcome to AXIS
            </h2>
            <p className="text-base text-white/85 leading-relaxed">
              Your unified gaming lounge & hospitality command center —
              orders, sessions, inventory, and rewards in one elegant suite.
            </p>

            {/* Feature pills */}
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {["Real-time", "Secure", "Modern", "Insightful"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
