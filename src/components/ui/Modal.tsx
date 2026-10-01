import { ReactNode, useEffect } from "react";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    isFullscreen?: boolean;
    footer?: ReactNode;
    /** Optional one-liner under the title. */
    subtitle?: string;
};

/**
 * Dialog shell used across the admin. Header and footer stay fixed; only the
 * body scrolls, and the whole thing never exceeds the viewport — so long
 * forms (items with options/add-ons, shipments, settlements) work on a
 * laptop and on a phone. Escape closes, body scroll is locked while open.
 */
export default function Modal({ isOpen, onClose, title, subtitle, children, className = '', showCloseButton = true, isFullscreen = false, footer }: ModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const containerClasses = isFullscreen
        ? 'w-full h-full max-h-full rounded-none'
        : 'w-full sm:max-w-4xl max-h-[100dvh] sm:max-h-[calc(100dvh-3rem)] rounded-t-2xl sm:rounded-2xl';

    return (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true">
            <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" tabIndex={-1} />
            <div className={`relative z-10 flex flex-col bg-white dark:bg-gray-800 shadow-2xl overflow-hidden ${containerClasses} ${className}`}>
                <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-200 dark:border-white/[0.06]">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {showCloseButton && (
                        <button
                            className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/10"
                            onClick={onClose}
                            aria-label="Close"
                        >✕</button>
                    )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
                {footer && (
                    <div className="shrink-0 px-5 py-3 border-t border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02]">
                        <div className="flex flex-wrap justify-end gap-2">{footer}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
