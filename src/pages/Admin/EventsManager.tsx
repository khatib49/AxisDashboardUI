// Admin CMS for public event pages.
// Route: /admin/events  (admin only)
//
// One place to: write the copy, upload the promo video, set the price,
// choose which payment methods are live, edit the WhatsApp confirmation
// message, and publish.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, InputNumber,
  Switch, DatePicker, message, Typography, Progress, Tooltip, Popconfirm, Divider,
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

const DEFAULT_TEMPLATE =
  `{{eventTitle}} — Registration #{{registrationId}}

Name: {{fullName}}
Phone: {{phone}}
Payment: {{paymentMethod}}
Amount: {{amount}} {{currency}}

I'd like to confirm my payment.`;

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
        whatsAppNumber: v.whatsAppNumber || null,
        whatsAppTemplate: v.whatsAppTemplate || null,
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
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Event</Button>
        </Space>
      </div>

      <Card size="small">
        <Table size="small" rowKey="id" loading={loading}
          columns={columns} dataSource={rows} scroll={{ x: 1000 }}
          pagination={{ pageSize: 20 }} />
      </Card>

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
          <Divider orientation="left" plain>Basics</Divider>

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
            <Form.Item name="eventDate" label="Date & time" style={{ flex: 1 }}>
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="location" label="Location" style={{ flex: 1 }}>
              <Input placeholder="AXIS Lounge, Beirut" />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>Pricing & capacity</Divider>
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

          <Divider orientation="left" plain>Payment methods</Divider>
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

          <Divider orientation="left" plain>Promo video</Divider>
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

          <Divider orientation="left" plain>Feature cards</Divider>
          <FeatureEditor features={features} onChange={setFeatures} />

          <Divider orientation="left" plain>WhatsApp confirmation</Divider>
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

          <Divider orientation="left" plain>Publication</Divider>
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
