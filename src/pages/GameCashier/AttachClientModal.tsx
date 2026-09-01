// AttachClientModal
// =================
// Shared modal used by BoardGameSessions + Ps5Sessions to attach or change
// the client on an open game-session card. Two search modes:
//   1. Type a phone number → live search via /users/search
//   2. Or pick from a paginated dropdown of all clients (Role=6)
// Also lets the cashier clear the client (detach) with a single click.
//
// Backend: PUT /transactions/{id} with { userId } — added by Bug#8.

import { useEffect, useMemo, useState } from "react";
import { Modal, Input, Select, message, Button, Space, Tag } from "antd";
import { UserOutlined, SearchOutlined } from "@ant-design/icons";
import {
  ClientUserDto, searchClientsByPhone, getUsersByRoleId, createClient,
} from "../../services/clientService";
import { attachClientToTransaction } from "../../services/transactionService";

interface Props {
  open: boolean;
  transactionId: number;
  currentUserId: number | null;
  currentUserName: string | null;
  onCancel: () => void;
  // Called after a successful save with the new user info so the parent
  // list can update in-place without a full re-fetch.
  onSaved: (userId: number | null, userName: string | null) => void;
}

const clientLabel = (c: ClientUserDto): string => {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  const parts: string[] = [];
  if (name) parts.push(name);
  if (c.phoneNumber) parts.push(c.phoneNumber);
  if (c.email) parts.push(c.email);
  return parts.join(" · ") || `Client #${c.id}`;
};

