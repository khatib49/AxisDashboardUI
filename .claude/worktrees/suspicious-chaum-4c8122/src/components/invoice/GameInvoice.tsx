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

        const win = window.open('', 'PRINT', 'width=320,height=600');
        if (!win) return;

        win.document.open();
        win.document.write(`
      <html>
        <head>
          <meta charSet="utf-8" />
          <title>Receipt #${transaction.transactionId}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            html, body {
              width: 58mm;
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              overflow: visible !important;
            }

            .pos-receipt {
              width: 54mm !important;
              margin: 0 auto !important;
              padding: 2mm 2mm 12mm !important;
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              max-width: none !important;
            }

            .pos-receipt, .pos-receipt * {
              font-family: 'Courier New', monospace !important;
              font-size: 11px !important;
              line-height: 1.3 !important;
              color: #000 !important;
            }

            .pos-receipt .receipt-store { font-size: 16px !important; font-weight: 700 !important; }
            .pos-receipt .receipt-header-sm { font-size: 9px !important; }
            .pos-receipt .receipt-total { font-size: 13px !important; font-weight: 700 !important; }
            .pos-receipt .receipt-section { font-weight: 700 !important; }
            .pos-receipt .receipt-sep {
              border: none !important;
              border-top: 1px dashed #000 !important;
              margin: 4px 0 !important;
            }
            .pos-receipt .receipt-flex {
              display: flex !important;
              justify-content: space-between !important;
            }
            .pos-receipt .receipt-center { text-align: center !important; }
            .pos-receipt .receipt-right { text-align: right !important; }
            .pos-receipt button, .pos-receipt .print\\:hidden { display: none !important; }

            .pos-spacer { height: 15mm; width: 100%; display: block; }
          </style>
        </head>
        <body></body>
      </html>
    `);
        win.document.close();

        const clone = invoiceEl.cloneNode(true) as HTMLElement;
        clone.classList.add('pos-receipt');
        win.document.body.appendChild(clone);

        const spacer = win.document.createElement('div');
        spacer.className = 'pos-spacer';
        win.document.body.appendChild(spacer);

        setTimeout(() => { win.focus(); win.print(); win.close(); }, 200);
    };

    const formattedDate = new Date(transaction.createdOn).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div id="invoice" className="bg-white mx-auto font-mono" style={{ width: '58mm', padding: '2mm 2mm', fontSize: '11px', lineHeight: '1.3' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', paddingBottom: '3px', marginBottom: '2px' }}>
                <div className="receipt-store" style={{ fontSize: '16px', fontWeight: 700 }}>AXIS</div>
                <div className="receipt-header-sm" style={{ fontSize: '9px' }}>Advanced Technis For Electronic Syst S.A.L</div>
                <div className="receipt-header-sm" style={{ fontSize: '9px' }}>Sassine Street, Ashrafieh, Beirut 0000</div>
                <div className="receipt-header-sm" style={{ fontSize: '9px' }}>Lebanon</div>
                <div className="receipt-header-sm" style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>Finance Registry Number: 3449430</div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Date & Receipt */}
            <div style={{ textAlign: 'center', paddingBottom: '2px' }}>
                <div style={{ fontSize: '10px' }}>{formattedDate}</div>
                <div style={{ fontSize: '10px' }}>Receipt #{transaction.transactionId}</div>
                <div style={{ fontSize: '11px', fontWeight: 700 }}>GAME SESSION</div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Session Details */}
            <div style={{ marginBottom: '2px' }}>
                {transaction.roomName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span>Room:</span>
                        <span style={{ fontWeight: 600 }}>{transaction.roomName}</span>
                    </div>
                )}
                {transaction.setName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span>Persons:</span>
                        <span style={{ fontWeight: 600 }}>{transaction.numberOfPersons}</span>
                    </div>
                )}
                {transaction.setName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span>Set:</span>
                        <span style={{ fontWeight: 600 }}>{transaction.setName}</span>
                    </div>
                )}
                {transaction.gameName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span>Game:</span>
                        <span style={{ fontWeight: 600 }}>{transaction.gameName}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span>Duration:</span>
                    <span style={{ fontWeight: 600 }}>
                        {transaction.hours === 0 ? 'Open Hour' : `${transaction.hours}h`}
                    </span>
                </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Items */}
            {transaction.items && transaction.items.length > 0 && (
                <>
                    <div style={{ marginBottom: '2px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '11px' }}>ITEMS</div>
                        {transaction.items.map((item, idx) => (
                            <div key={idx} style={{ marginBottom: '4px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600 }}>{item.itemName}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                    <span>&nbsp;x{item.quantity} @ ${item.unitPrice.toFixed(2)}</span>
                                    <span style={{ fontWeight: 700 }}>${item.lineTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />
                </>
            )}

            {/* Total */}
            <div style={{ marginBottom: '2px' }}>
                {transaction.discount && transaction.discount.percentage > 0 && (() => {
                    const discountRate = transaction.discount!.percentage > 1 ? transaction.discount!.percentage / 100 : transaction.discount!.percentage;
                    const subtotal = transaction.totalPrice / (1 - discountRate);
                    const discountAmount = subtotal - transaction.totalPrice;
                    return (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span>Discount ({transaction.discount!.name} {transaction.discount!.percentage}%)</span>
                                <span>-${discountAmount.toFixed(2)}</span>
                            </div>
                        </>
                    );
                })()}
                <div className="receipt-total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
                    <span>TOTAL (USD)</span>
                    <span>${transaction.totalPrice.toFixed(2)}</span>
                </div>
                <div className="receipt-total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                    <span>TOTAL (LBP)</span>
                    <span>{(transaction.totalPrice * 90000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} LBP</span>
                </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Comment */}
            {transaction.comment && (
                <>
                    <div style={{ marginBottom: '2px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11px' }}>NOTE:</div>
                        <div style={{ fontSize: '10px', whiteSpace: 'pre-wrap' }}>{transaction.comment}</div>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />
                </>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '10px', paddingBottom: '6px', paddingTop: '2px' }}>
                <div>Thank you for visiting AXIS!</div>
            </div>

            {/* Print Button (only affects screen) */}
            <div className="print:hidden" style={{ textAlign: 'center', marginTop: '8px' }}>
                <button
                    onClick={handlePrint}
                    style={{ padding: '6px 16px', background: '#222', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '12px' }}
                >
                    Print Receipt
                </button>
            </div>
        </div>
    );
};

export default GameInvoice;
