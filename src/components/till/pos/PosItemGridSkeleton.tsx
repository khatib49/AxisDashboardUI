// PosItemGridSkeleton — placeholder cards shaped like PosItemCard, shown
// while the till item page loads.

import { Skeleton } from "antd";
import { POS_GRID_CLASS } from "./posGrid";


export default function PosItemGridSkeleton({ count = 10 }: { count?: number }) {
    return (
        <div className={POS_GRID_CLASS} aria-busy="true" aria-label="Loading items">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-white/[0.03]">
                    <div className="h-28 animate-pulse bg-gray-100 sm:h-32 dark:bg-white/5" />
                    <div className="p-3">
                        <Skeleton active title={{ width: "80%" }} paragraph={{ rows: 1, width: "40%" }} />
                        <div className="mt-3 h-11 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}
