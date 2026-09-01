// Admin CMS for public event pages.
// Route: /admin/events  (admin only)
//
// One place to: write the copy, upload the promo video, set the price,
// choose which payment methods are live, edit the WhatsApp confirmation
// message, and publish.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, InputNumber,
  Switch, DatePicker, message, Typography, Progress, Tooltip, Popconfirm,
  Segmented, Select,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  VideoCameraOutlined, LinkOutlined, EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  listEvents, createEvent, updateEvent, deleteEvent,
  uploadEventVideo, removeEventVideo,
  EventDto, EventUpsert, EventFeature,
} from "../../services/eventService";

const { Text, Title, Paragraph } = Typography;

const PLACEHOLDERS = [
  "eventTitle", "registrationId", "fullName", "firstName", "lastName",
  "phone", "email", "paymentMethod", "amount", "currency", "eventDate", "location",
];

// Chip colors on the calendar, keyed by event type. Types are free text
// server-side; anything unknown falls back to "Other".
export const EVENT_TYPES = [
  "PS5 Session", "Board Games", "Billiards", "TCG Event",
  "Social Event", "Tournament", "Other",
] as const;

const TYPE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  "PS5 Session":  { dot: "#7C5CFC", bg: "#F1EDFF", text: "#5B3FD4" },
  "Board Games":  { dot: "#F0A202", bg: "#FFF6E0", text: "#B07600" },
  "Billiards":    { dot: "#16A34A", bg: "#E8F8EE", text: "#0E7A37" },
  "TCG Event":    { dot: "#9333EA", bg: "#F6EDFF", text: "#7A22C9" },
  "Social Event": { dot: "#EC4899", bg: "#FDEDF5", text: "#C2266F" },
  "Tournament":   { dot: "#2563EB", bg: "#EAF1FF", text: "#1D4FBF" },
  "Other":        { dot: "#9CA3AF", bg: "#F3F4F6", text: "#4B5563" },
};

const typeColor = (t?: string | null) => TYPE_COLORS[t ?? "Other"] ?? TYPE_COLORS["Other"];

const DEFAULT_TEMPLATE =
  `{{eventTitle}} — Registration #{{registrationId}}

Name: {{fullName}}
Phone: {{phone}}
Payment: {{paymentMethod}}
Amount: {{amount}} {{currency}}

I'd like to confirm my payment.`;

