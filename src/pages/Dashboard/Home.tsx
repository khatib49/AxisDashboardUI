import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import PageMeta from "../../components/common/PageMeta";
import DailySalesChart from "../../components/charts/bar/DailySalesChart";
import ComponentCard from "../../components/common/ComponentCard";
import TotalSalesWidget from "../../components/dashboard/TotalSalesWidget";
import BestSellers from "../../components/dashboard/BestSellers";
import GameHourlyHeatmap from "../../components/charts/GameHourlyHeatmap";
import OpenInvoicesCard from "../../components/dashboard/OpenInvoicesCard";
import LowStockAlert from "../../components/dashboard/LowStockAlert";
import RevenueTrendChart from "../../components/dashboard/RevenueTrendChart";
import TransactionsByChannelCard from "../../components/dashboard/TransactionsByChannelCard";
import CashOnHandCard from "../../components/dashboard/CashOnHandCard";
import dayjs from "dayjs";

export default function Home() {
    // Cash on Hand uses month-to-date on the main dashboard so the owner
    // sees "how much cash accumulated so far this month on top of my baseline".
    // The accounting page has its own period picker for more granular views.
    const fromIso = dayjs().startOf("month").toISOString();
    const toIso = dayjs().endOf("day").toISOString();

    return (
        <>
            <PageMeta
                title="AXIS GAME LOUNGE"
                description="AXIS GAME LOUNGE AND COFFEE SHOP - BEIRUT - LEBANON"
            />
            <div className="grid grid-cols-12 gap-4 md:gap-6">

                {/* Row 0: Cash on Hand — spans the width so the owner sees
                    the number the moment the page opens. Uses baseline +
                    month-to-date revenue − opex. Editable via pencil icon. */}
                <div className="col-span-12 md:col-span-6 xl:col-span-4">
                    <CashOnHandCard fromIso={fromIso} toIso={toIso} mode="compact" />
                </div>

                {/* Row 1: Total Sales + Metrics */}
                <div className="col-span-12 xl:col-span-5">
                    <TotalSalesWidget categoryType="all" title="Total Sales (All)" isAdmin={true} />
                </div>
                <div className="col-span-12 xl:col-span-4">
                    <EcommerceMetrics />
                </div>
                <div className="col-span-12 xl:col-span-3">
                    <OpenInvoicesCard />
                </div>

                {/* Row 2: All-time Revenue Trend */}
                <div className="col-span-12">
                    <RevenueTrendChart />
                </div>

                {/* Row 3: Daily Sales Chart */}
                <div className="col-span-12">
                    <ComponentCard title="Daily Sales">
                        <DailySalesChart />
                    </ComponentCard>
                </div>

                {/* Row 4: Best Sellers + Low Stock */}
                <div className="col-span-12 xl:col-span-7">
                    <BestSellers />
                </div>
                <div className="col-span-12 xl:col-span-5">
                    <LowStockAlert threshold={5} />
                </div>

                {/* Row 5: Game Heatmap */}
                <div className="col-span-12">
                    <GameHourlyHeatmap />
                </div>

                {/* Row 6: Transactions filter + Excel export.
                    Filter by date + channel (Toters etc.), with one-click
                    XLSX export of the filtered set. */}
                <div className="col-span-12">
                    <TransactionsByChannelCard />
                </div>

            </div>
        </>
    );
}