// src/pages/Admin/LoyaltyDraws.tsx
import React, { useState, useEffect } from 'react';
import {
    conductWeeklyDraw,
    conductMonthlyDraw,
    DrawResponse
} from '../../services/loyaltyService';
import Loader from '../../components/ui/Loader';
import Alert from '../../components/ui/alert/Alert';
import Input from '../../components/form/input/InputField';
import Label from '../../components/form/Label';
import Modal from '../../components/ui/Modal';

const LoyaltyDraws: React.FC = () => {
    const [weeklyPrize, setWeeklyPrize] = useState('');
    const [monthlyPrize, setMonthlyPrize] = useState('');
    const [weeklyLoading, setWeeklyLoading] = useState(false);
    const [monthlyLoading, setMonthlyLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [winnerData, setWinnerData] = useState<DrawResponse | null>(null);
    const [showWinnerModal, setShowWinnerModal] = useState(false);
    const [showAnimation, setShowAnimation] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const [animationPhase, setAnimationPhase] = useState<'countdown' | 'reveal' | 'celebrate'>('countdown');

    // Get current month and week in correct format
    const getCurrentMonth = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const getCurrentWeek = () => {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    };

    // Countdown effect
    useEffect(() => {
        if (showAnimation && animationPhase === 'countdown' && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (showAnimation && animationPhase === 'countdown' && countdown === 0) {
            setAnimationPhase('reveal');
            setTimeout(() => {
                setAnimationPhase('celebrate');
                setTimeout(() => {
                    setShowAnimation(false);
                    setShowWinnerModal(true);
                    setAnimationPhase('countdown');
                    setCountdown(10);
                }, 2000);
            }, 1500);
        }
    }, [showAnimation, countdown, animationPhase]);

    const handleWeeklyDraw = async () => {
        if (!weeklyPrize.trim()) {
            setError('Please enter a prize name');
            return;
        }

        setWeeklyLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await conductWeeklyDraw(weeklyPrize.trim());
            if (result.success) {
                setWinnerData(result);
                setShowAnimation(true);
                setAnimationPhase('countdown');
                setCountdown(10);
                setWeeklyPrize('');
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to conduct weekly draw');
        } finally {
            setWeeklyLoading(false);
        }
    };

    const handleMonthlyDraw = async () => {
        if (!monthlyPrize.trim()) {
            setError('Please enter a prize name');
            return;
        }

        setMonthlyLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await conductMonthlyDraw(monthlyPrize.trim());
            if (result.success) {
                setWinnerData(result);
                setShowAnimation(true);
                setAnimationPhase('countdown');
                setCountdown(10);
                setMonthlyPrize('');
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to conduct monthly draw');
        } finally {
            setMonthlyLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">🎟️</span>
                <span className="flex-1">AXIS PLUS Rewards - Draw System</span>
            </h1>

            {/* Alerts */}
            {error && (
                <div className="mb-4 sm:mb-6">
                    <Alert variant="error" title="Error" message={error} />
                </div>
            )}

            {success && (
                <div className="mb-4 sm:mb-6">
                    <Alert variant="success" title="Success" message={success} />
                </div>
            )}

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-4 sm:p-5 mb-4 sm:mb-6 flex items-start gap-3 sm:gap-4">
                <div className="bg-purple-600 rounded-full p-2 sm:p-3 flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-bold text-purple-900 dark:text-purple-200 mb-1">AXIS PLUS Rewards</p>
                    <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">
                        Weighted random draw - more tickets = higher winning chance. Enjoy the spectacular countdown!
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                        📅 Period - Week: <span className="font-semibold">{getCurrentWeek()}</span> | Month: <span className="font-semibold">{getCurrentMonth()}</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Weekly Draw Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 sm:p-6 border-t-4 border-blue-600">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-2xl sm:text-3xl">📆</span>
                            <span className="text-base sm:text-xl">Weekly Draw</span>
                        </h2>
                        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-bold">
                            {getCurrentWeek()}
                        </span>
                    </div>

                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-900 dark:text-blue-200 font-medium">AXIS PLUS Weekly Reward</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label>Prize Name</Label>
                            <Input
                                type="text"
                                placeholder="e.g., AirPods Pro"
                                value={weeklyPrize}
                                onChange={(e) => setWeeklyPrize(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <button
                            onClick={handleWeeklyDraw}
                            disabled={weeklyLoading || !weeklyPrize.trim()}
                            className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold shadow-lg text-sm sm:text-base"
                        >
                            {weeklyLoading ? (
                                <>
                                    <Loader size={20} />
                                    <span className="hidden sm:inline">Conducting Draw...</span>
                                    <span className="sm:hidden">Drawing...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>🎲 Conduct Weekly Draw</span>
                                </>
                            )}
                        </button>

                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                            <p>✓ This week's AXIS PLUS tickets</p>
                            <p>✓ Weighted random selection</p>
                            <p>✓ One draw per week maximum</p>
                        </div>
                    </div>
                </div>

                {/* Monthly Draw Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 sm:p-6 border-t-4 border-purple-600">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-2xl sm:text-3xl">📅</span>
                            <span className="text-base sm:text-xl">Monthly Draw</span>
                        </h2>
                        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-xs font-bold">
                            {getCurrentMonth()}
                        </span>
                    </div>

                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <p className="text-xs text-purple-900 dark:text-purple-200 font-medium">AXIS PLUS Grand Prize</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label>Prize Name</Label>
                            <Input
                                type="text"
                                placeholder="e.g., iPhone 17 Pro"
                                value={monthlyPrize}
                                onChange={(e) => setMonthlyPrize(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <button
                            onClick={handleMonthlyDraw}
                            disabled={monthlyLoading || !monthlyPrize.trim()}
                            className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold shadow-lg text-sm sm:text-base"
                        >
                            {monthlyLoading ? (
                                <>
                                    <Loader size={20} />
                                    <span className="hidden sm:inline">Conducting Draw...</span>
                                    <span className="sm:hidden">Drawing...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                    </svg>
                                    <span>🏆 Conduct Monthly Draw</span>
                                </>
                            )}
                        </button>

                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                            <p>✓ All month's AXIS PLUS tickets</p>
                            <p>✓ Weighted random selection</p>
                            <p>✓ One draw per month maximum</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Countdown Animation Modal */}
            {showAnimation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="relative w-full h-full flex items-center justify-center">
                        {/* Confetti Animation */}
                        <div className="confetti-container">
                            {[...Array(100)].map((_, i) => (
                                <div
                                    key={i}
                                    className="confetti"
                                    style={{
                                        left: `${Math.random() * 100}%`,
                                        animationDelay: `${Math.random() * 5}s`,
                                        animationDuration: `${3 + Math.random() * 2}s`,
                                        backgroundColor: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 6)]
                                    }}
                                />
                            ))}
                        </div>

                        {/* Countdown Phase */}
                        {animationPhase === 'countdown' && (
                            <div className="text-center animate-fade-in">
                                <div className="mb-6 sm:mb-8">
                                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-3 sm:mb-4 animate-pulse-slow">
                                        AXIS GAMING
                                    </h1>
                                    <div className="h-1.5 sm:h-2 w-48 sm:w-64 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 mx-auto rounded-full mb-4 sm:mb-6"></div>
                                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">AXIS PLUS Rewards</p>
                                    <p className="text-base sm:text-lg md:text-xl text-purple-300">Drawing Winner...</p>
                                </div>
                                
                                <div className="relative">
                                    <div className="text-[120px] sm:text-[160px] md:text-[200px] font-black text-white animate-countdown-bounce">
                                        {countdown}
                                    </div>
                                    <div className="absolute inset-0 text-[120px] sm:text-[160px] md:text-[200px] font-black text-purple-500 animate-countdown-pulse opacity-50">
                                        {countdown}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reveal Phase */}
                        {animationPhase === 'reveal' && winnerData?.winner && (
                            <div className="text-center animate-scale-in px-4">
                                <div className="mb-4 sm:mb-6">
                                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-3 sm:mb-4 animate-pulse">
                                        AXIS GAMING
                                    </h1>
                                    <div className="h-1.5 sm:h-2 w-36 sm:w-48 bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 mx-auto rounded-full mb-3 sm:mb-4"></div>
                                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-300">AXIS PLUS Rewards Winner</p>
                                </div>

                                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 shadow-2xl max-w-2xl mx-auto">
                                    <p className="text-4xl sm:text-5xl md:text-6xl mb-4 sm:mb-6">🏆</p>
                                    <p className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 sm:mb-4 break-words">
                                        {winnerData.winner.customerName || winnerData.winner.customerPhone}
                                    </p>
                                    <p className="text-lg sm:text-xl md:text-2xl text-white/90 break-all">{winnerData.winner.customerPhone}</p>
                                </div>
                            </div>
                        )}

                        {/* Celebrate Phase */}
                        {animationPhase === 'celebrate' && winnerData?.winner && (
                            <div className="text-center animate-fade-in px-4">
                                <div className="text-6xl sm:text-7xl md:text-9xl mb-6 sm:mb-8 animate-bounce-in">🎉</div>
                                <h1 className="text-5xl sm:text-6xl md:text-8xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent animate-pulse-slow">
                                    WINNER!
                                </h1>
                                <p className="text-xl sm:text-2xl md:text-3xl text-white mt-4 sm:mt-6 font-bold">AXIS PLUS Rewards</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Winner Details Modal - FULLY RESPONSIVE */}
            <Modal
                isOpen={showWinnerModal}
                onClose={() => {
                    setShowWinnerModal(false);
                    setWinnerData(null);
                    setSuccess('Draw completed successfully!');
                }}
                title=""
            >
                {winnerData?.winner && (
                    <div className="space-y-4 sm:space-y-6 max-h-[80vh] overflow-y-auto">
                        {/* Branding Header */}
                        <div className="text-center bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-lg sm:rounded-xl p-6 sm:p-8 text-white relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/10"></div>
                            <div className="relative z-10">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2">AXIS GAMING</h1>
                                <div className="h-0.5 sm:h-1 w-24 sm:w-32 bg-white/50 mx-auto rounded-full mb-2 sm:mb-3"></div>
                                <p className="text-base sm:text-lg md:text-xl font-bold">AXIS PLUS Rewards</p>
                                <p className="text-xs sm:text-sm opacity-90 mt-1">Winner Announcement</p>
                            </div>
                        </div>

                        {/* Winner Announcement */}
                        <div className="text-center">
                            <div className="text-5xl sm:text-6xl md:text-7xl mb-3 sm:mb-4">🏆</div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                Congratulations!
                            </h2>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                                AXIS PLUS member has won the draw
                            </p>
                        </div>

                        {/* Winner Card */}
                        <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 rounded-lg sm:rounded-xl p-6 sm:p-8 text-white shadow-2xl">
                            <div className="text-center mb-4 sm:mb-6">
                                <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-4 sm:px-6 py-1.5 sm:py-2 mb-3 sm:mb-4">
                                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide">Winner</p>
                                </div>
                                <p className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 break-words px-2">
                                    {winnerData.winner.customerName || 'AXIS PLUS Member'}
                                </p>
                                <p className="text-base sm:text-lg md:text-xl opacity-90 break-all px-2">{winnerData.winner.customerPhone}</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-white/20 gap-2">
                                    <span className="text-white/80 font-medium text-sm sm:text-base">Prize:</span>
                                    <span className="text-base sm:text-lg md:text-xl font-bold text-right break-words">{winnerData.winner.prizeName}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-white/20 gap-2">
                                    <span className="text-white/80 font-medium text-sm sm:text-base">AXIS PLUS Tickets:</span>
                                    <span className="text-base sm:text-lg md:text-xl font-bold">{winnerData.winner.ticketsHeld}</span>
                                </div> 
                                {/* <div className="flex justify-between items-center gap-2">
                                    <span className="text-white/80 font-medium text-sm sm:text-base">Winning Chance:</span>
                                    <span className="text-base sm:text-lg md:text-xl font-bold">
                                        {((winnerData.winner.ticketsHeld / winnerData.totalTicketsInDraw) * 100).toFixed(1)}%
                                    </span>
                                </div> */}
                            </div>
                        </div>

                        {/* Statistics */}
                        {/* <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center border-2 border-purple-200 dark:border-purple-800">
                                <p className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 mb-1 sm:mb-2">
                                    {winnerData.totalEligibleCustomers}
                                </p>
                                <p className="text-xs sm:text-sm font-semibold text-purple-900 dark:text-purple-300">
                                    AXIS PLUS Members
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center border-2 border-blue-200 dark:border-blue-800">
                                <p className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 mb-1 sm:mb-2">
                                    {winnerData.totalTicketsInDraw}
                                </p>
                                <p className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-300">
                                    Total Tickets
                                </p>
                            </div>
                        </div> */}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => {
                                    const winnerInfo = `
🎉 AXIS GAMING - AXIS PLUS REWARDS 🎉

╔════════════════════════════╗
║      WINNER ANNOUNCEMENT      ║
╚════════════════════════════╝

Winner: ${winnerData.winner?.customerName || winnerData.winner?.customerPhone}
Phone: ${winnerData.winner?.customerPhone}
Prize: ${winnerData.winner?.prizeName}

AXIS PLUS Tickets: ${winnerData.winner?.ticketsHeld}
Winning Chance: ${((winnerData.winner!.ticketsHeld / winnerData.totalTicketsInDraw) * 100).toFixed(1)}%

Total Participants: ${winnerData.totalEligibleCustomers}
Total Tickets: ${winnerData.totalTicketsInDraw}

Congratulations from AXIS Gaming! 🎊
                                    `.trim();
                                    navigator.clipboard.writeText(winnerInfo);
                                    alert('Winner info copied to clipboard!');
                                }}
                                className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 text-gray-900 dark:text-white rounded-lg hover:from-gray-300 hover:to-gray-400 dark:hover:from-gray-600 dark:hover:to-gray-500 transition font-semibold flex items-center justify-center gap-2 text-sm sm:text-base"
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span className="hidden sm:inline">Copy Info</span>
                                <span className="sm:hidden">Copy</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowWinnerModal(false);
                                    setWinnerData(null);
                                    setSuccess('Draw completed successfully!');
                                }}
                                className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-bold text-sm sm:text-base"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Styles */}
            <style>{`
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(-100vh) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }

                @keyframes fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes scale-in {
                    0% {
                        transform: scale(0.5);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes bounce-in {
                    0% {
                        transform: scale(0) rotate(-180deg);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.2) rotate(10deg);
                    }
                    100% {
                        transform: scale(1) rotate(0deg);
                        opacity: 1;
                    }
                }

                @keyframes countdown-bounce {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.2);
                    }
                }

                @keyframes countdown-pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.5;
                    }
                    50% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }

                @keyframes pulse-slow {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.7;
                    }
                }

                .confetti {
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    animation: confetti-fall linear infinite;
                    border-radius: 2px;
                }

                @media (min-width: 640px) {
                    .confetti {
                        width: 12px;
                        height: 12px;
                    }
                }

                .confetti-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    overflow: hidden;
                }

                .animate-fade-in {
                    animation: fade-in 0.5s ease-out;
                }

                .animate-scale-in {
                    animation: scale-in 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                }

                .animate-bounce-in {
                    animation: bounce-in 1s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                }

                .animate-countdown-bounce {
                    animation: countdown-bounce 1s ease-in-out infinite;
                }

                .animate-countdown-pulse {
                    animation: countdown-pulse 1s ease-out infinite;
                }

                .animate-pulse-slow {
                    animation: pulse-slow 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default LoyaltyDraws;