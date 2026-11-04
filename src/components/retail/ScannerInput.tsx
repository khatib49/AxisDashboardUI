import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
    onScan: (code: string) => void;
    /** Hide the visible "Scan" field (listener only). */
    hideField?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    /** Max ms between keystrokes for a burst to count as a scanner (default 60). */
    burstGapMs?: number;
    /** Minimum burst length before Enter counts as a scan (default 3). */
    minLength?: number;
};

/**
 * Keyboard-wedge scanner listener + a visible "Scan" field.
 *
 * Most USB / Bluetooth barcode scanners type the code very fast and finish
 * with Enter. The document-level listener collects such bursts whenever
 * the user is NOT typing in a form control, so a cashier can scan with the
 * page simply focused. The visible field is for manual entry (or scanners
 * when the cashier clicks into it): Enter emits the value.
 */
export default function ScannerInput({ onScan, hideField = false, placeholder = "Scan or type a code…", disabled = false, className = "", burstGapMs = 60, minLength = 3 }: Props) {
    const [value, setValue] = useState("");
    const [lastScan, setLastScan] = useState<string | null>(null);
    const buffer = useRef("");
    const lastKeyAt = useRef(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const emit = useCallback((code: string) => {
        const norm = code.replace(/\s+/g, "");
        if (!norm) return;
        setLastScan(norm);
        onScan(norm);
    }, [onScan]);

    useEffect(() => {
        if (disabled) return;
        const isEditable = (el: EventTarget | null) => {
            const e = el as HTMLElement | null;
            if (!e) return false;
            const tag = e.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.isContentEditable;
        };
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
            // Our own field handles its Enter; other inputs are the user's typing.
            if (isEditable(ev.target) && ev.target !== inputRef.current) return;
            if (ev.target === inputRef.current) return;
            const now = Date.now();
            if (now - lastKeyAt.current > burstGapMs) buffer.current = "";
            lastKeyAt.current = now;
            if (ev.key === "Enter") {
                const code = buffer.current;
                buffer.current = "";
                if (code.length >= minLength) {
                    ev.preventDefault();
                    emit(code);
                }
                return;
            }
            if (ev.key.length === 1) buffer.current += ev.key;
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [disabled, burstGapMs, minLength, emit]);

    return (
        <div className={`flex items-center gap-2 ${hideField ? "sr-only" : ""} ${className}`} data-testid="scanner-input">
            <span className="text-gray-500 dark:text-gray-400" aria-hidden>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" />
                </svg>
            </span>
            <input
                ref={inputRef}
                type="text"
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                aria-label="Scan barcode"
                autoComplete="off"
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        emit(value);
                        setValue("");
                    }
                }}
                className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 disabled:opacity-50"
            />
            <button
                type="button"
                disabled={disabled || !value.trim()}
                onClick={() => { emit(value); setValue(""); }}
                className="h-9 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
                Scan
            </button>
            {lastScan && <span className="text-xs text-gray-500 dark:text-gray-400" title="Last scanned code">last: {lastScan}</span>}
        </div>
    );
}
