import { useEffect, useState } from "react";
import { Button, Dropdown, Empty, Skeleton, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    DeleteOutlined,
    EditOutlined,
    MoreOutlined,
    PlusOutlined,
    ReloadOutlined,
    ShoppingCartOutlined,
    TagsOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    CategoryDto,
    CategoryListResponse,
} from "../../services/categoryService";
import Modal from "../../components/ui/Modal";
import Select from "../../components/form/Select";
import Input from "../../components/form/input/InputField";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { CategoryTypes } from "../../utils/common-data/commonData";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import PagerFooter from "../../components/inventory/PagerFooter";

type PillTone = "gray" | "violet" | "purple" | "blue" | "emerald" | "amber" | "red";

// Category "type" values (see CategoryTypes) → pill look.
const TYPE_META: Record<string, { label: string; tone: PillTone }> = {
    item: { label: "Item", tone: "blue" },
    game: { label: "Game", tone: "violet" },
    gameSettingsType: { label: "Game settings type", tone: "purple" },
};

const ITEM_TYPE_TONE: Record<string, PillTone> = {
    Retail: "blue",
    Drinks: "emerald",
    Tobacco: "amber",
    Food: "violet",
};

export default function CategoryManagement() {
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    // Bumped by the Refresh button to re-run the same list request.
    const [reloadToken, setReloadToken] = useState(0);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<CategoryDto | null>(null);
    type CategoryForm = { name: string; type: string; itemType: string; showInShop: boolean; defaultWeightKg: string };
    const emptyForm = (): CategoryForm => ({ name: "", type: "item", itemType: "", showInShop: false, defaultWeightKg: "" });
    const [form, setForm] = useState<CategoryForm>(emptyForm());
    const toInput = (f: CategoryForm) => ({
        name: f.name, type: f.type, itemType: f.itemType,
        showInShop: f.showInShop,
        defaultWeightKg: f.defaultWeightKg.trim() === "" ? null : Number(f.defaultWeightKg),
    });
    const [submitting, setSubmitting] = useState(false);

    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [notification, setNotification] = useState<{
        variant: "success" | "error" | "warning" | "info";
        title: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 3500);
        return () => clearTimeout(t);
    }, [notification]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getCategories(page, pageSize)
            .then((res: CategoryListResponse) => {
                if (!mounted) return;
                setCategories(res.data || []);
                setTotalCount(res.totalCount ?? null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load categories");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });
        return () => { mounted = false; };
    }, [page, pageSize, reloadToken]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm());
        setIsFormOpen(true);
    }

    async function openEdit(id: number) {
        setLoading(true);
        try {
            const dto = await getCategoryById(id);
            setEditing(dto);
            setForm({
                name: dto.name, type: dto.type ?? "item", itemType: dto.itemType ?? "",
                showInShop: dto.showInShop ?? false,
                defaultWeightKg: dto.defaultWeightKg != null ? String(dto.defaultWeightKg) : "",
            });
            setIsFormOpen(true);
        } catch (err: unknown) {
            let message = "Failed to load category";
            if (err && typeof err === 'object') {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === 'string') message = maybe.message;
            }
            setNotification({ variant: "error", title: "Load failed", message });
        } finally {
            setLoading(false);
        }
    }

    async function submitForm() {
        setSubmitting(true);
        try {
            const input = toInput(form);
            if (editing) {
                await updateCategory(editing.id, input);
                setCategories((s) => s.map((c) => (c.id === editing.id ? { ...c, ...input } : c)));
                setNotification({ variant: "success", title: "Updated", message: "Category updated" });
            } else {
                const created = await createCategory(input);
                setCategories((s) => [created, ...s]);
                setNotification({ variant: "success", title: "Created", message: `Category '${created.name}' created` });
            }
            setIsFormOpen(false);
            setEditing(null);
        } catch (err: unknown) {
            let message = "Failed to save";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setError(message);
            setNotification({ variant: "error", title: "Save failed", message });
        } finally {
            setSubmitting(false);
        }
    }

    // ── List presentation ──────────────────────────────────────────────
    const firstLoad = loading && totalCount === null;
    const inShopOnPage = categories.filter(c => c.showInShop).length;
    const unnamedOnPage = categories.filter(c => !c.name?.trim()).length;

    const columns: ColumnsType<CategoryDto> = [
        {
            title: "Name",
            key: "name",
            render: (_, c) => (
                <div>
                    {c.name?.trim()
                        ? <div className="font-medium text-gray-900 dark:text-gray-100">{c.name}</div>
                        : <div className="italic text-gray-400 dark:text-gray-500">(no name)</div>}
                    <div className="mt-0.5 text-[11px] text-gray-400 tabular-nums dark:text-gray-500">#{c.id}</div>
                </div>
            ),
        },
        {
            title: "Type",
            dataIndex: "type",
            width: 180,
            render: (v?: string) => {
                if (!v) return <span className="text-gray-400 dark:text-gray-500">—</span>;
                const meta = TYPE_META[v];
                const label = meta?.label ?? CategoryTypes.find(t => t.value === v)?.label ?? v;
                return <Pill tone={meta?.tone ?? "gray"} dot>{label}</Pill>;
            },
        },
        {
            title: "Item type",
            dataIndex: "itemType",
            width: 140,
            render: (v?: string) => v
                ? <Pill tone={ITEM_TYPE_TONE[v] ?? "gray"}>{v}</Pill>
                : <span className="text-gray-400 dark:text-gray-500">—</span>,
        },
        {
            title: "Online shop",
            key: "shop",
            width: 200,
            render: (_, c) => (
                <div className="flex flex-wrap items-center gap-2">
                    {c.showInShop
                        ? <Pill tone="emerald" dot>In shop</Pill>
                        : <span className="text-xs text-gray-400 dark:text-gray-500">Hidden</span>}
                    {c.defaultWeightKg != null && (
                        <Tooltip title="Default weight for items without their own">
                            <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{c.defaultWeightKg} kg</span>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            title: "",
            key: "actions",
            width: 56,
            align: "right",
            render: (_, c) => (
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: [
                            { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openEdit(c.id) },
                            { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => setDeleteId(c.id) },
                        ],
                    }}
                >
                    <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Actions for ${c.name?.trim() || `category #${c.id}`}`} />
                </Dropdown>
            ),
        },
    ];

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="violet"
                icon={<TagsOutlined />}
                title="Category Management"
                description="Item, game and game-settings categories — and which item categories appear in the online shop."
                actions={
                    <>
                        <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} onClick={() => setReloadToken((t) => t + 1)} loading={loading} aria-label="Refresh" />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add category</Button>
                    </>
                }
            />

            {/* KPIs — derived from the list already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatTile
                    label="Categories"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{(totalCount ?? categories.length).toLocaleString("en-US")}</span>}
                    sub="All types"
                    accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><TagsOutlined /></span>}
                />
                <StatTile
                    label="In online shop"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{inShopOnPage}</span>}
                    sub="On this page"
                    accent={<span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><ShoppingCartOutlined /></span>}
                />
                <StatTile
                    label="Without a name"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{unnamedOnPage}</span>}
                    sub={unnamedOnPage ? "On this page — edit them to add a name" : "On this page"}
                    accent={unnamedOnPage ? <span className="text-amber-500"><WarningOutlined /></span> : undefined}
                />
            </div>

            <Panel
                title="All categories"
                subtitle={totalCount !== null ? `${totalCount.toLocaleString("en-US")} categor${totalCount === 1 ? "y" : "ies"}` : undefined}
                bodyClassName="p-0"
            >
                {error ? (
                    <div className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>
                ) : firstLoad ? (
                    <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>
                ) : (
                    <Table
                        rowKey="id"
                        size="middle"
                        loading={loading}
                        columns={columns}
                        dataSource={categories}
                        pagination={false}
                        scroll={{ x: 760 }}
                        locale={{ emptyText: <Empty description="No categories yet" /> }}
                    />
                )}

                {/* Pagination controls */}
                <PagerFooter
                    shown={categories.length}
                    total={totalCount}
                    page={page}
                    pageSize={pageSize}
                    onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    prevDisabled={page <= 1}
                    nextDisabled={totalCount !== null && page * pageSize >= (totalCount || 0)}
                />
            </Panel>

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Category" : "Create Category"}
                footer={(
                    <>
                        <button className="px-3 py-1 bg-green-600 text-white rounded flex items-center gap-2" onClick={submitForm}>
                            {submitting ? <Loader size={16} /> : (editing ? 'Save' : 'Create')}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIsFormOpen(false)}>Cancel</button>
                    </>
                )}
            >
                <div className="flex flex-col gap-3">
                    <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    <label className="text-sm text-gray-600">Type</label>
                    <Select options={CategoryTypes} defaultValue={form.type} onChange={(v: string | number) => setForm((f) => ({ ...f, type: String(v) }))} />
                    <label className="text-sm text-gray-600">Item Type</label>
                    <Select options={[
                        { value: "", label: "-- None --" },
                        { value: "Retail", label: "Retail" },
                        { value: "Drinks", label: "Drinks" },
                        { value: "Tobacco", label: "Tobacco" },
                        { value: "Food", label: "Food" }
                    ]} defaultValue={form.itemType} onChange={(v: string | number) => setForm((f) => ({ ...f, itemType: v === "" ? "" : String(v) }))} />

                    <div className="mt-1 rounded-lg border border-sky-200 bg-sky-50/40 p-3 flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                            <input type="checkbox" checked={form.showInShop} onChange={(e) => setForm((f) => ({ ...f, showInShop: e.target.checked }))} />
                            Show in online shop
                        </label>
                        <div className="text-xs text-gray-500">Items in this category (marked "sell online") appear on the website shop and can be delivered.</div>
                        <label className="text-sm text-gray-600">Default weight (kg)</label>
                        <Input type="number" step={0.1} min="0" placeholder="e.g. 0.5 — used for items without their own weight" value={form.defaultWeightKg}
                            onChange={(e) => setForm((f) => ({ ...f, defaultWeightKg: e.target.value }))} />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm delete"
                footer={(
                    <>
                        <button className="px-3 py-1 bg-red-600 text-white rounded flex items-center gap-2" onClick={async () => {
                            if (deleteId === null) return;
                            setDeleting(true);
                            try {
                                await deleteCategory(deleteId);
                                setCategories((s) => s.filter(x => x.id !== deleteId));
                                setDeleteId(null);
                                setError(null);
                                setNotification({ variant: "success", title: "Deleted", message: "Category deleted" });
                            } catch (err) {
                                let message = 'Failed to delete';
                                if (err && typeof err === 'object') {
                                    const maybe = err as { message?: unknown };
                                    if (typeof maybe.message === 'string') message = maybe.message;
                                }
                                setError(message);
                                setNotification({ variant: "error", title: "Delete failed", message });
                            } finally {
                                setDeleting(false);
                            }
                        }}>
                            {deleting ? <Loader size={16} /> : 'Delete'}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setDeleteId(null)}>Cancel</button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p>Are you sure you want to delete this category?</p>
                </div>
            </Modal>

            {/* Toast container bottom-right */}
            <div className="fixed bottom-6 right-6 z-50">
                {notification && (
                    <div className="max-w-sm">
                        <Alert variant={notification.variant} title={notification.title} message={notification.message} />
                    </div>
                )}
            </div>
        </div>
    );
}
