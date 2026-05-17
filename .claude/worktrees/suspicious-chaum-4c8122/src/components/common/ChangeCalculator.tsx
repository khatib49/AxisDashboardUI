import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Input from '../form/input/InputField';
import Label from '../form/Label';

const EXCHANGE_RATE = 90000; // 1 USD = 90,000 LBP

type ChangeCalculatorProps = {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number; // Total amount in USD
};

type Result =
    | { status: 'empty' }
    | { status: 'exact'; message: string }
    | {
        status: 'change' | 'remaining';
        message: string;
        amountUsd: number;
        amountLbp: number;
    };

const ChangeCalculator: React.FC<ChangeCalculatorProps> = ({ isOpen, onClose, totalAmount }) => {
    const [totalUsd, setTotalUsd] = useState('');
    const [totalLbp, setTotalLbp] = useState('');
    const [paidUsd, setPaidUsd] = useState('');
    const [paidLbp, setPaidLbp] = useState('');

    // Auto-populate total when modal opens
    React.useEffect(() => {
        if (isOpen && totalAmount > 0) {
            setTotalUsd(totalAmount.toFixed(2));
            setTotalLbp((totalAmount * EXCHANGE_RATE).toFixed(0));
        }
    }, [isOpen, totalAmount]);

    const result: Result = useMemo(() => {
        const tUsd = parseFloat(totalUsd) || 0;
        const tLbp = parseInt(totalLbp) || 0;
        const pUsd = parseFloat(paidUsd) || 0;
        const pLbp = parseInt(paidLbp) || 0;

        // If no amounts entered
        if (tUsd === 0 && tLbp === 0 && pUsd === 0 && pLbp === 0) {
            return { status: 'empty' };
        }

        // Convert everything to USD for calculation
        const totalInUsd = tUsd + tLbp / EXCHANGE_RATE;
        const paidInUsd = pUsd + pLbp / EXCHANGE_RATE;

        const diff = paidInUsd - totalInUsd;

        // Exact match
        if (Math.abs(diff) < 0.01) {
            return {
                status: 'exact',
                message: 'Exact amount paid!'
            };
        }

        // Change to give back
        if (diff > 0) {
            return {
                status: 'change',
                message: 'Change to return:',
                amountUsd: diff,
                amountLbp: Math.round(diff * EXCHANGE_RATE)
            };
        }

        // Still need to pay
        return {
            status: 'remaining',
            message: 'Remaining to pay:',
            amountUsd: Math.abs(diff),
            amountLbp: Math.round(Math.abs(diff) * EXCHANGE_RATE)
        };
    }, [totalUsd, totalLbp, paidUsd, paidLbp]);

    const handleReset = () => {
        setTotalUsd(totalAmount.toFixed(2));
        setTotalLbp((totalAmount * EXCHANGE_RATE).toFixed(0));
        setPaidUsd('');
        setPaidLbp('');
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Change Calculator">
            <div className="space-y-6 p-2">
                {/* Total Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Total Amount</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>USD</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={totalUsd}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotalUsd(e.target.value)}
                                className="text-lg font-semibold"
                            />
                        </div>
                        <div>
                            <Label>LBP</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={totalLbp}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotalLbp(e.target.value)}
                                className="text-lg font-semibold"
                            />
                        </div>
                    </div>
                </div>

                {/* Paid Section */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Amount Paid</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>USD</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={paidUsd}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaidUsd(e.target.value)}
                                className="text-lg font-semibold"
                            />
                        </div>
                        <div>
                            <Label>LBP</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={paidLbp}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaidLbp(e.target.value)}
                                className="text-lg font-semibold"
                            />
                        </div>
                    </div>
                </div>

                {/* Result Section */}
                <div className={`rounded-lg p-4 border-2 ${result.status === 'exact'
                    ? 'bg-green-50 border-green-500'
                    : result.status === 'change'
                        ? 'bg-indigo-50 border-indigo-500'
                        : result.status === 'remaining'
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-gray-50 border-gray-300'
                    }`}>
                    <h3 className={`text-sm font-semibold mb-2 ${result.status === 'exact'
                        ? 'text-green-700'
                        : result.status === 'change'
                            ? 'text-indigo-700'
                            : result.status === 'remaining'
                                ? 'text-orange-700'
                                : 'text-gray-600'
                        }`}>
                        Result
                    </h3>

                    {result.status === 'empty' && (
                        <p className="text-gray-500 text-center py-4">Enter amounts to calculate</p>
                    )}

                    {result.status === 'exact' && (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-2">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-green-700 font-semibold">{result.message}</p>
                        </div>
                    )}

                    {(result.status === 'change' || result.status === 'remaining') && (
                        <div>
                            <p className={`font-medium mb-3 ${result.status === 'change' ? 'text-indigo-700' : 'text-orange-700'
                                }`}>
                                {result.message}
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center bg-white rounded p-3">
                                    <span className="text-sm font-medium text-gray-600">USD:</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        ${result.amountUsd.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-white rounded p-3">
                                    <span className="text-sm font-medium text-gray-600">LBP:</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        {result.amountLbp.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} LBP
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={handleReset}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                    >
                        Close
                    </button>
                </div>

                {/* Exchange Rate Info */}
                <div className="text-center text-xs text-gray-500 pt-2 border-t">
                    Exchange Rate: 1 USD = {EXCHANGE_RATE.toLocaleString()} LBP
                </div>
            </div>
        </Modal>
    );
};

export default ChangeCalculator;
