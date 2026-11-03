import { useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { clock, HrClockResult, errorMessage } from "../../services/hrService";

const RESULT_SECONDS = 5;

export default function ClockKiosk() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HrClockResult | null>(null);
  const [now, setNow] = useState(new Date());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function showResult(r: HrClockResult) {
    setResult(r);
    setPin("");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setResult(null), RESULT_SECONDS * 1000);
  }

  async function submit(p = pin) {
    if (busy || p.length < 4) return;
    setBusy(true);
    try {
      const deviceName = typeof window !== "undefined" ? window.location.hostname : undefined;
      showResult(await clock(p, deviceName));
    } catch (e) {
      const data = (e as { response?: { data?: HrClockResult } })?.response?.data;
      showResult(data && typeof data.message === "string" ? { ...data, success: false } : { success: false, message: errorMessage(e, "Clock failed") });
    } finally {
      setBusy(false);
    }
  }

  function press(k: string) {
    if (result) setResult(null);
    if (k === "C") { setPin(""); return; }
    if (k === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (k === "OK") { void submit(); return; }
    setPin((p) => {
      const next = (p + k).slice(0, 6);
      if (next.length === 6) void submit(next);
      return next;
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter") press("OK");
      else if (e.key === "Escape") press("C");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, busy, result]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <PageMeta title="Clock In / Out | Axis" description="Staff attendance kiosk" />
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 text-gray-800 dark:text-white/90">
        <div className="mb-4 text-center">
          <div className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Staff clock</div>
          <div className="text-3xl font-semibold text-gray-800 dark:text-white/90">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{now.toLocaleDateString()}</div>
        </div>

        {result ? (
          <div className={`mb-4 rounded-xl p-5 text-center ${result.success ? (result.action === "ClockIn" ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400" : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300") : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"}`}>
            <div className="text-2xl font-semibold">{result.success ? (result.action === "ClockIn" ? "Clocked in" : "Clocked out") : "Not accepted"}</div>
            <div className="mt-1 text-lg">{result.employeeName ?? result.message}</div>
            {result.success && <div className="text-sm opacity-80">{fmt(result.at)}{result.workedMinutes != null ? ` · ${Math.floor(result.workedMinutes / 60)}h ${result.workedMinutes % 60}m worked` : ""}</div>}
            {!result.success && result.employeeName && <div className="text-sm">{result.message}</div>}
          </div>
        ) : (
          <div className="mb-4 flex h-[104px] items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5">
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"}`} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button key={k} type="button" disabled={busy} onClick={() => press(k)}
              className={`h-16 rounded-xl text-2xl font-semibold transition active:scale-95 disabled:opacity-50 ${k === "C" || k === "⌫" ? "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" : "bg-gray-50 text-gray-800 hover:bg-gray-100 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"}`}>
              {k}
            </button>
          ))}
          <button type="button" disabled={busy || pin.length < 4} onClick={() => press("OK")}
            className="col-span-3 h-16 rounded-xl bg-brand-500 text-xl font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {busy ? "…" : "Clock in / out"}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">Enter your 4-6 digit PIN. The same PIN clocks you in and out.</p>
      </div>
    </div>
  );
}
