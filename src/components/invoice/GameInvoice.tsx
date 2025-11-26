import React from 'react';
import { GameTransaction } from '../../services/transactionService';

interface GameInvoiceProps {
    transaction: GameTransaction;
    onPrint?: () => void;
}

const GameInvoice: React.FC<GameInvoiceProps> = ({ transaction, onPrint }) => {
    const handlePrint = () => {
        if (onPrint) onPrint();

        const invoiceEl = document.getElementById('invoice');
        if (!invoiceEl) { window.print(); return; }

        const win = window.open('', 'PRINT', 'width=420,height=700');
        if (!win) return;

        win.document.open();
        win.document.write(`
      <html>
        <head>
          <meta charSet="utf-8" />
          <title>Invoice #${transaction.transactionId}</title>
          <style>
            /* --- POS PAGE: 80mm roll --- */
            /* Reserve feed using a bottom page margin (most drivers honor this). */
            @page {
              size: 80mm auto;
              margin: 0 0 18mm 0; /* ⬅ bottom margin = guaranteed extra paper */
            }

            html, body {
              width: 80mm;
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              overflow: visible !important;
            }

            /* Root container in popup */
            .pos-print {
              width: 76mm !important;                /* safe printable width */
              margin: 0 auto !important;
              padding: 5mm 2mm 16mm !important;      /* ⬅ extra bottom padding */
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              max-width: none !important;
            }

            /* Font sizing for thermal readability */
            .pos-print, .pos-print * {
              font-family: 'Courier New', ui-monospace, Menlo, Consolas, monospace !important;
              font-size: 15px !important;
              line-height: 1.5 !important;
              color: #000 !important;
            }

            /* Tailwind fallbacks (optional) */
            .pos-print .text-xs { font-size: 12px !important; }
            .pos-print .text-sm { font-size: 15px !important; }
            .pos-print .text-lg { font-size: 18px !important; }
            .pos-print .text-xl { font-size: 20px !important; }
            .pos-print .text-2xl { font-size: 22px !important; }
            .pos-print .font-bold { font-weight: 700 !important; }
            .pos-print .font-semibold { font-weight: 600 !important; }
            .pos-print .border-b-2 { border-bottom-width: 1px !important; }
            .pos-print .flex { display: flex !important; }
            .pos-print .justify-between { justify-content: space-between !important; }
            .pos-print .text-center { text-align: center !important; }
            .pos-print .mb-4 { margin-bottom: 8px !important; }
            .pos-print .pb-4 { padding-bottom: 8px !important; }
            .pos-print .mb-2 { margin-bottom: 6px !important; }
            .pos-print .print\\:hidden, .pos-print button { display: none !important; }

            /* Spacer as a last fallback (some drivers still trim blanks) */
            .pos-spacer {
              height: 20mm;   /* can bump to 30–40mm if needed */
              width: 100%;
              display: block;
            }
          </style>
        </head>
        <body></body>
      </html>
    `);
        win.document.close();

        // bring over app styles (optional)
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(n => {
            try { win.document.head.appendChild(n.cloneNode(true)); } catch {
                console.info('Could not clone stylesheet for print window.');
            }
        });

        // clone receipt content
        const clone = invoiceEl.cloneNode(true) as HTMLElement;
        clone.classList.add('pos-print');
        win.document.body.appendChild(clone);

        // fallback spacer (kept small because @page margin already feeds)
        const spacer = win.document.createElement('div');
        spacer.className = 'pos-spacer';
        win.document.body.appendChild(spacer);

        setTimeout(() => { win.focus(); win.print(); win.close(); }, 150);
    };

    const formattedDate = new Date(transaction.createdOn).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div id="invoice" className="bg-white p-6 max-w-sm mx-auto font-mono text-sm">
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                <div className="text-xl font-bold mb-1">GAME SESSION</div>
                <div className="text-xs">RECEIPT</div>
                <div className="text-xs mt-2">{formattedDate}</div>
            </div>

            {/* Session Details */}
            <div className="space-y-1 border-b-2 border-gray-800 pb-4 mb-4">
                {transaction.roomName && (
                    <div className="flex justify-between">
                        <span>Room:</span>
                        <span className="font-semibold">{transaction.roomName}</span>
                    </div>
                )}
                {transaction.setName && (
                    <div className="flex justify-between">
                        <span>Set:</span>
                        <span className="font-semibold">{transaction.setName}</span>
                    </div>
                )}
                {transaction.gameName && (
                    <div className="flex justify-between">
                        <span>Game:</span>
                        <span className="font-semibold">{transaction.gameName}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-semibold">
                        {transaction.hours === 0 ? 'Open Hour' : `${transaction.hours}h`}
                    </span>
                </div>
            </div>

            {/* Items */}
            {transaction.items && transaction.items.length > 0 && (
                <div className="border-b-2 border-gray-800 pb-4 mb-4">
                    <div className="font-bold mb-2">ITEMS:</div>
                    {transaction.items.map((item, idx) => (
                        <div key={idx} className="mb-2">
                            <div className="flex justify-between">
                                <span className="flex-1">{item.itemName}</span>
                                <span className="w-16 text-right">${item.unitPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                                <span className="pl-2 font-bold">x{item.quantity}</span>
                                <span className="flex-1"></span>
                                <span className="w-16 text-right font-semibold">${item.lineTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Total */}
            <div className="space-y-1 border-b-2 border-gray-800 pb-2 mb-4">
                {transaction.discount && (() => {
                    // Calculate subtotal before discount by reversing the discount calculation
                    const discountRate = transaction.discount.percentage > 1 ? transaction.discount.percentage / 100 : transaction.discount.percentage;
                    const subtotal = transaction.totalPrice / (1 - discountRate);
                    const discountAmount = subtotal - transaction.totalPrice;
                    return (
                        <>
                            <div className="flex justify-between text-sm">
                                <span>Subtotal:</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Discount ({transaction.discount.name} - {transaction.discount.percentage}%):</span>
                                <span>-${discountAmount.toFixed(2)}</span>
                            </div>
                        </>
                    );
                })()}
                <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL (USD):</span>
                    <span>${transaction.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL (LBP):</span>
                    <span>{(transaction.totalPrice * 90000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} LBP</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs pb-8 mb-4">
                <p>Thanks for gaming with us at AXIS!</p>
            </div>

            {/* Print Button (only affects screen) */}
            <div className="text-center print:hidden">
                <button
                    onClick={handlePrint}
                    className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition font-sans text-sm"
                >
                    Print Receipt
                </button>
            </div>
        </div>
    );
};

export default GameInvoice;
