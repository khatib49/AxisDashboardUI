// src/components/Accounting/AccountForm.tsx

import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Checkbox, Button, message, Space } from 'antd';



import {
    createAccount,
updateAccount,
} from '../../services/accountsApi';

import type { Account, AccountType, AccountCreate, AccountUpdate } from '../../services/accounting';


const { TextArea } = Input;
const { Option } = Select;

interface AccountFormProps {
  account?: Account | null;
  accountTypes: AccountType[];
  accounts: Account[];
  onSuccess: () => void;
  onCancel: () => void;
}

const AccountForm: React.FC<AccountFormProps> = ({
  account,
  accountTypes,
  accounts,
  onSuccess,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>(account?.accountTypeId);

  useEffect(() => {
    if (account) {
      form.setFieldsValue({
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountTypeId: account.accountTypeId,
        parentAccountId: account.parentAccountId,
        description: account.description,
        allowManualEntry: account.allowManualEntry
      });
      setSelectedTypeId(account.accountTypeId);
    } else {
      form.resetFields();
      setSelectedTypeId(undefined);
    }
  }, [account, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (account) {
        // Update existing account
        const updateData: AccountUpdate = {
          accountName: values.accountName,
          description: values.description || '',
          isActive: true,
          allowManualEntry: values.allowManualEntry
        };
        await updateAccount(account.id, updateData);
        message.success('Account updated successfully');
      } else {
        // Create new account
        const createData: AccountCreate = {
          accountNumber: values.accountNumber,
          accountName: values.accountName,
          accountTypeId: values.accountTypeId,
          parentAccountId: values.parentAccountId,
          description: values.description,
          allowManualEntry: values.allowManualEntry ?? true
        };
        await createAccount(createData);
        message.success('Account created successfully');
      }
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Operation failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter parent accounts by same type and exclude current account
  const parentAccounts = accounts.filter(
    a => a.accountTypeId === selectedTypeId && a.id !== account?.id && a.isActive
  );

  // Get selected type info for showing normal balance
  const selectedType = accountTypes.find(t => t.id === selectedTypeId);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        allowManualEntry: true
      }}
    >
      <Form.Item
        name="accountNumber"
        label="Account Number"
        rules={[
          { required: true, message: 'Account number is required' },
          { pattern: /^[0-9]+$/, message: 'Account number must contain only digits' },
          { min: 4, max: 4, message: 'Account number must be 4 digits' }
        ]}
        extra="4-digit number (e.g., 1000, 4100, 5200)"
      >
        <Input 
          placeholder="e.g., 1000" 
          disabled={!!account}
          maxLength={4}
        />
      </Form.Item>

      <Form.Item
        name="accountName"
        label="Account Name"
        rules={[
          { required: true, message: 'Account name is required' },
          { min: 3, message: 'Account name must be at least 3 characters' }
        ]}
      >
        <Input placeholder="e.g., Cash on Hand" />
      </Form.Item>

      <Form.Item
        name="accountTypeId"
        label="Account Type"
        rules={[{ required: true, message: 'Account type is required' }]}
        extra={selectedType && `Normal Balance: ${selectedType.normalBalance}`}
      >
        <Select
          placeholder="Select account type"
          onChange={(value) => {
            setSelectedTypeId(value);
            // Clear parent account when type changes
            form.setFieldsValue({ parentAccountId: undefined });
          }}
          disabled={!!account}
        >
          {accountTypes.map(type => (
            <Option key={type.id} value={type.id}>
              {type.typeName} ({type.normalBalance})
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="parentAccountId"
        label="Parent Account (Optional)"
        extra="Select a parent account to create a sub-account"
      >
        <Select 
          placeholder="Select parent account" 
          allowClear
          disabled={!selectedTypeId}
          showSearch
          optionFilterProp="children"
        >
          {parentAccounts.map(acc => (
            <Option key={acc.id} value={acc.id}>
              {acc.accountNumber} - {acc.accountName}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="description"
        label="Description (Optional)"
      >
        <TextArea 
          rows={3} 
          placeholder="Optional description of the account's purpose"
          maxLength={500}
          showCount
        />
      </Form.Item>

      <Form.Item
        name="allowManualEntry"
        valuePropName="checked"
      >
        <Checkbox>Allow manual journal entries to this account</Checkbox>
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {account ? 'Update Account' : 'Create Account'}
          </Button>
          <Button onClick={onCancel}>
            Cancel
          </Button>
        </Space>
      </Form.Item>

      {account?.isSystemAccount && (
        <div style={{ padding: '12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '4px' }}>
          <strong>Note:</strong> This is a system account. Some properties cannot be modified.
        </div>
      )}
    </Form>
  );
};

export default AccountForm;