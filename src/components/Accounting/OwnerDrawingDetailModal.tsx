// OwnerDrawingDetailModal
// =======================
// Opens from a row of "Drawings by owner". Answers three questions:
//   1. What was drawn?  — every posted journal line on the owner's drawings
//      account in the period, with where it came from (Drawings page, an
//      entry category, a manual journal entry) and a running total.
//   2. How is each number calculated? — the four formulas with the real
//      figures plugged in.
//   3. Why? — plain-language meaning of share / fair share / over-drawn.

import { useEffect, useState } from "react";
import { Alert, Empty, Modal, Space, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircleOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getOwnerDrawingsLedger,
  OwnerDrawingsLedgerDto,
  OwnerDrawingsLedgerLineDto,
  OwnerDrawingsLineDto,
} from "../../services/ownerService";

const { Text, Paragraph } = Typography;

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n < 0 ? `(${money(-n)})` : money(n));
const pct = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

const SOURCE_COLOR: Record<string, string> = {
  "Drawings page": "purple",
  "Entry category": "blue",
  "Manual journal entry": "gold",
};

interface Props {
  /** The summary row that was clicked; null = closed. */
  row: OwnerDrawingsLineDto | null;
  /** Total drawings of all owners in the period (header rollup). */
  totalDrawings: number;
  headerLabel: string;
  from: string;
  to: string;
  onClose: () => void;
}

