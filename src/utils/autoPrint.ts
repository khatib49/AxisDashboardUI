/**
 * Auto-print utility for 58mm thermal POS printers.
 * Opens a print window with the given HTML content and triggers print automatically.
 */

const POS_STYLES = `
  @page { size: 58mm auto; margin: 0; }
  html, body {
    width: 58mm; margin: 0; padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: visible !important;
  }
  .pos-ticket {
    width: 54mm; margin: 0 auto;
    padding: 2mm 2mm 12mm;
    box-sizing: border-box;
    page-break-inside: avoid;
    max-width: none;
  }
  .pos-ticket, .pos-ticket * {
    font-family: 'Courier New', monospace;
    font-size: 11px; line-height: 1.3; color: #000;
  }
  .pos-ticket .t-store { font-size: 16px; font-weight: 700; }
  .pos-ticket .t-sm { font-size: 9px; }
  .pos-ticket .t-total { font-size: 13px; font-weight: 700; }
  .pos-ticket .t-bold { font-weight: 700; }
  .pos-ticket .t-semi { font-weight: 600; }
  .pos-ticket .t-center { text-align: center; }
  .pos-ticket .t-flex { display: flex; justify-content: space-between; }
  .pos-ticket .t-sep { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .pos-ticket .t-title { font-size: 14px; font-weight: 700; text-align: center; letter-spacing: 1px; }
  .pos-spacer { height: 15mm; width: 100%; display: block; }
`;

export function autoPrintHtml(html: string, title = "Receipt") {
  const win = window.open("", "PRINT_" + Date.now(), "width=320,height=600");
  if (!win) return;

  win.document.open();
  win.document.write(
    `<html><head><meta charset="utf-8"/><title>${title}</title><style>${POS_STYLES}</style></head><body></body></html>`,
  );
  win.document.close();

  const container = win.document.createElement("div");
  container.className = "pos-ticket";
  container.innerHTML = html;
  win.document.body.appendChild(container);

  const spacer = win.document.createElement("div");
  spacer.className = "pos-spacer";
  win.document.body.appendChild(spacer);

  setTimeout(() => {
    win.focus();
    win.print();
    win.close();
  }, 250);
}

export type TicketItem = {
  itemName: string;
  quantity: number;
  specialInstructions?: string;
  categoryName?: string;
};

type StationTicketOptions = {
  stationName: string; // "KITCHEN" or "BAR"
  transactionId: number;
  items: TicketItem[];
  comment?: string;
  customerName?: string;
  setName?: string;
  orderTime: string;
};

function buildStationTicket(opts: StationTicketOptions): string {
  const time = new Date(opts.orderTime).toLocaleString("en-US", {
    timeZone: "Asia/Beirut",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  let html = `
    <div class="t-center">
      <div class="t-title">★ ${opts.stationName} ★</div>
      <div style="font-size:10px">${time}</div>
      <div style="font-size:11px" class="t-bold">Order #${opts.transactionId}</div>
    </div>
    <hr class="t-sep"/>
  `;

  if (opts.customerName || opts.setName) {
    if (opts.customerName)
      html += `<div class="t-flex"><span class="t-bold">Customer:</span><span>${escapeHtml(opts.customerName)}</span></div>`;
    if (opts.setName)
      html += `<div class="t-flex"><span class="t-bold">Set:</span><span>${escapeHtml(opts.setName)}</span></div>`;
    html += `<hr class="t-sep"/>`;
  }

  html += `<div class="t-bold" style="margin-bottom:3px">ITEMS</div>`;
  for (const item of opts.items) {
    html += `<div style="margin-bottom:4px">`;
    html += `<div class="t-semi">${item.quantity}x ${escapeHtml(item.itemName)}</div>`;
    if (item.categoryName)
      html += `<div style="font-size:9px;color:#555">&nbsp;&nbsp;${escapeHtml(item.categoryName)}</div>`;
    if (item.specialInstructions)
      html += `<div style="font-size:10px;font-style:italic">&nbsp;&nbsp;⚠ ${escapeHtml(item.specialInstructions)}</div>`;
    html += `</div>`;
  }

  if (opts.comment) {
    html += `<hr class="t-sep"/>`;
    html += `<div class="t-bold">NOTE:</div>`;
    html += `<div style="font-size:10px;white-space:pre-wrap">${escapeHtml(opts.comment)}</div>`;
  }

  html += `<hr class="t-sep"/>`;
  html += `<div class="t-center" style="font-size:10px;padding:2px 0">--- ${opts.stationName} COPY ---</div>`;

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Print station tickets (kitchen / bar) automatically based on item types.
 * Food items → kitchen ticket, Drink items → bar ticket.
 * itemType 'Food' goes to kitchen, 'Drink' goes to bar.
 */
export function printStationTickets(
  transactionId: number,
  items: Array<{
    itemName: string;
    quantity: number;
    itemType?: string;
    categoryName?: string;
    specialInstructions?: string;
  }>,
  options?: {
    comment?: string;
    customerName?: string;
    setName?: string;
    orderTime?: string;
  },
) {
  const now = options?.orderTime || new Date().toISOString();

  // Split items by type — Food → kitchen, everything else that isn't 'Retail' → bar
  const foodItems: TicketItem[] = [];
  const drinkItems: TicketItem[] = [];

  for (const item of items) {
    const type = (item.itemType || "").toLowerCase();
    const ticket: TicketItem = {
      itemName: item.itemName,
      quantity: item.quantity,
      categoryName: item.categoryName,
      specialInstructions: item.specialInstructions,
    };

    if (type === "food") {
      foodItems.push(ticket);
    } else if (type === "drink") {
      drinkItems.push(ticket);
    }
    // 'Retail' and other types don't get station tickets
  }

  // Print kitchen ticket if there are food items
  if (foodItems.length > 0) {
    const html = buildStationTicket({
      stationName: "KITCHEN",
      transactionId,
      items: foodItems,
      comment: options?.comment,
      customerName: options?.customerName,
      setName: options?.setName,
      orderTime: now,
    });
    autoPrintHtml(html, `Kitchen #${transactionId}`);
  }

  // Print bar ticket if there are drink items (slightly delayed to avoid popup blocking)
  if (drinkItems.length > 0) {
    const delay = foodItems.length > 0 ? 600 : 0;
    setTimeout(() => {
      const html = buildStationTicket({
        stationName: "BAR",
        transactionId,
        items: drinkItems,
        comment: options?.comment,
        customerName: options?.customerName,
        setName: options?.setName,
        orderTime: now,
      });
      autoPrintHtml(html, `Bar #${transactionId}`);
    }, delay);
  }
}
