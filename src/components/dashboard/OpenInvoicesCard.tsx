import { useEffect, useState } from "react";
import { get } from "../../services/api";
import Loader from "../ui/Loader";
import { useNavigate } from "react-router";

type OpenInvoiceSummary = {
    count: number;
    totalValue: number;
    oldestMinutes: number;
};

export default function OpenInvoicesCard() {
    const [data, setData] = useState<OpenInvoiceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchOpenInvoices = async () => {
        try {
            setLoading(true);
            // Uses existing GetOpenFnbInvoices endpoint
            const result = await get<{ success: boolean; data: any[] }>("/transactions/open-fnb-invoices");
            const invoices = result?.data || [];
            const totalValue = invoices.reduce((sum: number, inv: any) => sum + (inv.totalPrice || 0), 0);
            const now = new Date();
            const oldestMs = invoices.length > 0
                ? Math.max(...invoices.map((inv: any) => now.getTime() - new Date(inv.createdOn).getTime()))
                : 0;
            setData({
                count: invoices.length,
                totalValue,
                oldestMinutes: Math.floor(oldestMs / 60000),
            });
        } catch {
            setData({ count: 0, totalValue: 0, oldestMinutes: 0 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOpenInvoices();
        const interval = setInterval(fetchOpenInvoices, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, []);

    const urgency = data && data.oldestMinutes > 60 ? 'high' : data && data.oldestMinutes > 30 ? 'medium' : 'low';
    const urgencyColor = urgency === 'high' ? 'from-red-500 to-red-600' : urgency === 'medium' ? 'from-orange-500 to-orange-600' : 'from-emerald-500 to-emerald-600';

    return (
        <div
            className={`bg-gradient-to-br ${urgencyColor} rounded-xl shadow-lg p-5 text-white cursor-pointer hover:opacity-95 transition`}
            onClick={() => navigate('/orders')}
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-sm font-medium opacity-90">Open Invoices</p>
                    <p className="text-xs opacity-70 mt-0.5">FNB — click to view</p>
                </div>
                <div className="bg-white/20 rounded-full p-2.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-2"><Loader size={20} /></div>
            ) : (
                <>
                    <div className="flex items-end gap-4 mb-3">
                        <div>
                            <p className="text-4xl font-bold">{data?.count ?? 0}</p>
                            <p className="text-xs opacity-75 mt-0.5">open invoices</p>
                        </div>
                        <div className="mb-1">
                            <p className="text-xl font-semibold">${data?.totalValue.toFixed(2) ?? '0.00'}</p>
                            <p className="text-xs opacity-75">total value</p>
                        </div>
                    </div>

                    {data && data.count > 0 && (
                        <div className="bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2">
                            {urgency === 'high' && <span className="text-lg">🔴</span>}
                            {urgency === 'medium' && <span className="text-lg">🟡</span>}
                            {urgency === 'low' && <span className="text-lg">🟢</span>}
                            <p className="text-xs font-medium">
                                Oldest open: {data.oldestMinutes >= 60
                                    ? `${Math.floor(data.oldestMinutes / 60)}h ${data.oldestMinutes % 60}m`
                                    : `${data.oldestMinutes}m`} ago
                            </p>
                        </div>
                    )}

                    {data?.count === 0 && (
                        <div className="bg-white/20 rounded-lg px-3 py-2">
                            <p className="text-xs font-medium">✅ All invoices closed</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}