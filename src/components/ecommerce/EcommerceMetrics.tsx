import { useEffect, useState } from "react";
import {
  BoxIconLine,
  GroupIcon,
} from "../../icons";
import { getOrdersCount, getClientsCount } from "../../services/transactionService";
import Loader from "../ui/Loader";

type MetricCardProps = {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  gradient: string;
  trend?: string;
};

function MetricCard({ label, value, icon, gradient, trend }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur-sm p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/5 dark:bg-white/[0.03]">
      {/* Decorative blur blob */}
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${gradient} opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40`}
        aria-hidden="true"
      />
      {/* Gradient accent strip */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${gradient}`} aria-hidden="true" />

      <div className="relative flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${gradient} text-white shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 dark:bg-success-500/10 dark:text-success-300">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
            </svg>
            {trend}
          </span>
        )}
      </div>

      <div className="relative mt-6">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <h4 className="mt-2 font-bold text-gray-900 text-title-sm dark:text-white tracking-tight">
          {value !== null ? value.toLocaleString() : "—"}
        </h4>
      </div>
    </div>
  );
}

export default function EcommerceMetrics() {
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [clientsCount, setClientsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const [ordersRes, clientsRes] = await Promise.all([
          getOrdersCount({}),
          getClientsCount()
        ]);
        setOrdersCount(ordersRes.ordersCount);
        setClientsCount(clientsRes.count);
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        <div className="rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur-sm p-5 dark:border-white/5 dark:bg-white/[0.03] md:p-6 flex items-center justify-center h-32">
          <Loader />
        </div>
        <div className="rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur-sm p-5 dark:border-white/5 dark:bg-white/[0.03] md:p-6 flex items-center justify-center h-32">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      <MetricCard
        label="Clients"
        value={clientsCount}
        icon={<GroupIcon className="size-6" />}
        gradient="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500"
      />
      <MetricCard
        label="Orders"
        value={ordersCount}
        icon={<BoxIconLine className="size-6" />}
        gradient="bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500"
      />
    </div>
  );
}