// ── Month calendar of events (the mock's "Calendar" tab) ──────────────────
function EventsCalendar({ rows, onEdit }: { rows: EventDto[]; onEdit: (e: EventDto) => void }) {
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const [selected, setSelected] = useState(() => dayjs());
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const dated = rows.filter(r => r.eventDate
    && (typeFilter === "all" || (r.type ?? "Other") === typeFilter));
  const undatedCount = rows.filter(r => !r.eventDate).length;

  const byDay = new Map<string, EventDto[]>();
  for (const r of dated) {
    const k = dayjs(r.eventDate!).format("YYYY-MM-DD");
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(r);
  }
  byDay.forEach(list => list.sort((a, b) => dayjs(a.eventDate!).valueOf() - dayjs(b.eventDate!).valueOf()));

  // 6 fixed weeks so the grid never jumps height between months.
  const gridStart = month.startOf("week");
  const cells = Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));
  const selectedKey = selected.format("YYYY-MM-DD");
  const dayEvents = byDay.get(selectedKey) ?? [];

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ── Month grid ── */}
      <Card size="small" style={{ flex: "1 1 620px", minWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Space>
            <Button size="small" onClick={() => setMonth(m => m.subtract(1, "month"))}>‹</Button>
            <Button size="small" onClick={() => setMonth(m => m.add(1, "month"))}>›</Button>
            <Button size="small" onClick={() => { setMonth(dayjs().startOf("month")); setSelected(dayjs()); }}>
              Today
            </Button>
          </Space>
          <Text strong style={{ fontSize: 16 }}>{month.format("MMMM YYYY")}</Text>
          <Select
            size="small" value={typeFilter} onChange={setTypeFilter} style={{ width: 150 }}
            options={[{ value: "all", label: "All types" },
              ...EVENT_TYPES.map(t => ({ value: t, label: t }))]}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#9CA3AF", padding: "2px 0" }}>
              {d}
            </div>
          ))}
          {cells.map(day => {
            const key = day.format("YYYY-MM-DD");
            const inMonth = day.isSame(month, "month");
            const isToday = day.isSame(dayjs(), "day");
            const isSelected = key === selectedKey;
            const events = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                onClick={() => setSelected(day)}
                style={{
                  minHeight: 74, borderRadius: 10, padding: "4px 5px", cursor: "pointer",
                  border: isSelected ? "2px solid #6D5BF6" : "1px solid #F0F0F2",
                  background: inMonth ? "#fff" : "#FAFAFB",
                  opacity: inMonth ? 1 : 0.55,
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 600, width: 22, height: 22, lineHeight: "22px",
                  textAlign: "center", borderRadius: "50%",
                  background: isToday ? "#6D5BF6" : "transparent",
                  color: isToday ? "#fff" : inMonth ? "#374151" : "#9CA3AF",
                }}>
                  {day.date()}
                </div>
                {events.slice(0, 2).map(ev => {
                  const c = typeColor(ev.type);
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                      title={`${ev.title} — ${dayjs(ev.eventDate!).format("HH:mm")}`}
                      style={{
                        marginTop: 3, padding: "1px 5px", borderRadius: 5, fontSize: 10,
                        background: c.bg, color: c.text, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: c.dot, marginRight: 4, verticalAlign: "middle" }} />
                      {ev.title}
                    </div>
                  );
                })}
                {events.length > 2 && (
                  <div style={{ fontSize: 9.5, color: "#6D5BF6", marginTop: 2, fontWeight: 600 }}>
                    +{events.length - 2} more
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 8, borderTop: "1px solid #F0F0F2" }}>
          {EVENT_TYPES.map(t => (
            <span key={t} style={{ fontSize: 11, color: "#6B7280" }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: typeColor(t).dot, marginRight: 5 }} />
              {t}
            </span>
          ))}
          {undatedCount > 0 && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: "auto" }}>
              {undatedCount} event(s) without a date — visible in the List view
            </Text>
          )}
        </div>
      </Card>

      {/* ── Selected day panel ── */}
      <Card size="small" style={{ flex: "0 1 300px", minWidth: 270 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text strong>Events on {selected.format("ddd, D MMM")}</Text>
          <Tag color="purple">{dayEvents.length}</Tag>
        </div>

        {dayEvents.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9CA3AF", padding: "26px 0", fontSize: 13 }}>
            Nothing scheduled this day.
          </div>
        ) : dayEvents.map(ev => {
          const c = typeColor(ev.type);
          return (
            <div
              key={ev.id}
              onClick={() => onEdit(ev)}
              style={{
                border: "1px solid #F0F0F2", borderRadius: 10, padding: "10px 12px",
                marginBottom: 8, cursor: "pointer", background: "#FDFDFE",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c.dot, marginRight: 6 }} />
                {ev.title}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                {dayjs(ev.eventDate!).format("h:mm A")}
                {ev.location ? <> · {ev.location}</> : null}
              </div>
              <div style={{ fontSize: 12, marginTop: 5, color: "#6D5BF6", fontWeight: 600 }}>
                🎟 {ev.paidCount}{ev.capacity ? ` / ${ev.capacity}` : ""} tickets sold
                {!ev.isPublished && <Tag style={{ marginLeft: 6 }} color="orange">Draft</Tag>}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export default function EventsManager() {
  const [rows, setRows] = useState<EventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EventDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<EventFeature[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [form] = Form.useForm();
  const fileRef = useRef<HTMLInputElement>(null);
  // List for management, Calendar for the month-at-a-glance view.
  const [view, setView] = useState<"List" | "Calendar">("List");

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await listEvents()); }
    catch { message.error("Failed to load events"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null); setCreating(true);
    setFeatures([]);
    form.resetFields();
    form.setFieldsValue({
      currency: "USD", price: 0,
      enableVisa: true, enableWhish: true, enableCash: true,
      isPublished: false, isActive: true,
      whatsAppTemplate: DEFAULT_TEMPLATE,
      type: "Other",
    });
  };

  const openEdit = (e: EventDto) => {
    setEditing(e); setCreating(false);
    setFeatures(e.features ?? []);
    form.resetFields();
    form.setFieldsValue({
      ...e,
      eventDate: e.eventDate ? dayjs(e.eventDate) : null,
      whatsAppTemplate: e.whatsAppTemplate ?? DEFAULT_TEMPLATE,
    });
  };

  const close = () => { setEditing(null); setCreating(false); setUploadPct(null); };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const body: EventUpsert = {
        key: v.key, title: v.title,
        subtitle: v.subtitle || null,
        description: v.description || null,
        eventDate: v.eventDate ? v.eventDate.toISOString() : null,
        location: v.location || null,
        features,
        videoYoutubeId: v.videoYoutubeId || null,
        price: Number(v.price ?? 0),
        currency: v.currency || "USD",
        enableVisa: !!v.enableVisa,
        enableWhish: !!v.enableWhish,
        enableCash: !!v.enableCash,
        whishPaymentLink: v.whishPaymentLink?.trim() || null,
        whatsAppNumber: v.whatsAppNumber || null,
        whatsAppTemplate: v.whatsAppTemplate || null,
        type: v.type || "Other",
        isPublished: !!v.isPublished,
        isActive: !!v.isActive,
        capacity: v.capacity ? Number(v.capacity) : null,
      };
      if (editing) { await updateEvent(editing.id, body); message.success("Event updated"); }
      else { await createEvent(body); message.success("Event created"); }
      close(); load();
    } catch (e: any) {
      const d = e?.response?.data;
      if (d?.message) message.error(d.message);
      else if (e?.errorFields) { /* form validation — antd already highlights */ }
      else message.error("Save failed");
    } finally { setSaving(false); }
  };

  const pickVideo = () => {
    if (!editing) { message.info("Save the event first, then upload its video."); return; }
    fileRef.current?.click();
  };

  const onVideoChosen = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = ""; // let the same file be re-picked later
    if (!file || !editing) return;

    setUploadPct(0);
    try {
      await uploadEventVideo(editing.id, file, setUploadPct);
      message.success("Video uploaded");
      const fresh = await listEvents();
      setRows(fresh);
      const updated = fresh.find(x => x.id === editing.id);
      if (updated) setEditing(updated);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Upload failed");
    } finally { setUploadPct(null); }
  };

  const dropVideo = async () => {
    if (!editing) return;
    try {
      await removeEventVideo(editing.id);
      message.success("Video removed");
      const fresh = await listEvents();
      setRows(fresh);
      setEditing(fresh.find(x => x.id === editing.id) ?? null);
    } catch { message.error("Failed to remove video"); }
  };

  const columns: ColumnsType<EventDto> = [
    {
      title: "Event", key: "event",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.title}</div>
          <Text code style={{ fontSize: 11 }}>/events/{r.key}</Text>
        </div>
      ),
    },
    {
      title: "When", dataIndex: "eventDate", width: 150,
      render: (v: string | null) => v
        ? <span style={{ fontSize: 12 }}>{dayjs(v).format("DD MMM YYYY, HH:mm")}</span>
        : <Text type="secondary">—</Text>,
    },
    {
      title: "Price", key: "price", width: 100, align: "right",
      render: (_, r) => <Text strong>{r.currency === "USD" ? "$" : ""}{r.price.toFixed(2)}</Text>,
    },
    {
      title: "Payment", key: "pay", width: 150,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.enableVisa  && <Tag color="blue">💳</Tag>}
          {r.enableWhish && <Tag color="purple">📲</Tag>}
          {r.enableCash  && <Tag color="green">💵</Tag>}
          {!r.enableVisa && !r.enableWhish && !r.enableCash && <Text type="danger">none</Text>}
        </Space>
      ),
    },
    {
      title: "Media", key: "media", width: 110,
      render: (_, r) => r.videoPath
        ? <Tag color="cyan">📹 uploaded</Tag>
        : r.videoYoutubeId
          ? <Tag>▶ youtube</Tag>
          : <Text type="secondary">—</Text>,
    },
    {
      title: "Signups", key: "signups", width: 120,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div><b>{r.paidCount}</b> paid</div>
          <Text type="secondary">{r.registrationCount} total</Text>
          {r.capacity ? <div style={{ fontSize: 11, color: "#9CA3AF" }}>cap {r.capacity}</div> : null}
        </div>
      ),
    },
    {
      title: "Status", key: "status", width: 120,
      render: (_, r) => !r.isActive
        ? <Tag>Archived</Tag>
        : r.isPublished ? <Tag color="green">Live</Tag> : <Tag color="orange">Draft</Tag>,
    },
    {
      title: "Actions", key: "actions", width: 150, fixed: "right",
      render: (_, r) => (
        <Space>
          <Tooltip title="Open public page">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => window.open(`/events/${r.key}`, "_blank")} />
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this event?"
            description="Blocked if paid registrations exist."
            onConfirm={async () => {
              try { await deleteEvent(r.id); message.success("Deleted"); load(); }
              catch (e: any) { message.error(e?.response?.data?.message ?? "Delete failed"); }
            }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const open = creating || editing !== null;

  return (
    <div className="p-6">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Events</Title>
          <Text type="secondary">
            Create public registration pages. Each event gets its own URL, price, payment methods and promo video.
          </Text>
        </div>
        <Space>
          <Segmented
            options={["List", "Calendar"]}
            value={view}
            onChange={(v) => setView(v as "List" | "Calendar")}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Event</Button>
        </Space>
      </div>

      {view === "List" ? (
        <Card size="small">
          <Table size="small" rowKey="id" loading={loading}
            columns={columns} dataSource={rows} scroll={{ x: 1000 }}
            pagination={{ pageSize: 20 }} />
        </Card>
      ) : (
        <EventsCalendar rows={rows} onEdit={openEdit} />
      )}

      {/* hidden file input drives the video upload */}
      <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime"
        style={{ display: "none" }} onChange={onVideoChosen} />

      <Modal
        open={open} onCancel={close} onOk={save} confirmLoading={saving}
        title={editing ? `Edit — ${editing.title}` : "New Event"}
        okText={editing ? "Save Changes" : "Create Event"}
        width={720} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ maxHeight: "68vh", overflowY: "auto", paddingRight: 8 }}>
          <SectionLabel>Basics</SectionLabel>

          <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input placeholder="SQUID GAME X AXIS" />
          </Form.Item>

          <Form.Item name="key" label="URL slug"
            rules={[{ required: true, message: "Slug is required" }]}
            extra="The page will live at /events/<slug>. Lowercase letters, numbers and dashes.">
            <Input addonBefore="/events/" placeholder="squid-game-x-axis" />
          </Form.Item>

          <Form.Item name="subtitle" label="Subtitle">
            <Input placeholder="Real challenges. Real prizes. One unforgettable night." />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Short paragraph under the subtitle." />
          </Form.Item>

          <Space size="middle" style={{ display: "flex" }}>
            <Form.Item name="type" label="Type" style={{ width: 180 }}
              extra="Colors the chip on the calendar.">
              <Select options={EVENT_TYPES.map(t => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="eventDate" label="Date & time" style={{ flex: 1 }}>
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="location" label="Location" style={{ flex: 1 }}>
              <Input placeholder="AXIS Lounge, Beirut" />
            </Form.Item>
          </Space>

          <SectionLabel>Pricing & capacity</SectionLabel>
          <Space size="middle" style={{ display: "flex" }}>
            <Form.Item name="price" label="Ticket price" style={{ flex: 1 }}>
              <InputNumber min={0} step={0.5} prefix="$" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="currency" label="Currency" style={{ width: 110 }}>
              <Input />
            </Form.Item>
            <Form.Item name="capacity" label="Capacity" style={{ flex: 1 }}
              extra="Blank = unlimited">
              <InputNumber min={1} style={{ width: "100%" }} placeholder="unlimited" />
            </Form.Item>
          </Space>

          <SectionLabel>Payment methods</SectionLabel>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
            A method only appears on the public page if it's switched on here <i>and</i> its credentials
            are filled in under <b>Integrations</b>. Cash needs no credentials.
          </Paragraph>
          <Space size="large">
            <Form.Item name="enableVisa" label="💳 Visa / card" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enableWhish" label="📲 Whish" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enableCash" label="💵 Cash at store" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item
            name="whishPaymentLink"
            label="Whish payment link (no API needed)"
            extra="Paste the payment link from your Whish app. Used only if the Whish merchant API isn't configured — the buyer pays through the link, confirms on WhatsApp, and you mark them Paid here. Leave empty if you have full API credentials."
          >
            <Input prefix={<LinkOutlined />} placeholder="https://whish.money/..." allowClear />
          </Form.Item>

          <SectionLabel>Promo video</SectionLabel>
          {editing ? (
            <div style={{ marginBottom: 14 }}>
              {editing.videoPath ? (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <video src={`/${editing.videoPath}`} controls
                    style={{ width: "100%", maxHeight: 220, borderRadius: 8, background: "#000" }} />
                  <Space>
                    <Button icon={<VideoCameraOutlined />} onClick={pickVideo}>Replace video</Button>
                    <Button danger onClick={dropVideo}>Remove</Button>
                  </Space>
                </Space>
              ) : (
                <Button icon={<VideoCameraOutlined />} onClick={pickVideo}>
                  Upload video (mp4 / webm / mov, up to 200 MB)
                </Button>
              )}
              {uploadPct !== null && <Progress percent={uploadPct} style={{ marginTop: 10 }} />}
            </div>
          ) : (
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              Create the event first — then reopen it to upload a video.
            </Paragraph>
          )}

          <Form.Item name="videoYoutubeId" label="…or a YouTube link"
            extra="Used only when no file is uploaded. Paste the full URL or just the video id.">
            <Input prefix={<LinkOutlined />} placeholder="https://youtube.com/watch?v=..." />
          </Form.Item>

          <SectionLabel>Feature cards</SectionLabel>
          <FeatureEditor features={features} onChange={setFeatures} />

          <SectionLabel>WhatsApp confirmation</SectionLabel>
          <Form.Item name="whatsAppNumber" label="WhatsApp number"
            extra="Country code + number, digits only. e.g. 96170123456">
            <Input placeholder="96170123456" />
          </Form.Item>
          <Form.Item name="whatsAppTemplate" label="Message the registrant sends">
            <Input.TextArea rows={8} style={{ fontFamily: "monospace", fontSize: 12 }} />
          </Form.Item>
          <Paragraph type="secondary" style={{ fontSize: 11, marginTop: -12 }}>
            Placeholders: {PLACEHOLDERS.map(p => <Text code key={p} style={{ fontSize: 10 }}>{`{{${p}}}`}</Text>)}
          </Paragraph>

          <SectionLabel>Publication</SectionLabel>
          <Space size="large">
            <Form.Item name="isPublished" label="Published (page is live)" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

/**
 * Left-aligned section heading inside the event form.
 *
 * Rolled by hand rather than using antd's <Divider orientation="left">
 * because that prop's accepted values changed between antd majors
 * (left/right → start/end → horizontal/vertical), which broke the build
 * on every upgrade. Plain markup has no such moving target.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 14px" }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: .6,
                     textTransform: "uppercase", color: "#6B7280", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,.08)" }} />
    </div>
  );
}

/** Inline editor for the feature cards shown on the public page. */
function FeatureEditor({ features, onChange }: {
  features: EventFeature[];
  onChange: (f: EventFeature[]) => void;
}) {
  const patch = (i: number, p: Partial<EventFeature>) =>
    onChange(features.map((f, fi) => fi === i ? { ...f, ...p } : f));

  return (
    <div style={{ marginBottom: 12 }}>
      {features.length === 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>No feature cards yet.</Text>
      )}
      <Space direction="vertical" style={{ width: "100%" }}>
        {features.map((f, i) => (
          <Space.Compact key={i} style={{ width: "100%" }}>
            <Input style={{ width: 60, textAlign: "center" }} value={f.icon}
              onChange={e => patch(i, { icon: e.target.value })} placeholder="🎮" />
            <Input style={{ width: "34%" }} value={f.title}
              onChange={e => patch(i, { title: e.target.value })} placeholder="Title" />
            <Input value={f.desc}
              onChange={e => patch(i, { desc: e.target.value })} placeholder="Short description" />
            <Button danger icon={<DeleteOutlined />}
              onClick={() => onChange(features.filter((_, fi) => fi !== i))} />
          </Space.Compact>
        ))}
      </Space>
      <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }}
        onClick={() => onChange([...features, { icon: "✨", title: "", desc: "" }])}>
        Add feature card
      </Button>
    </div>
  );
}
