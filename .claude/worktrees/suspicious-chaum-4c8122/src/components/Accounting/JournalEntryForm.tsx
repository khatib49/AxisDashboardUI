// src/components/Accounting/JournalEntryForm.tsx

import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Table,
  InputNumber,
  message,
  Alert,
  Row,
  Col,
  Card
} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  createJournalEntry,
  validateJournalEntry,
} from '../../services/journalApi';


import {
  getAllAccounts
} from '../../services/accountsApi';

import type { Account, JournalEntryLineCreate, JournalEntryCreate } from '../../services/accounting';

const { TextArea } = Input;
const { Option } = Select;

interface JournalEntryFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface LineItem extends JournalEntryLineCreate {
  key: string;
}

const JournalEntryForm: React.FC<JournalEntryFormProps> = ({ onSuccess, onCancel }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<LineItem[]>([
    { key: '1', accountId: 0, debitAmount: 0, creditAmount: 0, description: '' },
    { key: '2', accountId: 0, debitAmount: 0, creditAmount: 0, description: '' }
  ]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAllAccounts(undefined, true);
      // Filter to only accounts that allow manual entry
      setAccounts(data.filter(a => a.allowManualEntry));
    } catch (error) {
      message.error('Failed to load accounts');
      console.error(error);
    }
  };

  const addLine = () => {
    const newKey = (Math.max(...lines.map(l => parseInt(l.key))) + 1).toString();
    setLines([
      ...lines,
      { key: newKey, accountId: 0, debitAmount: 0, creditAmount: 0, description: '' }
    ]);
  };

  const removeLine = (key: string) => {
    if (lines.length <= 2) {
      message.warning('Journal entry must have at least 2 lines');
      return;
    }
    setLines(lines.filter(l => l.key !== key));
  };

  const updateLine = (key: string, field: keyof LineItem, value: any) => {
    setLines(
      lines.map(line =>
        line.key === key
          ? { ...line, [field]: value }
          : line
      )
    );
  };

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const difference = totalDebits - totalCredits;
    const isBalanced = Math.abs(difference) < 0.01;

    return { totalDebits, totalCredits, difference, isBalanced };
  };

  const handleSubmit = async (values: any) => {
    const { totalDebits, totalCredits, isBalanced } = calculateTotals();

    // Validate lines
    const validLines = lines.filter(
      l => l.accountId > 0 && (l.debitAmount > 0 || l.creditAmount > 0)
    );

    if (validLines.length < 2) {
      message.error('Journal entry must have at least 2 valid lines');
      return;
    }

    if (!isBalanced) {
      message.error(`Entry is not balanced. Difference: $${Math.abs(totalDebits - totalCredits).toFixed(2)}`);
      return;
    }

    // Check for lines with both debit and credit
    const invalidLines = validLines.filter(l => l.debitAmount > 0 && l.creditAmount > 0);
    if (invalidLines.length > 0) {
      message.error('Each line must have either debit or credit, not both');
      return;
    }

    setLoading(true);
    try {
      const entryData: JournalEntryCreate = {
        entryDate: values.entryDate.format('YYYY-MM-DD'),
        description: values.description,
        referenceType: values.referenceType || 'Adjustment',
        referenceId: values.referenceId,
        lines: validLines.map((line) => ({
          accountId: line.accountId,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          description: line.description || ''
        }))
      };

      // Validate first
      const validation = await validateJournalEntry(entryData);
      if (!validation.isValid) {
        message.error(validation.errors.join(', '));
        setLoading(false);
        return;
      }

      // Create entry
      await createJournalEntry(entryData);
      message.success('Journal entry created successfully');
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to create journal entry');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const { totalDebits, totalCredits, difference, isBalanced } = calculateTotals();

  const columns: ColumnsType<LineItem> = [
    {
      title: 'Account',
      key: 'account',
      width: 250,
      render: (_, record) => (
        <Select
          showSearch
          placeholder="Select account"
          style={{ width: '100%' }}
          value={record.accountId || undefined}
          onChange={(value) => updateLine(record.key, 'accountId', value)}
          optionFilterProp="children"
          filterOption={(input, option) =>
            (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
          }
        >
          {accounts.map(acc => (
            <Option key={acc.id} value={acc.id}>
              {acc.accountNumber} - {acc.accountName}
            </Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Description',
      key: 'description',
      render: (_, record) => (
        <Input
          placeholder="Line description"
          value={record.description}
          onChange={(e) => updateLine(record.key, 'description', e.target.value)}
        />
      )
    },
    {
      title: 'Debit',
      key: 'debit',
      width: 150,
      render: (_, record) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          precision={2}
          value={record.debitAmount}
          onChange={(value) => {
            updateLine(record.key, 'debitAmount', value || 0);
            if (value && value > 0) {
              updateLine(record.key, 'creditAmount', 0);
            }
          }}
          prefix="$"
        />
      )
    },
    {
      title: 'Credit',
      key: 'credit',
      width: 150,
      render: (_, record) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          precision={2}
          value={record.creditAmount}
          onChange={(value) => {
            updateLine(record.key, 'creditAmount', value || 0);
            if (value && value > 0) {
              updateLine(record.key, 'debitAmount', 0);
            }
          }}
          prefix="$"
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.key)}
          disabled={lines.length <= 2}
        />
      )
    }
  ];

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="entryDate"
            label="Entry Date"
            rules={[{ required: true, message: 'Entry date is required' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="referenceType"
            label="Reference Type"
            initialValue="Adjustment"
          >
            <Select>
              <Option value="Adjustment">Adjustment</Option>
              <Option value="Transaction">Transaction</Option>
              <Option value="Expense">Expense</Option>
              <Option value="Depreciation">Depreciation</Option>
              <Option value="Opening">Opening Balance</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label="Description"
        rules={[{ required: true, message: 'Description is required' }]}
      >
        <TextArea rows={2} placeholder="Describe the purpose of this journal entry" />
      </Form.Item>

      <Card
        title="Journal Entry Lines"
        extra={
          <Button type="dashed" icon={<PlusOutlined />} onClick={addLine}>
            Add Line
          </Button>
        }
      >
        <Table
          dataSource={lines}
          columns={columns}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <strong>Totals</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <strong>${totalDebits.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <strong>${totalCredits.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        <div style={{ marginTop: 16 }}>
          {isBalanced ? (
            <Alert
              message="Entry is balanced"
              description={`Debits ($${totalDebits.toFixed(2)}) = Credits ($${totalCredits.toFixed(2)})`}
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
            />
          ) : (
            <Alert
              message="Entry is not balanced"
              description={`Difference: $${Math.abs(difference).toFixed(2)} (${
                difference > 0 ? 'More Debits' : 'More Credits'
              })`}
              type="error"
              icon={<CloseCircleOutlined />}
              showIcon
            />
          )}
        </div>
      </Card>

      <Form.Item style={{ marginTop: 24 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading} disabled={!isBalanced}>
            Create Journal Entry
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default JournalEntryForm;