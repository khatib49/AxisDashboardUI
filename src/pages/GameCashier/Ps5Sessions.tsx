import React, { useEffect, useState } from 'react';
import { getOpenPs5Sessions, closeGameSession, OpenSessionDto } from '../../services/transactionService';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import GameInvoice from '../../components/invoice/GameInvoice';
import { GameTransaction } from '../../services/transactionService';
import AttachClientModal from './AttachClientModal';

const Ps5Sessions: React.FC = () => {
    const [sessions, setSessions] = useState<OpenSessionDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [closingSessionId, setClosingSessionId] = useState<number | null>(null);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState<GameTransaction | null>(null);
    const [toast, setToast] = useState<{ variant: 'success' | 'error', title: string, message: string } | null>(null);
    // Attach-client modal state — one modal reused across all cards.
    const [attachingSession, setAttachingSession] = useState<OpenSessionDto | null>(null);

    const loadSessions = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getOpenPs5Sessions();
            if (response.success) {
                setSessions(response.data || []);
            } else {
                setError(response.message || 'Failed to load sessions');
            }
        } catch (err: unknown) {
            let message = 'Failed to load sessions';
            if (err && typeof err === 'object') {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === 'string') message = maybe.message;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const handleCloseSession = async (sessionId: number) => {
        setClosingSessionId(sessionId);
        try {
            const response = await closeGameSession(sessionId);
            if (response.success) {
                setToast({
                    variant: 'success',
                    title: 'Session Closed',
                    message: 'Session closed successfully'
                });

                // Show invoice if data is returned
                if (response.data) {
                    setCurrentInvoice(response.data as unknown as GameTransaction);
                    setInvoiceModalOpen(true);
                }

                // Refresh sessions list
                await loadSessions();
            } else {
                setToast({
                    variant: 'error',
                    title: 'Failed',
                    message: response.message || 'Failed to close session'
                });
            }
        } catch (err: unknown) {
            let message = 'Failed to close session';
            if (err && typeof err === 'object') {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === 'string') message = maybe.message;
            }
            setToast({
                variant: 'error',
                title: 'Error',
                message
            });
        } finally {
            setClosingSessionId(null);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const getSessionDuration = (createdOn: string) => {
        const start = new Date(createdOn);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        }
        return `${diffMinutes}m`;
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Open PS5 Sessions</h1>
                <button
                    onClick={loadSessions}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {toast && (
                <div className={`mb-4 p-4 rounded-lg ${toast.variant === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    <p className="font-medium">{toast.title}</p>
                    <p className="text-sm">{toast.message}</p>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader />
                </div>
            )}

            {error && !loading && (
                <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            {!loading && !error && sessions.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-lg font-medium">No open sessions</p>
                    <p className="text-sm mt-1">All PS5 sessions are currently closed</p>
                </div>
            )}

            {!loading && !error && sessions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-300"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">
                                        {session.game || 'PS5 Session'}
                                    </h3>
                                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                                        #{session.id}
                                    </span>
                                </div>
                                {session.gameSetting && (
                                    <p className="text-sm text-white/90 mt-1">{session.gameSetting}</p>
                                )}
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Room:</span>
                                    <span className="font-medium text-gray-900">{session.room || '—'}</span>
                                </div>

                                {session.set && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Set:</span>
                                        <span className="font-medium text-gray-900">{session.set}</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Persons:</span>
                                    <span className="font-medium text-gray-900">{session.numberOfPersons || 1}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Duration:</span>
                                    <span className="font-medium text-blue-600">
                                        {session.isDayPass ? 'Day Pass' : (session.hours === 0 ? 'Open Hour' : `${session.hours}h`)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Time Running:</span>
                                    <span className="font-medium text-orange-600">
                                        {getSessionDuration(session.createdOn)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Started By:</span>
                                    <span className="font-medium text-gray-900 text-xs truncate max-w-[150px]" title={session.createdBy}>
                                        {session.createdBy}
                                    </span>
                                </div>

                                {/* Client row — click to attach or change. */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Client:</span>
                                    <button
                                        onClick={() => setAttachingSession(session)}
                                        className="font-medium text-xs px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 truncate max-w-[170px]"
                                        title={session.userName ?? "Attach a client"}
                                    >
                                        {session.userName ? session.userName : "+ Add Client"}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                                    <span className="text-gray-600">Price:</span>
                                    <span className="font-bold text-lg text-green-600">${session.totalPrice.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={() => handleCloseSession(session.id)}
                                    disabled={closingSessionId === session.id}
                                    className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                >
                                    {closingSessionId === session.id ? (
                                        <>
                                            <Loader size={16} />
                                            Closing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Close Session
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Invoice Modal */}
            <Modal
                isOpen={invoiceModalOpen}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setCurrentInvoice(null);
                }}
                title="Session Invoice"
            >
                <div className="max-h-[80vh] overflow-y-auto">
                    {currentInvoice && <GameInvoice transaction={currentInvoice} />}
                </div>
            </Modal>

            {/* Attach / change client */}
            {attachingSession && (
                <AttachClientModal
                    open={!!attachingSession}
                    transactionId={attachingSession.id}
                    currentUserId={attachingSession.userId ?? null}
                    currentUserName={attachingSession.userName ?? null}
                    onCancel={() => setAttachingSession(null)}
                    onSaved={(userId, userName) => {
                        setSessions(prev => prev.map(s =>
                            s.id === attachingSession.id
                                ? { ...s, userId, userName }
                                : s));
                        setAttachingSession(null);
                    }}
                />
            )}
        </div>
    );
};

export default Ps5Sessions;
