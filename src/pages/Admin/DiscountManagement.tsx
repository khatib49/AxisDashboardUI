import { useEffect, useState } from "react";
import { Button, Empty, Input as AntInput, Skeleton, Tooltip } from "antd";
import {
    CheckCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    PercentageOutlined,
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    StopOutlined,
} from "@ant-design/icons";
import {
    getDiscounts,
    getDiscountById,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    DiscountDto,
    DiscountListResponse,
    DiscountCreateDto,
    DiscountUpdateDto,
} from "../../services/discountService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { ErrorNote, IconChip, RowMenu, Toast, VenuePager } from "../../components/admin/venue/VenueKit";

export default function DiscountManagement() {
    const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // Bumped by the Refresh button to re-run the same list request.
    const [reloadToken, setReloadToken] = useState(0);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<DiscountDto | null>(null);
    const [form, setForm] = useState<{
        name: string;
        type: string;
        description: string;
        percentage: number;
        isActive: boolean;
    }>({
        name: "",
        type: "",
        description: "",
        percentage: 0,
        isActive: true,
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

    // Debounce search input
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getDiscounts(page, pageSize, debouncedSearch || undefined)
            .then((res: DiscountListResponse) => {
                if (!mounted) return;
                setDiscounts(res.data || []);
                setTotalCount(res.totalCount ?? null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load discounts");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [page, pageSize, debouncedSearch, reloadToken]);

    function openCreate() {
        setEditing(null);
        setForm({
            name: "",
            type: "",
            description: "",
            percentage: 0,
            isActive: true,
        });
        setIsFormOpen(true);
    }

    async function openEdit(id: number) {
        setLoading(true);
        try {
            const dto = await getDiscountById(id);
            setEditing(dto);
            setForm({
                name: dto.name,
                type: dto.type,
                description: dto.description || "",
                percentage: dto.percentage,
                isActive: dto.isActive,
            });
            setIsFormOpen(true);
        } catch (err: unknown) {
            let message = "Failed to load discount";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setNotification({ variant: "error", title: "Load failed", message });
        } finally {
            setLoading(false);
        }
    }

    async function submitForm() {
        if (!form.name.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Name is required",
            });
            return;
        }

        if (!form.type.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Type is required",
            });
            return;
        }

        if (form.percentage < 0 || form.percentage > 100) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Percentage must be between 0 and 100",
            });
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                const dto: DiscountUpdateDto = {
                    name: form.name,
                    type: form.type,
                    description: form.description || null,
                    percentage: form.percentage,
                    isActive: form.isActive,
                };
                await updateDiscount(editing.id, dto);
                setDiscounts((s) =>
                    s.map((d) =>
                        d.id === editing.id
                            ? {
                                ...d,
                                name: form.name,
                                type: form.type,
                                description: form.description || null,
                                percentage: form.percentage,
                                isActive: form.isActive,
                            }
                            : d
                    )
                );
                setNotification({
                    variant: "success",
                    title: "Updated",
                    message: "Discount updated successfully",
                });
            } else {
                const dto: DiscountCreateDto = {
                    name: form.name,
                    type: form.type,
                    description: form.description || null,
                    percentage: form.percentage,
                    isActive: form.isActive,
                };
                const created = await createDiscount(dto);
                setDiscounts((s) => [created, ...s]);
                setNotification({
                    variant: "success",
                    title: "Created",
                    message: `Discount '${created.name}' created successfully`,
                });
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

    async function toggleDiscountStatus(discount: DiscountDto) {
        try {
            const dto: DiscountUpdateDto = {
                isActive: !discount.isActive,
            };
            await updateDiscount(discount.id, dto);
            setDiscounts((s) =>
                s.map((d) =>
                    d.id === discount.id ? { ...d, isActive: !d.isActive } : d
                )
            );
            setNotification({
                variant: "success",
                title: "Status Updated",
                message: `Discount ${!discount.isActive ? "activated" : "deactivated"} successfully`,
            });
        } catch (err: unknown) {
            let message = "Failed to update status";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setNotification({ variant: "error", title: "Update failed", message });
        }
    }

    // ── List presentation (derived from the page already loaded) ────────
    const firstLoad = loading && totalCount === null;
    const activeOnPage = discounts.filter((d) => d.isActive).length;
    const inactiveOnPage = discounts.length - activeOnPage;
    const topPercentage = discounts.length ? Math.max(...discounts.map((d) => d.percentage)) : null;

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="violet"
                icon={<PercentageOutlined />}
                title="Discount Management"
                description="Percentage discounts cashiers can apply at checkout. Inactive discounts stay on file but can't be applied."
                actions={
                    <>
                        <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} onClick={() => setReloadToken((t) => t + 1)} loading={loading} aria-label="Refresh" />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add discount</Button>
                    </>
                }
            />

            {/* KPIs — derived from the list already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Discounts"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{(totalCount ?? discounts.length).toLocaleString("en-US")}</span>}
                    sub={debouncedSearch ? `Matching “${debouncedSearch}”` : "All discounts"}
                    accent={<IconChip tone="violet"><PercentageOutlined /></IconChip>}
                />
                <StatTile
                    label="Active"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{activeOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="emerald"><CheckCircleOutlined /></IconChip>}
                />
                <StatTile
                    label="Inactive"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{inactiveOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="gray"><StopOutlined /></IconChip>}
                />
                <StatTile
                    label="Highest discount"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{topPercentage !== null ? `${topPercentage}%` : "—"}</span>}
                    sub="On this page"
                />
            </div>

            <Panel
                title="All discounts"
                subtitle={totalCount !== null ? `${totalCount.toLocaleString("en-US")} discount${totalCount === 1 ? "" : "s"}` : undefined}
                bodyClassName="p-0"
                extra={
                    <AntInput
                        allowClear
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="Search discounts..."
                        aria-label="Search discounts"
                        value={search}
                        onChange={(e) => {
                            setPage(1);
                            setSearch(e.target.value);
                        }}
                        className="w-full sm:w-64!"
                    />
                }
            >
                {error ? (
                    <ErrorNote>{error}</ErrorNote>
                ) : loading && discounts.length === 0 ? (
                    <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>
                ) : discounts.length === 0 ? (
                    <div className="py-12"><Empty description={debouncedSearch ? `Nothing matches “${debouncedSearch}”` : "No discounts found"} /></div>
                ) : (
                    <ul className={`divide-y divide-gray-100 transition-opacity dark:divide-white/[0.06] ${loading ? "pointer-events-none opacity-50" : ""}`} aria-busy={loading}>
                        {discounts.map((discount) => (
                            <li key={discount.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                                {/* Percentage, front and centre */}
                                <span
                                    className={`flex h-12 w-14 shrink-0 items-center justify-center rounded-xl text-base font-semibold tabular-nums ${
                                        discount.isActive
                                            ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                                            : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                                    }`}
                                >
                                    {discount.percentage}%
                                </span>

                                <div className="min-w-[180px] flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(discount.id)}
                                            className="text-left font-medium text-gray-900 hover:text-violet-700 dark:text-gray-100 dark:hover:text-violet-300"
                                        >
                                            {discount.name}
                                        </button>
                                        {discount.type && <Pill tone="blue">{discount.type}</Pill>}
                                    </div>
                                    <div className="mt-0.5 max-w-xl truncate text-xs text-gray-500 dark:text-gray-400">
                                        {discount.description || "-"}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Clicking the status toggles it, as before */}
                                    <Tooltip title={discount.isActive ? "Click to deactivate" : "Click to activate"}>
                                        <button
                                            type="button"
                                            onClick={() => toggleDiscountStatus(discount)}
                                            aria-label={`${discount.isActive ? "Deactivate" : "Activate"} ${discount.name}`}
                                            className="rounded-full transition hover:opacity-80"
                                        >
                                            <Pill tone={discount.isActive ? "emerald" : "gray"} dot>
                                                {discount.isActive ? "Active" : "Inactive"}
                                            </Pill>
                                        </button>
                                    </Tooltip>
                                    <RowMenu
                                        label={discount.name}
                                        items={[
                                            { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openEdit(discount.id) },
                                            {
                                                key: "toggle",
                                                icon: discount.isActive ? <StopOutlined /> : <CheckCircleOutlined />,
                                                label: discount.isActive ? "Deactivate" : "Activate",
                                                onClick: () => toggleDiscountStatus(discount),
                                            },
                                            { type: "divider" },
                                            { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => setDeleteId(discount.id) },
                                        ]}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Pagination controls */}
                <VenuePager
                    shown={discounts.length}
                    total={totalCount}
                    page={page}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    prevDisabled={page <= 1}
                    nextDisabled={totalCount !== null && page * pageSize >= totalCount}
                />
            </Panel>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Discount" : "Create Discount"}
                className="sm:max-w-xl!"
                footer={
                    <>
                        <Button onClick={() => setIsFormOpen(false)}>Cancel</Button>
                        <Button type="primary" onClick={submitForm} disabled={submitting} icon={submitting ? <Loader size={16} /> : undefined}>
                            {editing ? "Save" : "Create"}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <Label>Name *</Label>
                        <Input
                            placeholder="e.g., Summer Sale"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Type *</Label>
                        <Input
                            placeholder="e.g., seasonal, promotional"
                            value={form.type}
                            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Percentage *</Label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="0-100"
                                    value={form.percentage}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, percentage: Number(e.target.value) }))
                                    }
                                />
                            </div>
                            <span
                                aria-hidden
                                className="flex h-11 min-w-14 shrink-0 items-center justify-center rounded-lg bg-violet-50 px-2 text-sm font-semibold tabular-nums text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                            >
                                {Number.isFinite(form.percentage) ? form.percentage : 0}%
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Enter a value between 0 and 100
                        </p>
                    </div>
                    <div>
                        <Label>Description</Label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 dark:bg-gray-900 dark:text-white resize-none text-sm"
                            rows={3}
                            placeholder="Optional description..."
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/10">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={form.isActive}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, isActive: e.target.checked }))
                            }
                            className="w-4 h-4 accent-violet-600 border-gray-300 rounded focus:ring-violet-500"
                        />
                        <Label htmlFor="isActive" className="mb-0 cursor-pointer">
                            Active
                        </Label>
                        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">Inactive discounts can't be applied</span>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm Delete"
                className="sm:max-w-md!"
                footer={
                    <>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button
                            danger
                            type="primary"
                            icon={deleting ? <Loader size={16} /> : undefined}
                            onClick={async () => {
                                if (deleteId === null) return;
                                setDeleting(true);
                                try {
                                    await deleteDiscount(deleteId);
                                    setDiscounts((s) => s.filter((x) => x.id !== deleteId));
                                    setDeleteId(null);
                                    setError(null);
                                    setNotification({
                                        variant: "success",
                                        title: "Deleted",
                                        message: "Discount deleted successfully",
                                    });
                                } catch (err) {
                                    let message = "Failed to delete";
                                    if (err && typeof err === "object") {
                                        const maybe = err as { message?: unknown };
                                        if (typeof maybe.message === "string") message = maybe.message;
                                    }
                                    setError(message);
                                    setNotification({
                                        variant: "error",
                                        title: "Delete failed",
                                        message,
                                    });
                                } finally {
                                    setDeleting(false);
                                }
                            }}
                            disabled={deleting}
                        >
                            Delete
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        Are you sure you want to delete this discount? This action cannot be undone.
                    </p>
                </div>
            </Modal>

            {/* Toast notification */}
            <Toast notification={notification} />
        </div>
    );
}
