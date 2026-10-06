import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Skeleton } from 'antd';
import {
    BarChartOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FieldTimeOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    TrophyOutlined,
} from '@ant-design/icons';
import { getKitchenStats, KitchenStatsDto } from '../../services/kitchenService';
import PageMeta from '../../components/common/PageMeta';
import { PageHeader, Panel, StatTile } from '../../components/ui/PageKit';

// Stage colours (status — always shown with a label and the number).
const STAGES = [
    { key: 'pendingOrders', label: 'Waiting', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
    { key: 'inProgressOrders', label: 'Cooking', bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' },
    { key: 'readyOrders', label: 'Ready', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { key: 'servedToday', label: 'Completed', bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
] as const;

function Accent({ cls, children }: { cls: string; children: ReactNode }) {
    return <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${cls}`}>{children}</span>;
}

export default function KitchenStats() {
    const [stats, setStats] = useState<KitchenStatsDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getKitchenStats();
            setStats(data);
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to load kitchen statistics';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
        // Refresh every 30 seconds
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    // Skeletons only on the first load; the 30s refresh keeps the figures on screen.
    const firstLoad = loading && !stats;
    const stageTotal = stats ? STAGES.reduce((s, st) => s + (Number(stats[st.key]) || 0), 0) : 0;
    const avgPrep = stats?.averagePreparationTime;
    const hasAvg = avgPrep !== null && avgPrep !== undefined;

    return (
        <>
            <PageMeta title="Kitchen Statistics - AXIS" description="Kitchen performance statistics" />
            <div className="space-y-5 p-4 sm:p-6">
                <PageHeader
                    icon={<BarChartOutlined />}
                    title="Kitchen Statistics"
                    description="Kitchen performance statistics — refreshes every 30 seconds."
                    actions={
                        <Button size="large" icon={<ReloadOutlined spin={loading} />} onClick={loadStats}>
                            Refresh
                        </Button>
                    }
                />

                {error && (
                    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                        {error}
                    </div>
                )}

                {firstLoad || stats ? (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatTile
                                label="Pending Orders"
                                loading={firstLoad}
                                value={<span className="tabular-nums">{stats?.pendingOrders}</span>}
                                accent={<Accent cls={STAGES[0].chip}><ClockCircleOutlined /></Accent>}
                            />
                            <StatTile
                                label="In Progress"
                                loading={firstLoad}
                                value={<span className="tabular-nums">{stats?.inProgressOrders}</span>}
                                accent={<Accent cls={STAGES[1].chip}><ThunderboltOutlined /></Accent>}
                            />
                            <StatTile
                                label="Ready for Pickup"
                                loading={firstLoad}
                                value={<span className="tabular-nums">{stats?.readyOrders}</span>}
                                accent={<Accent cls={STAGES[2].chip}><CheckCircleOutlined /></Accent>}
                            />
                            <StatTile
                                label="Served Today"
                                loading={firstLoad}
                                value={<span className="tabular-nums">{stats?.servedToday}</span>}
                                accent={<Accent cls={STAGES[3].chip}><TrophyOutlined /></Accent>}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            {/* Quick Summary */}
                            <Panel
                                title="Quick Summary"
                                subtitle="Orders by stage"
                                className={hasAvg ? 'lg:col-span-2' : 'lg:col-span-3'}
                            >
                                {!stats ? (
                                    <Skeleton active paragraph={{ rows: 2 }} />
                                ) : (
                                    <>
                                        <div
                                            className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
                                            role="img"
                                            aria-label={STAGES.map(st => `${st.label} ${stats[st.key]}`).join(', ')}
                                        >
                                            {stageTotal > 0 && STAGES.map(st => {
                                                const n = Number(stats[st.key]) || 0;
                                                if (n <= 0) return null;
                                                return (
                                                    <div
                                                        key={st.key}
                                                        className={`h-full ${st.bar} hover:opacity-80`}
                                                        style={{ width: `${(n / stageTotal) * 100}%` }}
                                                        title={`${st.label}: ${n}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                                            {STAGES.map(st => (
                                                <div key={st.key} className="rounded-xl border border-gray-100 px-4 py-3 dark:border-white/[0.06]">
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                        <span className={`h-2.5 w-2.5 rounded-full ${st.bar}`} aria-hidden />
                                                        {st.label}
                                                    </div>
                                                    <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                                                        {stats[st.key]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </Panel>

                            {/* Average Preparation Time */}
                            {hasAvg && (
                                <Panel title="Average Preparation Time" bodyClassName="flex items-center gap-4 p-5">
                                    <Accent cls="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><FieldTimeOutlined /></Accent>
                                    <div className="text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-gray-900 dark:text-white">
                                        {Math.round(avgPrep)} minutes
                                    </div>
                                </Panel>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="rounded-2xl border border-gray-200/80 bg-white py-10 text-center text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-gray-400">
                        No statistics available
                    </div>
                )}
            </div>
        </>
    );
}
