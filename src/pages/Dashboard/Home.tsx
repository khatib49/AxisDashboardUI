import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import DemographicCard from "../../components/ecommerce/DemographicCard";
import PageMeta from "../../components/common/PageMeta";
import DailySalesChart from "../../components/charts/bar/DailySalesChart";
import ComponentCard from "../../components/common/ComponentCard";
import TotalSalesWidget from "../../components/dashboard/TotalSalesWidget";

export default function Home() {
  return (
    <>
      <PageMeta
        title="AXIS GAME LOUNGE "
        description="AXIS GAME LOUNG AND COFFEE SHOP - BEIRUT - LEBANON"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Total Sales Widget for Admin - All Categories */}
        <div className="col-span-12 xl:col-span-5">
          <TotalSalesWidget categoryType="all" title="Total Sales (All)" isAdmin={true} />
        </div>

        <div className="col-span-12 space-y-6 xl:col-span-7">
          <EcommerceMetrics />

          <MonthlySalesChart />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <MonthlyTarget />
        </div>

        <div className="col-span-12">
          <StatisticsChart />
        </div>

        <div className="col-span-12">
          <ComponentCard title="Daily Sales (Last 30 Days)">
            <DailySalesChart />
          </ComponentCard>
        </div>

        <div className="col-span-12 xl:col-span-5">
          <DemographicCard />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentOrders />
        </div>
      </div>
    </>
  );
}
