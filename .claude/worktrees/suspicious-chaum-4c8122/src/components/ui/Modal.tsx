import { ReactNode } from "react";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    isFullscreen?: boolean;
    footer?: ReactNode;
};

export default function Modal({ isOpen, onClose, title, children, className = '', showCloseButton = true, isFullscreen = false, footer }: ModalProps) {
    if (!isOpen) return null;

    // default to a wider modal and cap height so tall content scrolls inside the modal
    const containerClasses = isFullscreen ? 'w-full h-full' : 'max-w-4xl w-full';

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-auto bg-black/40 pointer-events-auto">
            <div className={`relative z-10 ${containerClasses} mx-4 ${className}`}>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden max-h-[calc(100vh-4rem)]">
                    <div className="flex items-center justify-between px-4 py-3 border-b dark:border-white/[0.03]">
                        <h3 className="text-lg font-medium">{title}</h3>
                        {showCloseButton && (
                            <button className="text-gray-500 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
                        )}
                    </div>
                    <div className="p-4 overflow-auto">{children}</div>
                    {footer && (
                        <div className="px-4 py-3 border-t dark:border-white/[0.03]">
                            <div className="flex justify-end gap-2">{footer}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
