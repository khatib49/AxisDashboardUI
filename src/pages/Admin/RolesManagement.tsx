// Roles & Permissions (Admin → Roles & Permissions).
// Route: /admin/roles  (admin only)
//
// Create a role and tick the pages it may open. A role that can open a page
// may also call that page's API. The admin role always has everything.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Popconfirm, Tag, Tooltip, message } from "antd";
import { DeleteOutlined, PlusOutlined, SaveOutlined, TeamOutlined, UndoOutlined } from "@ant-design/icons";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
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

  const toggle = (set: Set<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };

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

  const PermissionGrid = ({ value, onChange, disabled }: { value: Set<string>; onChange: (next: Set<string>) => void; disabled?: boolean }) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(([group, pages]) => {
        const all = pages.every((p) => value.has(p.key));
        const some = !all && pages.some((p) => value.has(p.key));
        return (
          <div key={group} className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="mb-2 flex cursor-pointer items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">{group}</span>
              <Checkbox
                checked={all}
                indeterminate={some}
                disabled={disabled}
                onChange={(e) => {
                  let next = new Set(value);
                  for (const p of pages) next = toggle(next, p.key, e.target.checked);
                  onChange(next);
                }}
              />
            </label>
            <div className="space-y-1">
              {pages.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-white dark:hover:bg-white/5">
                  <Checkbox checked={value.has(p.key)} disabled={disabled} onChange={(e) => onChange(toggle(value, p.key, e.target.checked))} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
                  <span className="ml-auto truncate text-[11px] text-gray-400">{p.path}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageMeta title="Roles & Permissions — AXIS Admin" description="Create roles and choose which pages each role can open" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a role, tick the pages it may open, then assign it to users under Users Management.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New role
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Role list */}
        <div className="space-y-2">
          {loading && roles.length === 0 && <div className="text-sm text-gray-500">Loading roles…</div>}
          {roles.map((r) => {
            const active = r.name === selected;
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => setSelected(r.name)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  active
                    ? "border-brand-200 bg-brand-50 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/15"
                    : "border-transparent hover:border-gray-200 hover:bg-white dark:hover:border-white/10 dark:hover:bg-white/5"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? "bg-white text-brand-600 dark:bg-brand-500/20 dark:text-brand-200" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>
                  <TeamOutlined />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{roleLabel(r.name)}</span>
                    {r.builtIn && <Tag className="!m-0 !text-[10px]">built-in</Tag>}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {r.users} user{r.users === 1 ? "" : "s"} · {r.name === "admin" ? "all pages" : `${r.pages.length} page${r.pages.length === 1 ? "" : "s"}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Permissions editor */}
        <div>
          {!current ? (
            <ComponentCard title="Pick a role" desc="Select a role on the left, or create a new one.">
              <div />
            </ComponentCard>
          ) : (
            <ComponentCard
              title={roleLabel(current.name)}
              desc={SOCIAL_HINT[current.name] ?? "Custom role."}
              action={
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
                  <PermissionGrid value={draft} onChange={setDraft} />
                </>
              )}
            </ComponentCard>
          )}
        </div>
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
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Role name</div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. marketing, floor_manager"
              maxLength={40}
              onPressEnter={create}
            />
            <div className="mt-1 text-xs text-gray-400">Lower-case letters, digits and underscores. Spaces become underscores.</div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Pages this role can open</div>
            <PermissionGrid value={newPages} onChange={setNewPages} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
