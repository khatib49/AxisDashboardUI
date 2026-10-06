// One category of the Item Revenue report: a collapsible card whose header
// carries the category subtotals, and a table of its items. Sorting is shared
// by every category (the page owns sortKey/sortDir); expand/collapse is local.

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CaretDownOutlined, CaretUpOutlined, DownOutlined, InboxOutlined } from "@ant-design/icons";
import type { ItemRevenueCategoryGroupDto, ItemRevenueLineDto } from "../../../services/itemRevenueReportService";
import { Pill } from "../../ui/PageKit";
import MarginPill from "./MarginPill";
import { money, profitCls, STREAM_COLOR } from "./format";
import type { SortDir, SortKey } from "./format";

function SortHeader({ label, k, sortKey, sortDir, onSort }: {
    label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
    const active = sortKey === k;
    return (
        <button
            type="button"
            onClick={() => onSort(k)}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded text-[11px] font-semibold uppercase tracking-wide transition hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:hover:text-white ${
                active ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
        >
            {label}
            <span aria-hidden className="flex flex-col text-[8px] leading-[0.7]">
                <CaretUpOutlined className={active && sortDir === "asc" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-gray-600"} />
                <CaretDownOutlined className={active && sortDir === "desc" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-gray-600"} />
            </span>
        </button>
    );
}

function CostCell({ item }: { item: ItemRevenueLineDto }) {
    if (item.costSource === "none") {
        return (
            <Tooltip title="No buy price and no recipe — COGS counted as $0">
                <span><Pill tone="amber" dot>no cost</Pill></span>
            </Tooltip>
        );
    }
    return (
        <div className="leading-tight">
            <span className="tabular-nums text-gray-600 dark:text-gray-300">{money(item.unitCost ?? 0)}</span>
            {item.costSource === "recipe" && (
                <Tooltip title="Ingredient cost at today's prices">
                    <div className="text-[10px] text-teal-600 dark:text-teal-400">recipe</div>
                </Tooltip>
            )}
        </div>
    );
}

function StockCell({ item }: { item: ItemRevenueLineDto }) {
    if (item.isRecipe) {
        return (
            <Tooltip title="Stock is tracked on ingredients">
                <span className="text-[11px] text-teal-600 dark:text-teal-400">recipe</span>
            </Tooltip>
        );
    }
    if (item.isDeleted) {
        return (
            <Tooltip title="Deleted item — no stock on the shelf">
                <span className="text-gray-400">—</span>
            </Tooltip>
        );
    }
    const tone = item.stockOnHand <= 0 ? "red" : item.stockOnHand <= 5 ? "amber" : "emerald";
    const hint = item.stockOnHand <= 0 ? "Out of stock" : item.stockOnHand <= 5 ? "Low stock (5 or fewer)" : "In stock";
    return (
        <span title={hint} className="tabular-nums">
            <Pill tone={tone} dot>{item.stockOnHand}</Pill>
        </span>
    );
}

function Subtotal({ label, children }: { label: string; children: ReactNode }) {
    return (
        <span className="block min-w-0 lg:text-right">
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
            <span className="block whitespace-nowrap text-sm font-semibold tabular-nums">{children}</span>
        </span>
    );
}

export default function CategoryGroupPanel({
    group, sortKey, sortDir, onSort,
}: {
    group: ItemRevenueCategoryGroupDto;
    sortKey: SortKey;
    sortDir: SortDir;
    onSort: (k: SortKey) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const bodyId = useId();
    const isTcg = group.isTcg;
    const color = isTcg ? STREAM_COLOR.tcg : STREAM_COLOR.fnb;

    const sorted = [...group.items].sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortKey === "itemName") return mul * a.itemName.localeCompare(b.itemName);
        return mul * (((a[sortKey] ?? 0) as number) - ((b[sortKey] ?? 0) as number));
    });

    const sortCol = (key: SortKey, label: string) => ({
        key,
        title: <SortHeader label={label} k={key} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />,
        onHeaderCell: () => ({
            "aria-sort": sortKey === key ? (sortDir === "asc" ? "ascending" as const : "descending" as const) : "none" as const,
        }),
    });

    const columns: ColumnsType<ItemRevenueLineDto> = [
        {
            ...sortCol("itemName", "Item"),
            fixed: "left",
            width: 240,
            render: (_, item) => (
                <div className="flex min-w-0 items-center gap-3">
                    {item.imagePath ? (
                        <img src={item.imagePath} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-white/10" />
                    ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500" aria-hidden>
                            <InboxOutlined />
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className={`truncate text-sm font-medium ${item.isDeleted ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>{item.itemName}</div>
                        {item.isDeleted && (
                            <Tooltip title="Item is deleted — shown because it sold in this period. Stock counted as 0.">
                                <span><Pill tone="gray" dot>deleted</Pill></span>
                            </Tooltip>
                        )}
                    </div>
                </div>
            ),
        },
        {
            ...sortCol("sellPrice", "Sell $"),
            align: "right",
            width: 100,
            render: (_, item) => <span className="tabular-nums text-gray-600 dark:text-gray-300">{money(item.sellPrice)}</span>,
        },
        {
            key: "unitCost",
            title: <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Cost $</span>,
            align: "right",
            width: 100,
            render: (_, item) => <CostCell item={item} />,
        },
        {
            ...sortCol("unitsSold", "Sold"),
            align: "right",
            width: 90,
            render: (_, item) => (
                <div className="leading-tight">
                    <span className={`font-semibold tabular-nums ${item.unitsSold > 0 ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>{item.unitsSold}</span>
                    {item.unitsGivenFree > 0 && (
                        <Tooltip title="Handed out inside an event kit — no revenue, stock deducted">
                            <div className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400">+{item.unitsGivenFree} free</div>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            ...sortCol("revenue", "Revenue"),
            align: "right",
            width: 150,
            render: (_, item) => (
                <div className="leading-tight">
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(item.revenue)}</span>
                    {(item.discountGiven > 0.004 || item.addOnRevenue > 0.004) && (
                        <div className="whitespace-nowrap text-[10px] tabular-nums text-gray-400">
                            {item.discountGiven > 0.004 && <span className="text-red-500 dark:text-red-400">−{money(item.discountGiven)} disc</span>}
                            {item.discountGiven > 0.004 && item.addOnRevenue > 0.004 && " · "}
                            {item.addOnRevenue > 0.004 && <span className="text-violet-600 dark:text-violet-400">+{money(item.addOnRevenue)} add-ons</span>}
                        </div>
                    )}
                </div>
            ),
        },
        {
            ...sortCol("cogs", "COGS"),
            align: "right",
            width: 110,
            render: (_, item) => <span className="tabular-nums text-gray-600 dark:text-gray-300">{money(item.cogs)}</span>,
        },
        {
            ...sortCol("grossProfit", "Gross profit"),
            align: "right",
            width: 130,
            render: (_, item) => <span className={`font-semibold tabular-nums ${profitCls(item.grossProfit)}`}>{money(item.grossProfit)}</span>,
        },
        {
            ...sortCol("grossMarginPct", "Margin %"),
            align: "right",
            width: 110,
            render: (_, item) => <MarginPill value={item.grossMarginPct} />,
        },
        {
            ...sortCol("stockOnHand", "Stock"),
            align: "center",
            width: 90,
            render: (_, item) => <StockCell item={item} />,
        },
        {
            ...sortCol("stockBuyValue", "Stock buy"),
            align: "right",
            width: 120,
            render: (_, item) => <span className="tabular-nums text-gray-600 dark:text-gray-300">{item.isRecipe ? "—" : money(item.stockBuyValue)}</span>,
        },
        {
            ...sortCol("stockSellValue", "Stock sell"),
            align: "right",
            width: 120,
            render: (_, item) => <span className="tabular-nums text-gray-600 dark:text-gray-300">{item.isRecipe ? "—" : money(item.stockSellValue)}</span>,
        },
    ];

    return (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => setExpanded((e) => !e)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-gray-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 sm:px-5 dark:hover:bg-white/[0.03]"
            >
                <span className="w-1 self-stretch rounded-full" style={{ background: color }} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                    <span className="block min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">{group.categoryName}</span>
                            <Pill>{isTcg ? "TCG & Retail" : "F&B"}</Pill>
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                            {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                            {" · "}{group.totalUnitsSold} units sold
                            {group.totalUnitsGivenFree > 0 && ` · ${group.totalUnitsGivenFree} free`}
                            {group.totalDiscount > 0.004 && ` · ${money(group.totalDiscount)} discounts`}
                        </span>
                    </span>
                    <span className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5 lg:flex lg:shrink-0 lg:items-center lg:gap-6">
                        <Subtotal label="Revenue"><span className="text-gray-900 dark:text-white">{money(group.totalRevenue)}</span></Subtotal>
                        <Subtotal label="COGS"><span className="text-gray-700 dark:text-gray-300">{money(group.totalCogs)}</span></Subtotal>
                        <Subtotal label="Gross profit"><span className={profitCls(group.totalGrossProfit)}>{money(group.totalGrossProfit)}</span></Subtotal>
                        <Subtotal label="Margin"><MarginPill value={group.grossMarginPct} /></Subtotal>
                        <Subtotal label="Stock value"><span className="text-gray-700 dark:text-gray-300">{money(group.totalStockSellValue)}</span></Subtotal>
                    </span>
                </span>
                <DownOutlined
                    aria-hidden
                    className={`shrink-0 text-xs text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
            </button>

            {expanded && (
                <div id={bodyId} className="border-t border-gray-100 dark:border-white/[0.06]">
                    <Table<ItemRevenueLineDto>
                        rowKey="itemId"
                        size="middle"
                        columns={columns}
                        dataSource={sorted}
                        pagination={false}
                        scroll={{ x: 1360 }}
                        summary={() => (
                            <Table.Summary>
                                <Table.Summary.Row className="bg-gray-50 dark:bg-white/[0.02]">
                                    <Table.Summary.Cell index={0}>
                                        <span className="font-semibold text-gray-900 dark:text-white">Subtotal — {group.categoryName}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} />
                                    <Table.Summary.Cell index={2} />
                                    <Table.Summary.Cell index={3} align="right">
                                        <span className="font-semibold tabular-nums">{group.totalUnitsSold}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4} align="right">
                                        <span className="font-semibold tabular-nums">{money(group.totalRevenue)}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={5} align="right">
                                        <span className="font-semibold tabular-nums">{money(group.totalCogs)}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={6} align="right">
                                        <span className={`font-semibold tabular-nums ${profitCls(group.totalGrossProfit)}`}>{money(group.totalGrossProfit)}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={7} align="right">
                                        <MarginPill value={group.grossMarginPct} />
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={8} />
                                    <Table.Summary.Cell index={9} align="right">
                                        <span className="font-semibold tabular-nums">{money(group.totalStockBuyValue)}</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={10} align="right">
                                        <span className="font-semibold tabular-nums">{money(group.totalStockSellValue)}</span>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        )}
                    />
                </div>
            )}
        </section>
    );
}