export default function AttachClientModal({
  open, transactionId, currentUserId, currentUserName,
  onCancel, onSaved,
}: Props) {
  const [phoneQuery, setPhoneQuery] = useState("");
  const [phoneResults, setPhoneResults] = useState<ClientUserDto[]>([]);
  const [phoneSearching, setPhoneSearching] = useState(false);

  const [allClients, setAllClients] = useState<ClientUserDto[]>([]);
  const [allLoading, setAllLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(currentUserId);
  const [saving, setSaving] = useState(false);

  // Quick-create when the phone search finds nobody — the cashier shouldn't
  // have to leave the modal to register a walk-in.
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [creating, setCreating] = useState(false);

  const quickCreate = async () => {
    if (!newFirst.trim()) { message.warning("First name is required."); return; }
    setCreating(true);
    try {
      const res = await createClient({
        phoneNumber: phoneQuery.trim(),
        firstName: newFirst.trim(),
        lastName: newLast.trim(),
        email: "",
      });
      const created: ClientUserDto = {
        id: res.id,
        phoneNumber: res.phoneNumber,
        firstName: res.firstName ?? newFirst.trim(),
        lastName: res.lastName ?? newLast.trim(),
        email: null,
      } as unknown as ClientUserDto;
      setPhoneResults([created]);
      setSelectedId(res.id);          // pre-selected — one Save away
      setShowCreate(false);
      message.success(res.isNewlyCreated === false ? "Client already existed — selected." : "Client created and selected.");
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Could not create the client.");
    } finally { setCreating(false); }
  };

  // Reset on open so the modal doesn't remember the previous card's state.
  useEffect(() => {
    if (open) {
      setPhoneQuery("");
      setPhoneResults([]);
      setSelectedId(currentUserId ?? null);
      setShowCreate(false); setNewFirst(""); setNewLast("");
    }
  }, [open, currentUserId]);

  // Debounced phone search
  useEffect(() => {
    if (!open) return;
    const q = phoneQuery.trim();
    if (q.length < 3) { setPhoneResults([]); return; }
    let alive = true;
    setPhoneSearching(true);
    const t = setTimeout(() => {
      searchClientsByPhone(q)
        .then(rs => { if (alive) setPhoneResults(rs); })
        .catch(() => { if (alive) setPhoneResults([]); })
        .finally(() => { if (alive) setPhoneSearching(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [open, phoneQuery]);

  // Preload first 50 clients when opening — feeds the dropdown so the
  // cashier can pick without typing.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setAllLoading(true);
    getUsersByRoleId(6, 1, 50)
      .then(r => { if (alive) setAllClients(r.data ?? []); })
      .catch(() => { if (alive) setAllClients([]); })
      .finally(() => { if (alive) setAllLoading(false); });
    return () => { alive = false; };
  }, [open]);

  const dropdownOptions = useMemo(() => {
    const combined = [...allClients];
    // Ensure currently-selected client is present as an option (even if
    // not in the first-50 slice).
    if (currentUserId && !combined.some(c => c.id === currentUserId)) {
      combined.unshift({ id: currentUserId, firstName: currentUserName ?? null } as ClientUserDto);
    }
    return combined.map(c => ({ value: c.id, label: clientLabel(c) }));
  }, [allClients, currentUserId, currentUserName]);

  const save = async (clearInstead = false) => {
    setSaving(true);
    try {
      // null tells the server to detach; a positive id attaches. Using the
      // narrow PUT /transactions/{id}/client endpoint so game-cashier and
      // cashier roles work — the wider PUT /transactions/{id} is admin-only.
      const newUserId = clearInstead ? null : (selectedId ?? null);
      await attachClientToTransaction(transactionId, newUserId);
      // Best-effort resolve the display name for the picked client.
      let newName: string | null = null;
      if (!clearInstead && selectedId) {
        const found = [...allClients, ...phoneResults].find(c => c.id === selectedId);
        if (found) newName = clientLabel(found);
      }
      message.success(clearInstead ? "Client detached" : "Client attached");
      onSaved(clearInstead ? null : (selectedId ?? null), newName);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <UserOutlined />
          <span>Attach / change client on session #{transactionId}</span>
        </Space>
      }
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>Cancel</Button>,
        currentUserId ? (
          <Button key="detach" danger onClick={() => save(true)} loading={saving}>
            Detach client
          </Button>
        ) : null,
        <Button key="save" type="primary" disabled={selectedId == null} onClick={() => save(false)} loading={saving}>
          Save
        </Button>,
      ]}
      destroyOnHidden
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {currentUserName && (
          <div>
            <Tag color="blue">Currently attached: {currentUserName}</Tag>
          </div>
        )}

        {/* Method A: search by phone */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4B5563", marginBottom: 6 }}>
            Search by phone
          </div>
          <Input
            placeholder="Type at least 3 digits…"
            prefix={<SearchOutlined />}
            value={phoneQuery}
            onChange={(e) => setPhoneQuery(e.target.value)}
            allowClear
          />
          {phoneSearching && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Searching…</div>}
          {phoneResults.length > 0 && (
            <div style={{
              marginTop: 6, maxHeight: 160, overflow: "auto",
              border: "1px solid #E5E7EB", borderRadius: 6,
            }}>
              {phoneResults.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    padding: "8px 10px", cursor: "pointer",
                    background: selectedId === c.id ? "#EFF6FF" : "white",
                    borderBottom: "1px solid #F3F4F6", fontSize: 13,
                  }}
                >
                  {clientLabel(c)}
                </div>
              ))}
            </div>
          )}

          {/* Nobody found → create them right here, phone prefilled */}
          {!phoneSearching && phoneQuery.trim().length >= 3 && phoneResults.length === 0 && (
            <div style={{ marginTop: 8, border: "1px dashed #D1D5DB", borderRadius: 8, padding: "10px 12px" }}>
              {!showCreate ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    No client with “{phoneQuery.trim()}”.
                  </span>
                  <Button size="small" type="primary" ghost onClick={() => setShowCreate(true)}>
                    + Create client
                  </Button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    New client — phone <b>{phoneQuery.trim()}</b>
                  </div>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input placeholder="First name" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} />
                    <Input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)} />
                  </Space.Compact>
                  <Space>
                    <Button size="small" type="primary" loading={creating} onClick={quickCreate}>
                      Create & select
                    </Button>
                    <Button size="small" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </Space>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Method B: pick from dropdown */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4B5563", marginBottom: 6 }}>
            Or pick from list
          </div>
          <Select
            style={{ width: "100%" }}
            placeholder="Select a client…"
            showSearch
            optionFilterProp="label"
            loading={allLoading}
            value={selectedId ?? undefined}
            onChange={(v) => setSelectedId(v as number)}
            options={dropdownOptions}
            allowClear
            onClear={() => setSelectedId(null)}
          />
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
            Showing first 50 clients. Use the phone search above for older records.
          </div>
        </div>
      </div>
    </Modal>
  );
}
