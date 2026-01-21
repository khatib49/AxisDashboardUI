import React, { useEffect, useState, useRef } from 'react';
import { Card, Badge, Button, Row, Col, Typography, Space, notification, Spin } from 'antd';
import { 
  CheckOutlined, 
  PrinterOutlined,
  SyncOutlined 
} from '@ant-design/icons';
import * as signalR from '@microsoft/signalr';
import api, { patch, post } from '../../services/api'; // Import your existing api instance

const { Title, Text } = Typography;

// Get base URL from your api instance
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://axisapiwebapp-fvh5e7bda3aag0g7.francecentral-01.azurewebsites.net';
const SIGNALR_HUB_URL = `${API_BASE_URL}/hubs/kitchenbar`;

interface KitchenBarOrder {
  id: number;
  transactionId: number;
  itemId: number;
  itemName: string;
  quantity: number;
  itemPrice: number;
  station: string;
  status: string;
  orderedAt: string;
  preparedAt?: string;
  preparedBy?: number;
  preparedByUsername?: string;
  printedAt?: string;
  tableNumber?: string;
  guestName?: string;
  itemComment?: string;
  createdByUsername: string;
  createdAt: string;
}

const KitchenDisplay: React.FC = () => {
  const [orders, setOrders] = useState<KitchenBarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log('Audio play error:', err));
    }
  };

const getSignalRUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  console.log('🔧 Raw VITE_API_BASE_URL:', envUrl);
  
  if (envUrl) {
    // Remove /api suffix and any trailing slashes
    const baseUrl = envUrl.replace(/\/api\/?$/, '');
    const hubUrl = `${baseUrl}/hubs/kitchenbar`;
    console.log('🔧 Constructed Hub URL:', hubUrl);
    return hubUrl;
  }
  
  // Fallback
  return 'https://axisapiwebapp-fvh5e7bda3aag0g7.francecentral-01.azurewebsites.net/hubs/kitchenbar';
};

const SIGNALR_HUB_URL = getSignalRUrl();

console.log('🍳 Kitchen Display Configuration:');
console.log('   - Final SignalR Hub URL:', SIGNALR_HUB_URL);
  // Fetch pending orders using your api instance

  const fetchPendingOrders = async () => {
  try {
    console.log('📡 Fetching orders from:', '/kitchenbarorder/kitchen/pending');
    const response = await api.get<KitchenBarOrder[]>('/kitchenbarorder/kitchen/pending');
    
    console.log('✅ Kitchen orders response:', response);
    
    // ⚠️ FIX: api.get returns the axios response, not just data
    // Check if response has a 'data' property (axios response)
    const orders = Array.isArray(response) ? response : (response as any).data;
    
    if (Array.isArray(orders)) {
      setOrders(orders);
    } else {
      console.error('Expected array but got:', response);
      setOrders([]);
    }
    console.log('SignalR Hub URL:', SIGNALR_HUB_URL);
    
    setLoading(false);
  } catch (error: any) {
    console.error('❌ Error fetching orders:', error);
    notification.error({
      message: 'Error',
      description: error?.message || 'Failed to fetch pending orders'
    });
    setLoading(false);
  }
};

  // Update order status

  const updateOrderStatus = async (orderId: number, status: string) => {
  try {
    // ✅ Use 'patch' helper
    await patch(`/kitchenbarorder/${orderId}/status`, { status });
    
    notification.success({
      message: 'Status Updated',
      description: `Order marked as ${status}`,
      duration: 2
    });

    if (status === 'Done') {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status } : o
      ));
    }
  } catch (error) {
    console.error('Error updating status:', error);
    notification.error({
      message: 'Error',
      description: 'Failed to update order status'
    });
  }
};

  // Print order receipt
const printOrder = async (orderId: number) => {
  try {
    // ✅ Use 'post' helper
    await post(
      `/printing/kitchen-bar-receipt/${orderId}`,
      null,
      { responseType: 'blob' }
    );

    notification.success({
      message: 'Printed',
      description: 'Receipt sent to printer',
      duration: 2
    });
  } catch (error) {
    console.error('Error printing:', error);
    notification.error({
      message: 'Print Error',
      description: 'Failed to print receipt'
    });
  }
};

