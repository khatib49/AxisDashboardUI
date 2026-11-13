import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Loader from "../ui/Loader";
import { listSerials, SerialNumberDto } from "../../services/retailService";

type Props = {
    isOpen: boolean;
    itemId: number;
    itemName: string;
    variantId?: number | null;
    /** Serials already picked for this item in the cart (hidden from the list). */
    taken: string[];
    onPick: (serial: string) => void;
    onSkip: () => void;
};

/**
 * Small prompt shown at the till when a scanned item requires a serial
 * number: lists the in-stock units (optionally filtered to the scanned
 * variant) and lets the cashier pick one or type / scan it.
 */
export default function SerialPromptDialog({ isOpen, itemId, itemName, variantId, taken, onPick, onSkip }: Props) {
    const [serials, setSerials] = useState<SerialNumberDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [typed, setTyped] = useState("");
    const [filter, setFilter] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;
        setLoading(true);
        setError(null);
        setTyped("");
        setFilter("");
        listSerials({ itemId, status: "InStock" })
            .then((rows) => { if (mounted) setSerials(rows); })
            .catch(() => { if (mounted) setError("Could not load serial numbers."); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [isOpen, itemId]);

    const visible = serials
        .filter((s) => !taken.includes(s.serial))
        .filter((s) => variantId == null || s.variantId == null || s.variantId === variantId)
        .filter((s) => !filter || s.serial.toLowerCase().includes(filter.toLowerCase()));

    return (
        <Modal isOpen={isOpen} onClose={onSkip} title={`Serial number — ${itemName}`} className="max-w-lg">
            <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    This item is serial-tracked. Pick the unit that is leaving the shop, or scan / type its serial.
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={typed}
                        onChange={(e) => { setTyped(e.target.value); setFilter(e.target.value); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { e.preventDefault(); onPick(typed.trim().toUpperCase()); } }}
                        placeholder="Scan or type serial…"
                        autoFocus
                        className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                    <button
                        type="button"
                        disabled={!typed.trim()}
                        onClick={() => onPick(typed.trim().toUpperCase())}
                        className="rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Use
                    </button>
                </div>
                {loading && <div className="flex justify-center py-4"><Loader /></div>}
                {error && <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-500/10">{error}</div>}
                {!loading && !error && (
                    <div className="max-h-64 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                        {visible.length === 0 && (
                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No in-stock serial numbers to choose from.</div>
                        )}
                        {visible.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => onPick(s.serial)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-white/5 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
                            >
                                <span className="font-mono text-gray-800 dark:text-white/90">{s.serial}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {s.variantName ? `${s.variantName} · ` : ""}received {new Date(s.receivedOn).toLocaleDateString()}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onSkip} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
                        Skip (no serial)
                    </button>
                </div>
            </div>
        </Modal>
    );
}
