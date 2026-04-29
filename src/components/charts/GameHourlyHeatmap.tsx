import { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { getGameHourlyHeatmap, GameHourlySalesDto } from "../../services/transactionService";
import Loader from "../ui/Loader";

type DateFilter = 'today' | 'yesterday' | '7days' | '30days';
type MetricType = 'sessions' | 'amount' | 'hours';

export default function GameHourlyHeatmap() {
    const [data, setData] = useState<GameHourlySalesDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<DateFilter>('7days');
    const [metric, setMetric] = useState<MetricType>('sessions');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const now = new Date();
                let from: Date;

                switch (filter) {
                    case 'today':
                        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
                        break;
                    case 'yesterday': {
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        from = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
                        break;
                    }
                    case '7days':
                        from = new Date(now);
                        from.setDate(from.getDate() - 7);
                        from = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
                        break;
                    case '30days':
                    default:
                        from = new Date(now);
                        from.setDate(from.getDate() - 30);
                        from = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
                        break;
                }

                const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

                const result = await getGameHourlyHeatmap({
                    from: from.toISOString(),
                    to: to.toISOString()
                });

                setData(result);
            } catch (error) {
                console.error("Failed to fetch game hourly heatmap:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filter]);

    const getMetricValue = (item: GameHourlySalesDto): number => {
        switch (metric) {
            case 'sessions':
                return item.sessionsCount;
            case 'hours':
                return item.totalHours;
            case 'amount':
                return item.totalAmount;
            default:
                return item.sessionsCount;
        }
    };

    const getMetricLabel = (): string => {
        switch (metric) {
            case 'sessions':
                return 'Sessions';
            case 'hours':
                return 'Total Hours';
            case 'amount':
                return 'Total Amount ($)';
            default:
                return 'Sessions';
        }
    };

    const series = [
        {
            name: getMetricLabel(),
            data: Array.from({ length: 24 }, (_, hour) => {
                const hourData = data.find(d => d.hour === hour);
                return hourData ? getMetricValue(hourData) : 0;
            })
        }
    ];

    const options: ApexOptions = {
        chart: {
            type: 'bar',
            height: 350,
            toolbar: {
                show: false
            }
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: '70%',
                distributed: false,
                dataLabels: {
                    position: 'top'
                }
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            categories: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            title: {
                text: 'Hour of Day',
                style: {
                    fontSize: '14px',
                    fontWeight: 500
                }
            },
            labels: {
                rotate: -45,
                rotateAlways: true
            }
        },
        yaxis: {
            title: {
                text: getMetricLabel(),
                style: {
                    fontSize: '14px',
                    fontWeight: 500
                }
            },
            labels: {
                formatter: (value) => {
                    return metric === 'amount' ? `$${value.toFixed(0)}` : value.toFixed(0);
                }
            }
        },
        colors: ['#3b82f6'],
        tooltip: {
            y: {
                formatter: (value) => {
                    if (metric === 'amount') {
                        return `$${value.toFixed(2)}`;
                    } else if (metric === 'hours') {
                        return `${value.toFixed(1)} hrs`;
                    }
                    return value.toString();
                }
            }
        },
        grid: {
            borderColor: '#f1f1f1',
            padding: {
                top: 0,
                right: 10,
                bottom: 0,
                left: 10
            }
        }
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                            Game Sessions - Hourly Distribution
                        </h3>
                        <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                            Peak gaming hours analysis
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('today')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === 'today'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setFilter('yesterday')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === 'yesterday'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={() => setFilter('7days')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === '7days'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={() => setFilter('30days')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === '30days'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            30 Days
                        </button>
                    </div>

                    <div className="border-l border-gray-300 dark:border-gray-700 mx-2"></div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setMetric('sessions')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${metric === 'sessions'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            Sessions
                        </button>
                        <button
                            onClick={() => setMetric('hours')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${metric === 'hours'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            Hours
                        </button>
                        <button
                            onClick={() => setMetric('amount')}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${metric === 'amount'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            Revenue
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader />
                </div>
            ) : (
                <ReactApexChart
                    options={options}
                    series={series}
                    type="bar"
                    height={350}
                />
            )}
        </div>
    );
}
