import React, { useEffect, useState } from 'react';
import { getOpenPs5Sessions, closeGameSession, OpenSessionDto } from '../../services/transactionService';
import { Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Pill } from '../../components/ui/PageKit';
import { SessionCard, SessionCardSkeleton, TillBar, TillButton, TillSearch, TillToast } from '../../components/till/game/GameTillKit';
import Modal from '../../components/ui/Modal';
import GameInvoice from '../../components/invoice/GameInvoice';
import { GameTransaction } from '../../services/transactionService';
import AttachClientModal from './AttachClientModal';
import PaymentChoiceModal from '../../components/wallet/PaymentChoiceModal';
import { PlayStationIcon } from '../../icons';

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

    // Payment picker (cash / wallet / mix) shown before closing a session.
    const [payingSession, setPayingSession] = useState<OpenSessionDto | null>(null);

    // Quick find — client name, session #, set, room.
    const [sessionSearch, setSessionSearch] = useState('');

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

    const handleCloseSession = async (sessionId: number, walletAmount = 0) => {
        setClosingSessionId(sessionId);
        try {
            const response = await closeGameSession(sessionId, walletAmount);
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


    const visibleSessions = (() => {
        const q = sessionSearch.trim().toLowerCase();
        if (!q) return sessions;
        return sessions.filter((s) =>
            (s.userName ?? '').toLowerCase().includes(q) ||
            String(s.id).includes(q) ||
            (s.set ?? '').toLowerCase().includes(q) ||
            (s.room ?? '').toLowerCase().includes(q) ||
            (s.createdBy ?? '').toLowerCase().includes(q)
        );
    })();

    return (
        <div className="space-y-5 p-4 sm:p-6">
            <TillBar
                tone="blue"
                icon={<PlayStationIcon className="h-5 w-5" />}
                title="Open PS5 Sessions"
                meta={!loading && !error ? (
                    <Pill tone="blue" dot>{sessions.length} open</Pill>
                ) : null}
                actions={
                    <>
                        <TillSearch
                            value={sessionSearch}
                            onChange={setSessionSearch}
                            onClear={() => setSessionSearch('')}
                            placeholder="Client, session #, set…"
                            className="flex-1 sm:w-72 sm:flex-none"
                        />
                        <TillButton variant="blue" onClick={loadSessions} ariaLabel="Refresh sessions">
                            <ReloadOutlined spin={loading} />
                            <span className="hidden sm:inline">Refresh</span>
                        </TillButton>
                    </>
                }
            />

            {toast && <TillToast variant={toast.variant} title={toast.title} message={toast.message} />}

            {loading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <SessionCardSkeleton key={i} />)}
                </div>
            )}

            {error && !loading && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                </div>
            )}

            {!loading && !error && sessions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 dark:border-white/[0.08] dark:bg-white/[0.02]">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <div>
                                <p className="text-base font-medium text-gray-700 dark:text-gray-200">No open sessions</p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">All PS5 sessions are currently closed</p>
                            </div>
                        }
                    />
                </div>
            )}

            {!loading && !error && sessions.length > 0 && (
                <>
                    {visibleSessions.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-white/[0.08] dark:text-gray-400">
                            No sessions match “{sessionSearch}”.
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleSessions.map((session) => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                fallbackTitle="PS5 Session"
                                accent="blue"
                                elapsed={getSessionDuration(session.createdOn)}
                                closing={closingSessionId === session.id}
                                onAttachClient={() => setAttachingSession(session)}
                                onClose={() => setPayingSession(session)}
                            />
                        ))}
                    </div>
                </>
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
            {/* Payment picker — session price is computed at close, so the
                wallet option means "cover as much as the balance allows". */}
            {payingSession && (
                <PaymentChoiceModal
                    open
                    total={null}
                    userId={payingSession.userId}
                    userName={payingSession.userName}
                    busy={closingSessionId === payingSession.id}
                    onCancel={() => setPayingSession(null)}
                    onConfirm={async (walletAmount) => {
                        const id = payingSession.id;
                        setPayingSession(null);
                        await handleCloseSession(id, walletAmount);
                    }}
                />
            )}

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
