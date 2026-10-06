// Items editor dialog (admin can edit items on ANY transaction, open or
// closed). Purely presentational: the page owns the draft, the picker
// search/results and the save call; this only renders and edits the draft.

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Button, Empty } from "antd";
import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import type { ItemDto } from "../../../services/itemService";
import { TxDialog, TxError, TX_INPUT } from "./TxKit";

export type ItemsDraftLine = { itemId: number; name: string; price: number; quantity: number };

export default function ItemsEditorDialog({
    transactionId, draft, setDraft,
    pickerSearch, setPickerSearch, pickerItems, setPickerItems, pickerLoading,
    error, saving, onClose, onSave, subtotalNote,
}: {
    transactionId?: number;
    draft: ItemsDraftLine[];
    setDraft: Dispatch<SetStateAction<ItemsDraftLine[]>>;
    pickerSearch: string;
    setPickerSearch: (v: string) => void;
    pickerItems: ItemDto[];
    setPickerItems: (v: ItemDto[]) => void;
    pickerLoading: boolean;
    error: string | null;
    saving: boolean;
    onClose: () => void;
    onSave: () => void;
    /** Text after the subtotal, e.g. how discounts / session charges are treated. */
    subtotalNote: ReactNode;
}) {
    return (
        <TxDialog
            size="lg"
            busy={saving}
            onClose={onClose}
            title={<>Edit Items — Transaction #{transactionId}</>}
            subtitle="Works on open and closed transactions. Stock and totals adjust automatically; every change is audited."
            footer={<>
                <Button disabled={saving} onClick={onClose}>Cancel</Button>
                <Button type="primary" disabled={saving} loading={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save items'}</Button>
            </>}
        >
            {/* Current lines */}
            {draft.length === 0 ? (
                <div className="py-2"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No items on this transaction." /></div>
            ) : (
                <div className="space-y-2">
                    {draft.map((d, i) => (
                        <div key={d.itemId} className="flex items-center gap-2 rounded-xl border border-gray-200/80 px-3 py-2 dark:border-white/[0.08]">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{d.name}</div>
                                <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">${d.price.toFixed(2)} each</div>
                            </div>
                            <input
                                type="number"
                                min={0}
                                value={d.quantity}
                                aria-label={`Quantity of ${d.name}`}
                                onChange={(e) => {
                                    const v = Math.max(0, Number(e.target.value || 0));
                                    setDraft(arr => arr.map((x, xi) => xi === i ? { ...x, quantity: v } : x));
                                }}
                                className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100"
                            />
                            <Button
                                size="small"
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => setDraft(arr => arr.filter((_, xi) => xi !== i))}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add-item picker */}
            <div className="border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                <label htmlFor="tx-items-picker" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Add item</label>
                <div className="relative">
                    <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        id="tx-items-picker"
                        type="text"
                        placeholder="Search items (2+ chars)…"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        className={`${TX_INPUT} pl-8`}
                    />
                </div>
                {pickerLoading && <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">Searching…</div>}
                {pickerItems.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
                        {pickerItems.map((it) => {
                            const already = draft.some(d => d.itemId === Number(it.id));
                            return (
                                <button
                                    key={it.id}
                                    type="button"
                                    disabled={already}
                                    onClick={() => {
                                        setDraft(arr => [...arr, {
                                            itemId: Number(it.id), name: it.name,
                                            price: it.price, quantity: 1,
                                        }]);
                                        setPickerSearch('');
                                        setPickerItems([]);
                                    }}
                                    className="w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-800 last:border-0 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.06] dark:text-gray-200 dark:hover:bg-violet-500/10"
                                >
                                    {it.name} <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">— ${it.price}</span>
                                    {already && <span className="text-xs text-gray-400 dark:text-gray-500"> (already added)</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Live delta preview */}
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                New items subtotal:&nbsp;
                <b className="tabular-nums text-gray-900 dark:text-gray-100">${draft.reduce((s, d) => s + d.price * d.quantity, 0).toFixed(2)}</b>
                &nbsp;·&nbsp;{subtotalNote}
            </div>

            {error && <TxError>{error}</TxError>}
        </TxDialog>
    );
}