export default function OwnerDrawingDetailModal({ row, totalDrawings, headerLabel, from, to, onClose }: Props) {
  const [data, setData] = useState<OwnerDrawingsLedgerDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    let alive = true;
    setData(null);
    setError(null);
    setLoading(true);
    getOwnerDrawingsLedger(row.accountId, from, to)
      .then((d) => { if (alive) setData(d); })
      .catch((e: unknown) => {
        if (alive) setError(e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Failed to load");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [row, from, to]);

  if (!row) return null;

  const isOwner = row.ownerId != null;
  const name = row.name;
  const period = `${dayjs(from).format("MMM D, YYYY")} – ${dayjs(to).format("MMM D, YYYY")}`;
  const over = row.variance > 0.004;
  const under = row.variance < -0.004;
  const reconciles = data ? Math.abs(data.drawn - row.drawn) < 0.005 : true;
  const hasSpread = data?.lines.some((l) => l.sourceDetail?.includes("spread")) ?? false;

  const columns: ColumnsType<OwnerDrawingsLedgerLineDto> = [
    {
      title: "Date",
      dataIndex: "entryDate",
      width: 110,
      render: (v: string) => dayjs(v).format("MMM D, YYYY"),
    },
    {
      title: "Entry",
      dataIndex: "entryNumber",
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: "Source",
      dataIndex: "source",
      width: 150,
      render: (v: string) => <Tag color={SOURCE_COLOR[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "Details",
      key: "details",
      render: (_, l) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{l.sourceDetail || l.description}</Text>
          {l.sourceDetail && l.description && !l.sourceDetail.includes(l.description.split(" - ")[0]) && (
            <Text type="secondary" style={{ fontSize: 11 }}>{l.description}</Text>
          )}
        </Space>
      ),
    },
    {
      title: "Amount",
      key: "amount",
      align: "right",
      width: 120,
      render: (_, l) => {
        const net = l.debit - l.credit;
        return <Text strong type={net < 0 ? "success" : undefined}>{signed(net)}</Text>;
      },
    },
    {
      title: "Running total",
      dataIndex: "runningTotal",
      align: "right",
      width: 145,
      render: (v: number) => <Text type="secondary">{money(v)}</Text>,
    },
  ];

  // One step of the calculation: label, formula with real numbers, result.
  const Step = ({ n, label, formula, result, tone }: { n: number; label: string; formula: React.ReactNode; result: string; tone?: "danger" | "success" }) => (
    <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 10, alignItems: "baseline", padding: "8px 0", borderBottom: "1px dashed #e5e7eb" }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: "#ede9fe", color: "#6d28d9", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <div>
        <Text strong>{label}</Text>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{formula}</div>
      </div>
      <Text strong type={tone} style={{ fontSize: 15, whiteSpace: "nowrap" }}>{result}</Text>
    </div>
  );

  return (
    <Modal
      open={!!row}
      onCancel={onClose}
      footer={null}
      width={980}
      destroyOnHidden
      title={
        <Space direction="vertical" size={0}>
          <span>{name} — drawings</span>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {row.accountNumber} · {row.accountName} · {period}
          </Text>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* ── How it's calculated ─────────────────────────────────────── */}
        <div style={{ border: "1px solid #ede9fe", background: "#faf5ff", borderRadius: 8, padding: "6px 16px 10px" }}>
          <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>How it's calculated</Text>
          <Step
            n={1}
            label="Drawn"
            formula={<>Sum of the {row.entryCount} entr{row.entryCount === 1 ? "y" : "ies"} below on {row.accountNumber} (debits − credits) in the period</>}
            result={money(row.drawn)}
          />
          {isOwner && (
            <>
              <Step
                n={2}
                label="Share of drawings"
                formula={<>{money(row.drawn)} ÷ {money(totalDrawings)} drawn by all owners ({headerLabel}) × 100</>}
                result={pct(row.shareOfDrawingsPercent)}
              />
              <Step
                n={3}
                label="Fair share"
                formula={<>{money(totalDrawings)} total drawings × {pct(row.ownershipPercent)} ownership</>}
                result={money(row.entitledAmount)}
              />
              <Step
                n={4}
                label="Over / (under) drawn"
                formula={<>{money(row.drawn)} drawn − {money(row.entitledAmount)} fair share</>}
                result={signed(row.variance)}
                tone={over ? "danger" : under ? "success" : undefined}
              />
            </>
          )}
        </div>

        {/* ── Why ─────────────────────────────────────────────────────── */}
        <Alert
          type={over ? "warning" : "info"}
          showIcon
          message="Why"
          description={
            <div style={{ fontSize: 13 }}>
              <Paragraph style={{ marginBottom: 6 }}>
                A drawing is cash an owner takes out for personal use. It is <b>not a business expense</b>, so it does not
                lower profit. It lowers the owner's equity instead: each one is booked <b>DR {row.accountNumber} {row.accountName} /
                CR 1000 Cash on Hand</b>, which is why it also reduces Cash on Hand.
              </Paragraph>
              {isOwner ? (
                <>
                  <Paragraph style={{ marginBottom: 6 }}>
                    Partners share in proportion to what they own. If drawings followed ownership, {name} would have taken{" "}
                    {pct(row.ownershipPercent)} of the {money(totalDrawings)} all owners drew — that is the fair share of{" "}
                    {money(row.entitledAmount)}. {name} actually took {pct(row.shareOfDrawingsPercent)} ({money(row.drawn)}).
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    {over && (
                      <>
                        <b>{name} is over-drawn by {money(row.variance)}</b> compared with the other partners. This is not an
                        error — it is usually settled when profit is distributed (deducted from {name}'s share), or the other
                        owners draw a catch-up amount.
                      </>
                    )}
                    {under && (
                      <>
                        <b>{name} is under-drawn by {money(-row.variance)}</b> — that amount could still be drawn to be level
                        with the other partners, or is added to {name}'s share when profit is distributed.
                      </>
                    )}
                    {!over && !under && <><b>{name} drew exactly their fair share</b> for this period.</>}
                  </Paragraph>
                </>
              ) : (
                <Paragraph style={{ marginBottom: 0 }}>
                  This account sits under {headerLabel} but is not linked to an owner, so it has no ownership % and no fair
                  share. Link it to an owner (or move its entries) to include it in the comparison.
                </Paragraph>
              )}
            </div>
          }
        />

        {/* ── The entries ─────────────────────────────────────────────── */}
        <div>
          <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} wrap>
            <Text strong>Drawings in the period</Text>
            {data && (
              reconciles ? (
                <Text type="success" style={{ fontSize: 12 }}>
                  <CheckCircleOutlined /> {data.lines.length} line{data.lines.length === 1 ? "" : "s"} add up to {money(data.drawn)}, the "Drawn" figure
                </Text>
              ) : (
                <Text type="warning" style={{ fontSize: 12 }}>
                  <WarningOutlined /> Lines add up to {money(data.drawn)} but the summary shows {money(row.drawn)} — press Refresh on the page
                </Text>
              )
            )}
          </Space>
          {error && <Alert type="error" showIcon message={error} />}
          {loading && <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>}
          {data && (
            <Table
              rowKey={(l) => `${l.journalEntryId}-${l.entryNumber}-${l.runningTotal}`}
              size="small"
              columns={columns}
              dataSource={data.lines}
              pagination={false}
              scroll={{ x: 820, y: 320 }}
              locale={{ emptyText: <Empty description="No drawings in this period" /> }}
              summary={() =>
                data.lines.length > 0 ? (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: "#faf5ff" }}>
                      <Table.Summary.Cell index={0} colSpan={4}>
                        <Text strong>Total drawn · {data.entryCount} journal entr{data.entryCount === 1 ? "y" : "ies"}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right"><Text strong>{money(data.drawn)}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={5} />
                    </Table.Summary.Row>
                  </Table.Summary>
                ) : null
              }
            />
          )}
          {hasSpread && (
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
              Entries made through an entry category that cover several months are booked as one journal entry per month,
              so a single entry can appear here as several lines. Months that haven't started yet are not counted.
            </Text>
          )}
        </div>
      </Space>
    </Modal>
  );
}