const autoPrintOrder = async (order: KitchenBarOrder) => {
  try {
    await post(
      `/printing/kitchen-bar-receipt/${order.id}`,
      null,
      { responseType: 'blob' }
    );
    console.log('Auto-printed order:', order.id);
  } catch (error) {
    console.error('Auto-print error:', error);
  }
};


  // Setup SignalR connection
  useEffect(() => {
    const token = localStorage.getItem('access_token'); // Use your token key
    
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_HUB_URL, {
        accessTokenFactory: () => token || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    setConnection(newConnection);

    return () => {
      if (newConnection.state === signalR.HubConnectionState.Connected) {
        newConnection.stop();
      }
    };
  }, []);

  // Start SignalR connection
  useEffect(() => {
    if (connection) {
      connection.start()
        .then(() => {
          console.log('✅ Connected to KitchenBar Hub');
          
          // Join Kitchen group
          connection.invoke('JoinStation', 'Kitchen')
            .then(() => console.log('✅ Joined Kitchen station'))
            .catch(err => console.error('❌ Failed to join Kitchen station:', err));

          // Listen for new orders
          connection.on('NewOrder', (order: KitchenBarOrder) => {
            console.log('🔔 New order received:', order);
            
            setOrders(prev => [order, ...prev]);
            playNotificationSound();
            
            notification.info({
              message: 'New Order!',
              description: `${order.quantity}x ${order.itemName}`,
              placement: 'topRight',
              duration: 5
            });

            autoPrintOrder(order);
          });

          // Listen for status changes
          connection.on('OrderStatusChanged', (data: any) => {
            console.log('📝 Order status changed:', data);
            
            if (data.Status === 'Done') {
              setOrders(prev => prev.filter(o => o.id !== data.OrderId));
            }
          });
        })
        .catch(err => {
          console.error('❌ SignalR connection error:', err);
          notification.error({
            message: 'Connection Error',
            description: 'Failed to connect to real-time updates. Orders will refresh automatically.',
            duration: 5
          });
        });

      connection.onreconnected(() => {
        console.log('🔄 SignalR reconnected');
        connection.invoke('JoinStation', 'Kitchen');
        fetchPendingOrders();
      });

      connection.onclose(() => {
        console.log('🔌 SignalR disconnected');
      });
    }
  }, [connection]);

  // Initial fetch
  useEffect(() => {
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTimeElapsed = (orderedAt: string): string => {
    const now = new Date();
    const ordered = new Date(orderedAt);
    const diffMinutes = Math.floor((now.getTime() - ordered.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}h ${diffMinutes % 60}m ago`;
  };

  const getTimeBadgeColor = (orderedAt: string): string => {
    const diffMinutes = Math.floor((new Date().getTime() - new Date(orderedAt).getTime()) / 60000);
    
    if (diffMinutes < 5) return 'green';
    if (diffMinutes < 10) return 'orange';
    return 'red';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" tip="Loading kitchen orders..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col span={12}>
          <Title level={2}>🍳 Kitchen Orders</Title>
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          <Space>
            <Badge count={orders.length} showZero>
              <Button 
                icon={<SyncOutlined />} 
                onClick={fetchPendingOrders}
              >
                Refresh
              </Button>
            </Badge>
          </Space>
        </Col>
      </Row>

      {orders.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <CheckOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
            <Title level={3}>All Caught Up!</Title>
            <Text type="secondary">No pending orders</Text>
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {orders.map(order => (
            <Col xs={24} sm={12} md={8} lg={6} key={order.id}>
              <Card
                hoverable
                style={{
                  borderLeft: order.status === 'Preparing' 
                    ? '4px solid #1890ff' 
                    : '4px solid #faad14'
                }}
                actions={[
                  order.status === 'Pending' ? (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => updateOrderStatus(order.id, 'Preparing')}
                    >
                      Start Preparing
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      size="small"
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      icon={<CheckOutlined />}
                      onClick={() => updateOrderStatus(order.id, 'Done')}
                    >
                      Mark Done
                    </Button>
                  ),
                  <Button
                    size="small"
                    icon={<PrinterOutlined />}
                    onClick={() => printOrder(order.id)}
                  >
                    Print
                  </Button>
                ]}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Badge 
                    color={getTimeBadgeColor(order.orderedAt)} 
                    text={getTimeElapsed(order.orderedAt)}
                  />

                  <Title level={4} style={{ margin: 0 }}>
                    {order.quantity}x {order.itemName}
                  </Title>

                  {order.tableNumber && (
                    <Text strong>Table: {order.tableNumber}</Text>
                  )}
                  {order.guestName && (
                    <Text>Guest: {order.guestName}</Text>
                  )}

                  {order.itemComment && (
                    <Card 
                      size="small" 
                      style={{ backgroundColor: '#fff7e6', border: '1px solid #ffa940' }}
                    >
                      <Text strong>NOTE:</Text>
                      <br />
                      <Text>{order.itemComment}</Text>
                    </Card>
                  )}

                  <div style={{ marginTop: '10px' }}>
                    <Badge 
                      status={order.status === 'Preparing' ? 'processing' : 'default'} 
                      text={order.status}
                    />
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      By: {order.createdByUsername}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Order #{order.id}
                    </Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default KitchenDisplay;