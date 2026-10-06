import React, { useEffect, useState, useRef } from 'react';
import { notification, Pagination } from 'antd';
import {
  CheckOutlined,
  FireOutlined
} from '@ant-design/icons';
import * as signalR from '@microsoft/signalr';
import api, { patch, post } from '../../services/api'; // Import your existing api instance
import {
  StationTicketCard,
  StationHeader,
  StationGrid,
  StationEmpty,
  StationLoading,
} from '../../components/till/kitchen/StationTicketCard';

// ✅ MOVE OUTSIDE COMPONENT - Define at module level
const getSignalRUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    const baseUrl = envUrl.replace(/\/api\/?$/, '');
    return `${baseUrl}/hubs/kitchenbar`;
  }
  
  return 'https://axisapiwebapp-fvh5e7bda3aag0g7.francecentral-01.azurewebsites.net/hubs/kitchenbar';
};

// ✅ Calculate once at module level
const SIGNALR_HUB_URL = getSignalRUrl();

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
    console.log('📡 Fetching orders from:', '/kitchenbarorder/kitchen/pending');
    const response = await api.get<{ totalCount: number; data: KitchenBarOrder[] }>(
      `/kitchenbarorder/kitchen/pending?page=${pageRef.current}&pageSize=${PAGE_SIZE}`
    );
    const body = response.data;
    const orders = Array.isArray(body?.data) ? body.data : [];
    setOrders(orders);
    setTotal(typeof body?.totalCount === 'number' ? body.totalCount : orders.length);
    // Last order on the last page was finished — step back a page.
    if (orders.length === 0 && pageRef.current > 1) setPage(pageRef.current - 1);
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
    
    if (diffMinutes < 5) return 'green';
    if (diffMinutes < 10) return 'orange';
    return 'red';
  };

  if (loading) {
    return <StationLoading label="Loading kitchen orders..." />;
  }

  return (
    <div className="min-h-screen space-y-4 p-4 sm:p-5">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <StationHeader
        icon={<FireOutlined />}
        title="Kitchen Orders"
        total={total}
        onRefresh={fetchPendingOrders}
      />

      {orders.length === 0 ? (
        <StationEmpty
          icon={<CheckOutlined />}
          title="All Caught Up!"
          subtitle="No pending orders"
        />
      ) : (
        <StationGrid>
          {orders.map(order => (
            <StationTicketCard
              key={order.id}
              order={order}
              ageText={getTimeElapsed(order.orderedAt)}
              ageColor={getTimeBadgeColor(order.orderedAt)}
              noteLabel="NOTE"
              startLabel="Start Preparing"
              doneLabel="Mark Done"
              onStart={() => updateOrderStatus(order.id, 'Preparing')}
              onDone={() => updateOrderStatus(order.id, 'Done')}
              onPrint={() => printOrder(order.id)}
            />
          ))}
        </StationGrid>
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center rounded-2xl border border-gray-200/80 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
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

export default KitchenDisplay;
