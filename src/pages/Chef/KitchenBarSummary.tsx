import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Badge } from 'antd';
import { ShopOutlined, CoffeeOutlined } from '@ant-design/icons';
import axios from 'axios';

interface StationSummary {
  kitchen: {
    pendingCount: number;
  };
  bar: {
    pendingCount: number;
  };
}

const KitchenBarSummary: React.FC = () => {
  const [summary, setSummary] = useState<StationSummary | null>(null);

  const fetchSummary = async () => {
    try {
      const response = await axios.get('/api/kitchenbarorder/summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <Row gutter={16}>
      <Col span={12}>
        <Card>
          <Statistic
            title="Kitchen Orders"
            value={summary?.kitchen.pendingCount || 0}
            prefix={<ShopOutlined />}
            valueStyle={{ color: summary?.kitchen.pendingCount ? '#cf1322' : '#3f8600' }}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card>
          <Statistic
            title="Bar Orders"
            value={summary?.bar.pendingCount || 0}
            prefix={<CoffeeOutlined />}
            valueStyle={{ color: summary?.bar.pendingCount ? '#cf1322' : '#3f8600' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default KitchenBarSummary;