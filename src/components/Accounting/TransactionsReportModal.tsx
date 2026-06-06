// TransactionsReportModal
// =======================
// Opens from the Chart of Accounts "Report" button on each row.
// Shows every journal-entry line posted to the selected account, with:
//   - date-range filter
//   - checkbox bulk selection
//   - "Move N selected to..." toolbar action that calls
//     POST /api/Accounts/repoint-lines and refreshes the list.
// Admin-only — the backend rejects non-admins.

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Table,
  Button,
  DatePicker,
  Space,
  Select,
  Tag,
  message,
  Typography,
  Empty,
  Spin,
  Tooltip,
} from "antd";
import { SwapOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType, TableRowSelection } from "antd/es/table/interface";
import dayjs, { Dayjs } from "dayjs";
import {
  Account,
  GeneralLedger,
  GeneralLedgerLine,
  getGeneralLedger,
  repointJournalEntryLines,
} from "../../services/accountsApi";
import { getPostableAccounts, AccountDto } from "../../services/expenseService";

const { RangePicker } = DatePicker;
const { Text } = Typography;

type Props = {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  // Fired after a successful repoint so the parent can refresh balances.
  onRepointed?: () => void;
};

export default function TransactionsReportModal({ open, account, onClose, onRepointed }: Props) {
  const [loading, setLoading] = useState(false);
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(2, "year").startOf("day"),
    dayjs().endOf("day"),
  ]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [postableAccounts, setPostableAccounts] = useState<AccountDto[]>([]);
  const [targetAccountId, setTargetAccountId] = useState<number | undefined>(undefined);
  const [repointing, setRepointing] = useState(false);

  // Load the GL whenever the modal opens or the range changes.
  useEffect(() => {
    if (!open || !account) return;
    let mounted = true;
    setLoading(true);
    getGeneralLedger(
      account.id,
      range[0].toISOString(),
      range[1].toISOString()
    )
      .then((data) => {
        if (!mounted) return;
        setLedger(data);
        setSelectedRowKeys([]);
      })
      .catch(() => {
        if (!mounted) return;
        message.error("Failed to load transactions for this account");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [open, account, range]);

  // Load the postable account list once when the modal opens — used as the
  // "Move to" dropdown so the admin can't pick a header account by accident.
  useEffect(() => {
    if (!open) return;
    getPostableAccounts()
      .then(setPostableAccounts)
      .catch(() => message.error("Failed to load target accounts"));
  }, [open]);

  // Each GL line carries lineId; rows without a lineId (e.g. opening-balance
  // synthetic rows, if any) are not selectable.
  const rows = useMemo(
    () =>
      (ledger?.transactions || []).map((l, idx) => ({
        key: l.lineId && l.lineId > 0 ? `line-${l.lineId}` : `row-${idx}`,
        ...l,
      })),
    [ledger]
  );

  const selectableLineIds = useMemo(
    () =>
      rows
        .filter((r) => r.lineId && r.lineId > 0 && !r.isVoided && !r.isPending)
        .map((r) => r.lineId as number),
    [rows]
  );

  const columns: ColumnsType<GeneralLedgerLine & { key: string }> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d: string) => dayjs(d).format("YYYY-MM-DD"),
    },
    {
      title: "Entry #",
      dataIndex: "entryNumber",
      key: "entryNumber",
      width: 140,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (text: string, record) => (
        <Space>
          <span>{text}</span>
          {record.isPending && <Tag color="orange">Pending</Tag>}
          {record.isVoided && <Tag color="red">Voided</Tag>}
        </Space>
      ),
    },
    {
      title: "Debit",
      dataIndex: "debit",
      key: "debit",
      align: "right" as const,
      width: 120,
      render: (n: number) =>
        n > 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-",
    },
    {
      title: "Credit",
      dataIndex: "credit",
      key: "credit",
      align: "right" as const,
      width: 120,
      render: (n: number) =>
        n > 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-",
    },
    {
      title: "Running",
      dataIndex: "runningBalance",
      key: "runningBalance",
      align: "right" as const,
      width: 140,
      render: (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    },
  ];

  const rowSelection: TableRowSelection<GeneralLedgerLine & { key: string }> = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      disabled: !record.lineId || record.lineId <= 0 || record.isVoided || record.isPending,
    }),
  };

  // Map row keys back to lineIds for the API call.
  const selectedLineIds = useMemo(() => {
    return selectedRowKeys
      .map((k) => {
        const r = rows.find((row) => row.key === k);
        return r?.lineId;
      })
      .filter((id): id is number => !!id && id > 0);
  }, [selectedRowKeys, rows]);

  async function handleRepoint() {
    if (!targetAccountId) {
      message.warning("Pick a target account");
      return;
    }
    if (selectedLineIds.length === 0) {
      message.warning("Select at least one transaction line");
      return;
    }
    if (account && targetAccountId === account.id) {
      message.warning("Target account is the same as the current one");
      return;
    }
    setRepointing(true);
    try {
      const result = await repointJournalEntryLines({
        lineIds: selectedLineIds,
        newAccountId: targetAccountId,
      });
      const total = result.processed + result.skipped + result.failed;
      if (result.failed > 0) {
        message.warning(
          `Moved ${result.processed} of ${total}. Skipped ${result.skipped}, failed ${result.failed}. First error: ${result.errors[0] ?? "(none)"}`
        );
      } else if (result.processed === 0) {
        message.info(`Nothing moved. Skipped ${result.skipped} of ${total}.`);
      } else {
        message.success(
          `Moved ${result.processed} line(s). ${result.skipped ? `Skipped ${result.skipped}.` : ""}`
        );
      }
      // Refresh: reload the GL for this account and tell the parent to refresh balances.
      if (account) {
        const fresh = await getGeneralLedger(
          account.id,
          range[0].toISOString(),
          range[1].toISOString()
        );
        setLedger(fresh);
      }
      setSelectedRowKeys([]);
      onRepointed?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Move failed";
      message.error(msg);
    } finally {
      setRepointing(false);
    }
  }

  function handleReload() {
    if (!account) return;
    setLoading(true);
    getGeneralLedger(account.id, range[0].toISOString(), range[1].toISOString())
      .then(setLedger)
      .catch(() => message.error("Failed to reload"))
      .finally(() => setLoading(false));
  }

  return (
    <Modal
      title={
        account ? (
          <Space>
            <Text strong>Transactions Report</Text>
            <Text type="secondary">
              {account.accountNumber} — {account.accountName}
            </Text>
          </Space>
        ) : (
          "Transactions Report"
        )
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ top: 20 }}
      styles={{ body: { maxHeight: "80vh", overflowY: "auto" } }}
    >
      {/* Toolbar */}
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReload}>
            Reload
          </Button>
          <Text type="secondary">
            {selectableLineIds.length} selectable line(s) — {selectedLineIds.length} selected
          </Text>
        </Space>

        {/* Move-to row */}
        <Space wrap style={{ background: "#fafafa", padding: 12, borderRadius: 6 }}>
          <Text strong>Move selected to:</Text>
          <Select
            showSearch
            placeholder="Pick a target account"
            style={{ width: 360 }}
            value={targetAccountId}
            onChange={setTargetAccountId}
            optionFilterProp="label"
            options={postableAccounts.map((a) => ({
              value: a.id,
              label: `${a.accountNumber} — ${a.accountName} (${a.accountTypeName || "?"})`,
            }))}
          />
          <Tooltip
            title={
              selectedLineIds.length === 0
                ? "Select at least one line"
                : !targetAccountId
                ? "Pick a target account"
                : ""
            }
          >
            <Button
              type="primary"
              icon={<SwapOutlined />}
              disabled={selectedLineIds.length === 0 || !targetAccountId}
              loading={repointing}
              onClick={handleRepoint}
            >
              Move {selectedLineIds.length} line(s)
            </Button>
          </Tooltip>
        </Space>

        {/* Summary band */}
        {ledger && (
          <Space split="·" wrap>
            <Text>
              Opening: <strong>${ledger.openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
            </Text>
            <Text>
              Closing: <strong>${ledger.closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
            </Text>
            <Text type="secondary">{rows.length} line(s) shown</Text>
          </Space>
        )}

        {/* Table */}
        <Spin spinning={loading}>
          {rows.length === 0 ? (
            <Empty description="No transactions in this range" />
          ) : (
            <Table
              size="small"
              columns={columns}
              dataSource={rows}
              rowSelection={rowSelection}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              rowKey="key"
              scroll={{ x: 900 }}
            />
          )}
        </Spin>
      </Space>
    </Modal>
  );
}
