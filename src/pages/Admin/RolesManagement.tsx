// Roles & Permissions (Admin → Roles & Permissions).
// Route: /admin/roles  (admin only)
//
// Create a role and tick the pages it may open. A role that can open a page
// may also call that page's API. The admin role always has everything.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Modal, Popconfirm, Skeleton, Tooltip, message } from "antd";
import {
  AppstoreOutlined,
  CrownOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  TeamOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import PageMeta from "../../components/common/PageMeta";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import PermissionChecklist from "../../components/admin/people/PermissionChecklist";
import { PAGE_GROUPS } from "../../config/pages";
import { useAuth } from "../../context/AuthContext";
import {
  PageInfo, RoleInfo, createRole, deleteRole, getPageCatalog, getRoles, roleLabel, setRolePages,
} from "../../services/roleService";

const SOCIAL_HINT: Record<string, string> = {
  admin: "Full access to every page. Cannot be changed.",
  social_media: "Runs the events and the public website.",
  cashier: "Food & beverage till.",
  gamecashier: "Game till: sessions, rooms, items.",
  admin_fnb: "Food & beverage management.",
  chef: "Kitchen orders and stock.",
  stock: "Stock management only.",
  bartender: "Bar orders.",
  client: "Customer accounts (wallets & AXIS PLUS). Not staff — leave without pages.",
};

export default function RolesManagement() {
  const { claims } = useAuth();
  const [catalog, setCatalog] = useState<PageInfo[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPages, setNewPages] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([getPageCatalog(), getRoles()]);
      setCatalog(c);
      setRoles(r);
      setSelected((cur) => cur ?? r.find((x) => x.name !== "admin")?.name ?? r[0]?.name ?? null);
    } catch (e) {
      message.error((e as { message?: string })?.message || "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => roles.find((r) => r.name === selected) ?? null, [roles, selected]);

  // Reset the draft whenever another role is picked or the list reloads.
  useEffect(() => {
    setDraft(new Set(current?.pages ?? []));
  }, [current]);

  const groups = useMemo(() => {
    const order = PAGE_GROUPS.map((g) => g.name);
    const byGroup = new Map<string, PageInfo[]>();
    for (const p of catalog) byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
    return [...byGroup.entries()].sort(
      (a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0]))
    );
  }, [catalog]);

  const dirty = useMemo(() => {
    if (!current) return false;
    const a = [...draft].sort().join("|");
    const b = [...current.pages].sort().join("|");
    return a !== b;
  }, [draft, current]);

  const isAdminRole = current?.name === "admin";
  const editable = !!current && !isAdminRole;

  const save = async () => {
    if (!current || !editable) return;
    setSaving(true);
    try {
      const updated = await setRolePages(current.name, [...draft]);
      setRoles((rs) => rs.map((r) => (r.name === updated.name ? updated : r)));
      message.success(`Permissions for "${roleLabel(updated.name)}" saved. Users see the change on their next page load.`);
    } catch (e) {
      message.error((e as { message?: string })?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name) {
      message.warning("Give the role a name.");
      return;
    }
    setCreating(true);
    try {
      const role = await createRole(name, [...newPages]);
      setRoles((rs) => [...rs, role]);
      setSelected(role.name);
      setCreateOpen(false);
      setNewName("");
      setNewPages(new Set());
      message.success(`Role "${roleLabel(role.name)}" created. Assign it to users under Users Management.`);
    } catch (e) {
      message.error((e as { message?: string })?.message || "Could not create the role");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (name: string) => {
    try {
      await deleteRole(name);
      setRoles((rs) => rs.filter((r) => r.name !== name));
      if (selected === name) setSelected(null);
      message.success(`Role "${roleLabel(name)}" deleted.`);
    } catch (e) {
      message.error((e as { message?: string })?.message || "Could not delete the role");
    }
  };

  // KPIs — all from the two lists already loaded.
  const firstLoad = loading && roles.length === 0;
  const builtInCount = roles.filter((r) => r.builtIn).length;
  const customCount = roles.length - builtInCount;
  const assignedUsers = roles.reduce((n, r) => n + (r.users || 0), 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageMeta title="Roles & Permissions — AXIS Admin" description="Create roles and choose which pages each role can open" />

      <PageHeader
        icon={<SafetyCertificateOutlined />}
        title="Roles & Permissions"
        description="Create a role, tick the pages it may open, then assign it to users under Users Management."
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New role
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Roles"
          loading={firstLoad}
          value={<span className="tabular-nums">{roles.length}</span>}
          sub={`${builtInCount} built-in · ${customCount} custom`}
          accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><SafetyCertificateOutlined /></span>}
        />
        <StatTile
          label="Custom roles"
          loading={firstLoad}
          value={<span className="tabular-nums">{customCount}</span>}
          sub="Created here — can be deleted"
        />
        <StatTile
          label="Role assignments"
          loading={firstLoad}
          value={<span className="tabular-nums">{assignedUsers}</span>}
          sub="Users holding each role, summed"
          accent={<span className="rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><TeamOutlined /></span>}
        />
        <StatTile
          label="Pages"
          loading={firstLoad}
          value={<span className="tabular-nums">{catalog.length}</span>}
          sub={`In ${groups.length} group${groups.length === 1 ? "" : "s"}`}
          accent={<span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><AppstoreOutlined /></span>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Role list */}
        <Panel title="Roles" subtitle="Pick a role to edit its pages" bodyClassName="p-2">
          {firstLoad ? (
            <div className="p-3"><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : roles.length === 0 ? (
            <div className="py-8"><Empty description="No roles yet" /></div>
          ) : (
            <ul className="space-y-1">
              {roles.map((r) => {
                const active = r.name === selected;
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.name)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10"
                          : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-white/10 dark:hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                          active
                            ? "bg-white text-violet-600 shadow-sm dark:bg-violet-500/20 dark:text-violet-200"
                            : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                        }`}
                      >
                        {r.name === "admin" ? <CrownOutlined /> : <TeamOutlined />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{roleLabel(r.name)}</span>
                          {r.builtIn && <Pill tone="gray">Built-in</Pill>}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {r.users} user{r.users === 1 ? "" : "s"} · {r.name === "admin" ? "all pages" : `${r.pages.length} page${r.pages.length === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Permissions editor */}
        {!current ? (
          <Panel title="Pick a role" subtitle="Select a role on the left, or create a new one.">
            {firstLoad ? <Skeleton active paragraph={{ rows: 6 }} /> : <Empty description="No role selected" />}
          </Panel>
        ) : (
          <Panel
            title={
              <span className="flex flex-wrap items-center gap-2">
                {roleLabel(current.name)}
                {current.builtIn ? <Pill tone="gray">Built-in</Pill> : <Pill tone="violet">Custom</Pill>}
                {editable && dirty && <Pill tone="amber" dot>Unsaved</Pill>}
              </span>
            }
            subtitle={
              <>
                {SOCIAL_HINT[current.name] ?? "Custom role."}
                {!isAdminRole && <> · <span className="tabular-nums">{draft.size} of {catalog.length}</span> pages · {current.users} user{current.users === 1 ? "" : "s"}</>}
              </>
            }
            extra={
              <div className="flex flex-wrap items-center gap-2">
                {editable && (
                  <>
                    <Tooltip title="Undo unsaved changes">
                      <Button icon={<UndoOutlined />} disabled={!dirty} onClick={() => setDraft(new Set(current.pages))}>
                        Discard
                      </Button>
                    </Tooltip>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!dirty} onClick={save}>
                      Save
                    </Button>
                  </>
                )}
                {!current.builtIn && (
                  <Popconfirm
                    title={`Delete the "${roleLabel(current.name)}" role?`}
                    description={current.users > 0 ? `${current.users} user(s) still hold it — reassign them first.` : "This can't be undone."}
                    okText="Delete"
                    okButtonProps={{ danger: true, disabled: current.users > 0 }}
                    onConfirm={() => remove(current.name)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Delete
                    </Button>
                  </Popconfirm>
                )}
              </div>
            }
          >
            {isAdminRole ? (
              <Alert type="info" showIcon message="Admins can open every page and use every API. This role can't be edited." />
            ) : (
              <>
                {dirty && <Alert type="warning" showIcon className="mb-4" message="Unsaved changes — press Save to apply them." />}
                {current.name === claims?.primaryRole && (
                  <Alert type="info" showIcon className="mb-4" message="This is your own role. Changes apply to you too." />
                )}
                <PermissionChecklist groups={groups} value={draft} onChange={setDraft} />
              </>
            )}
          </Panel>
        )}
      </div>

      <Modal
        open={createOpen}
        title="New role"
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        okText="Create role"
        confirmLoading={creating}
        width={960}
      >
        <div className="space-y-5 pt-2">
          <div>
            <div className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Role name</div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. marketing, floor_manager"
              maxLength={40}
              onPressEnter={create}
            />
            <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">Lower-case letters, digits and underscores. Spaces become underscores.</div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pages this role can open</span>
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{newPages.size} of {catalog.length} selected</span>
            </div>
            <PermissionChecklist groups={groups} value={newPages} onChange={setNewPages} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
