import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import PageMeta from "../../components/common/PageMeta";
import DailySalesChart from "../../components/charts/bar/DailySalesChart";
import ComponentCard from "../../components/common/ComponentCard";
import TotalSalesWidget from "../../components/dashboard/TotalSalesWidget";
import BestSellers from "../../components/dashboard/BestSellers";
import GameHourlyHeatmap from "../../components/charts/GameHourlyHeatmap";

export default function Home() {
  return (
    <>
      <PageMeta
        title="AXIS GAME LOUNGE "
        description="AXIS GAME LOUNGE AND COFFEE SHOP - BEIRUT - LEBANON"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Total Sales Widget for Admin - All Categories */}
        <div className="col-span-12 xl:col-span-5">
          <TotalSalesWidget categoryType="all" title="Total Sales (All)" isAdmin={true} />
        </div>

        <div className="col-span-12 space-y-6 xl:col-span-7">
          {/* Real Metrics: Clients Count & Orders Count */}
          <EcommerceMetrics />
        </div>

        {/* Daily Sales Chart with Filters */}
        <div className="col-span-12">
          <ComponentCard title="Daily Sales">
            <DailySalesChart />
          </ComponentCard>
        </div>

        {/* Best Sellers (Item Sales Report) */}
        <div className="col-span-12 xl:col-span-6">
          <BestSellers />
        </div>

        {/* Game Hourly Heatmap */}
        <div className="col-span-12 xl:col-span-6">
          <GameHourlyHeatmap />
        </div>
      </div>
    </>
  );
}
