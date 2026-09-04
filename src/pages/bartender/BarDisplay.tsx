import React, { useEffect, useState, useRef } from 'react';
import { Card, Badge, Button, Row, Col, Typography, Space, notification, Spin, Pagination } from 'antd';
import { 
  CheckOutlined, 
  PrinterOutlined,
  SyncOutlined,
  CoffeeOutlined
} from '@ant-design/icons';
import * as signalR from '@microsoft/signalr';
import { get, post, patch } from '../../services/api'; // Use API helpers

const { Title, Text } = Typography;

// Get base URL from environment
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace('/api', '');
  }
  return 'https://localhost:7164';
};


const API_BASE_URL = getBaseUrl();
const SIGNALR_HUB_URL = `${API_BASE_URL}/hubs/kitchenbar`;

console.log('🍹 Bar Display - API Base URL:', API_BASE_URL);
console.log('🍹 Bar Display - SignalR Hub URL:', SIGNALR_HUB_URL);

const getSignalRBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    // If env has /api suffix, remove it for SignalR
    return envUrl.replace('/api', '');
  }
  
  // Local development fallback
  return 'https://localhost:7164';
};

const SIGNALR_BASE_URL = getSignalRBaseUrl();
// const SIGNALR_HUB_URL = `${SIGNALR_BASE_URL}/hubs/kitchenbar`;

console.log('🍹 Bar Display Configuration:');
console.log('   - VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('   - SignalR Base URL:', SIGNALR_BASE_URL);
console.log('   - SignalR Hub URL:', SIGNALR_HUB_URL);

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

const BarDisplay: React.FC = () => {
  const [orders, setOrders] = useState<KitchenBarOrder[]>([]);
  // Pending orders can pile up into the hundreds; the display shows one page
  // at a time (oldest first) so it stays fast.
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);
  pageRef.current = page;
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log('Audio play error:', err));
    }
  };

  const fetchPendingOrders = async () => {
    try {
      console.log('🍹 Fetching bar orders from:', '/kitchenbarorder/bar/pending');
      
      // Use get helper which unwraps the response
      const body = await get<{ totalCount: number; data: KitchenBarOrder[] }>(
        `/kitchenbarorder/bar/pending?page=${pageRef.current}&pageSize=${PAGE_SIZE}`
      );
      const orders = Array.isArray(body?.data) ? body.data : [];
      setOrders(orders);
      setTotal(typeof body?.totalCount === 'number' ? body.totalCount : orders.length);
      // Last order on the last page was finished — step back a page.
      if (orders.length === 0 && pageRef.current > 1) setPage(pageRef.current - 1);
      
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching bar orders:', error);
      notification.error({
        message: 'Error',
        description: error?.message || 'Failed to fetch pending orders'
      });
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
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

  const printOrder = async (orderId: number) => {
    try {
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
      console.log('Auto-printed bar order:', order.id);
    } catch (error) {
      console.error('Auto-print error:', error);
    }
  };

  // Setup SignalR connection
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    
    console.log('🔌 Setting up Bar SignalR connection to:', SIGNALR_HUB_URL);
    
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_HUB_URL, {
        accessTokenFactory: () => token || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling
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
          console.log('✅ Connected to KitchenBar Hub (Bar Station)');
          
          // Join Bar group
          connection.invoke('JoinStation', 'Bar')
            .then(() => console.log('✅ Joined Bar station'))
            .catch(err => console.error('❌ Failed to join Bar station:', err));

          // Listen for new orders
          connection.on('NewOrder', (order: KitchenBarOrder) => {
            console.log('🍹 New bar order received:', order);
            
            setOrders(prev => [order, ...prev]);
            playNotificationSound();
            
            notification.info({
              message: '🍹 New Drink Order!',
              description: `${order.quantity}x ${order.itemName}`,
              placement: 'topRight',
              duration: 5
            });

            autoPrintOrder(order);
          });

          // Listen for status changes
          connection.on('OrderStatusChanged', (data: any) => {
            console.log('📝 Bar order status changed:', data);
            
            if (data.Status === 'Done') {
              setOrders(prev => prev.filter(o => o.id !== data.OrderId));
            }
          });
        })
        .catch(err => {
          console.error('❌ Bar SignalR connection error:', err);
          notification.error({
            message: 'Connection Error',
            description: 'Failed to connect to real-time updates. Orders will refresh automatically.',
            duration: 5
          });
        });

      connection.onreconnected(() => {
        console.log('🔄 Bar SignalR reconnected');
        connection.invoke('JoinStation', 'Bar');
        fetchPendingOrders();
      });

      connection.onclose(() => {
        console.log('🔌 Bar SignalR disconnected');
      });
    }
  }, [connection]);

  // Initial fetch
  useEffect(() => {
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
    
    if (diffMinutes < 3) return 'green';
    if (diffMinutes < 7) return 'orange';
    return 'red';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>Loading bar orders...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col span={12}>
          <Title level={2}>🍹 Bar Orders</Title>
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          <Space>
            <Badge count={total} showZero overflowCount={999}>
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
            <CoffeeOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
            <Title level={3}>All Drinks Made!</Title>
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
                    : '4px solid #faad14',
                  backgroundColor: order.status === 'Preparing' ? '#f0f9ff' : '#fff'
                }}
                actions={[
                  order.status === 'Pending' ? (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => updateOrderStatus(order.id, 'Preparing')}
                    >
                      Start Making
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      size="small"
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      icon={<CheckOutlined />}
                      onClick={() => updateOrderStatus(order.id, 'Done')}
                    >
                      Serve
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
                      <Text strong>SPECIAL REQUEST:</Text>
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

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(t, range) => `${range[0]}–${range[1]} of ${t} pending`}
          />
        </div>
      )}
    </div>
  );
};

export default BarDisplay;