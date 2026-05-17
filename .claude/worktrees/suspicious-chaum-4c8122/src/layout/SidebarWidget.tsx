export default function SidebarWidget() {
  return (
    <div className="relative mx-auto mb-8 w-full max-w-60 overflow-hidden rounded-2xl gradient-brand p-5 text-center shadow-glow-brand">
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/15 blur-xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-white/10 blur-xl" aria-hidden="true" />
      <div className="relative z-10">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2L4 7v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-5z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-white">AXIS Lounge</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-white/85">
          Lounge & Suite — All Rights Reserved 2026
        </p>
      </div>
    </div>
  );
}
