import React from 'react';
import TotalSalesWidget from '../../components/dashboard/TotalSalesWidget';
import PageMeta from '../../components/common/PageMeta';
import DailySalesChart from '../../components/charts/bar/DailySalesChart';
import ComponentCard from '../../components/common/ComponentCard';
import BestSellers from '../../components/dashboard/BestSellers';

const Dashboard: React.FC = () => {
    return (
        <>
            <PageMeta
                title="Food & Beverage Dashboard - AXIS"
                description="Food & Beverage Management Dashboard"
            />
            <div className="p-6">
                <h1 className="text-2xl font-semibold mb-6">Food & Beverage Dashboard</h1>

                <div className="grid grid-cols-12 gap-4 md:gap-6">
                    {/* Total Sales Widget for Admin F&B - Item Categories Only */}
                    <div className="col-span-12 xl:col-span-5">
                        <TotalSalesWidget categoryType="item" title="Total Sales (F&B)" />
                    </div>

                    {/* Daily Sales Chart with Filters - F&B Only */}
                    <div className="col-span-12 xl:col-span-7">
                        <ComponentCard title="Daily Sales (F&B)">
                            <DailySalesChart categoryType="item" />
                        </ComponentCard>
                    </div>

                    {/* Best Sellers (Item Sales Report) - F&B Items */}
                    <div className="col-span-12">
                        <BestSellers />
                    </div>
                </div>
            </div>
        </>
    );
};

export default Dashboard;
