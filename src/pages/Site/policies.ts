// Website legal policies — Terms & Conditions, Privacy, Shipping & Delivery,
// Refund / Cancellation / Exchange. Written for AXIS from the MontyPay
// merchant templates (required for card acquiring) and tailored to what the
// site actually sells: trading-card products & accessories (shipped by Aramex
// or picked up), café orders for pickup, event tickets, and gaming sessions.
//
// Contact details (address / phone / email) are injected from the website
// content document so they stay in sync with Admin → Website.

export type PolicySection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type PolicyDoc = { key: PolicyKey; title: string; path: string; updated: string; intro?: string; sections: PolicySection[] };
export type PolicyKey = "terms" | "privacy" | "shipping" | "refunds";

export type PolicyContact = { tradeName: string; domain: string; address: string; phone: string; email: string; country: string };

export const POLICY_LINKS: Array<{ key: PolicyKey; label: string; path: string }> = [
  { key: "terms", label: "Terms & Conditions", path: "/terms" },
  { key: "privacy", label: "Privacy Policy", path: "/privacy" },
  { key: "shipping", label: "Shipping & Delivery", path: "/shipping-policy" },
  { key: "refunds", label: "Refund & Cancellation", path: "/refund-policy" },
];

const UPDATED = "30 September 2026";

export function buildPolicies(c: PolicyContact): Record<PolicyKey, PolicyDoc> {
  const n = c.tradeName;
  return {
    terms: {
      key: "terms", title: "Terms & Conditions", path: "/terms", updated: UPDATED,
      intro: `Welcome to ${n}! The terms “we”, “us” and “our” refer to ${n}, operator of ${c.domain} and the ${n} lounge in ${c.address}. These Terms & Conditions, together with our Privacy Policy, Shipping & Delivery Policy and Refund & Cancellation Policy, describe your rights and responsibilities when you use our website and services (the “Services”). By visiting, browsing, creating an account, placing an order or buying a ticket, you agree to be bound by these Terms. If you do not agree, please do not use the Services.`,
      sections: [
        { heading: "1. Access and account", paragraphs: [
          `You confirm that you are at least 18 years old, or that you use the Services with the consent and supervision of a parent or legal guardian. To order online you create an account with your name, phone number and (optionally) email address and a password. You are responsible for keeping your password confidential and for every order placed from your account; tell us immediately if you suspect unauthorised use. Accounts may not be transferred, sold or shared.`,
        ]},
        { heading: "2. Our products and services", paragraphs: [
          `Through the Services we sell trading-card game products and gaming accessories (the “Products”), café food and drinks for pickup at the lounge, tickets to tournaments and events, and gaming-session passes and wallet top-ups redeemable at the lounge.`,
          `We do our best to describe and picture every item accurately, but colours and appearance may look different depending on your screen or device, and packaging, card artwork and availability can change without notice. Sealed trading-card products are sold as random-content sealed goods: we make no representation about the cards inside a pack or box. We may limit quantities per customer, correct listing errors and discontinue any item at any time.`,
        ]},
        { heading: "3. Orders", paragraphs: [
          `An online order is an offer to buy. It is accepted when our team confirms it (you will see the status change in “My orders”); for card payments, acceptance also requires that the payment has been received and processed. We may refuse or cancel any order — for example when an item sold out at the counter before your order was accepted, when the price shown was obviously wrong, or when we suspect fraud — and we will refund any amount already paid.`,
          `Check your order carefully before submitting. After acceptance, changes or cancellations may not be possible; see our Refund & Cancellation Policy. Purchases are for personal use only and not for resale unless agreed with us in writing.`,
        ]},
        { heading: "4. Prices and payment", paragraphs: [
          `All prices are shown in US dollars (USD) and include applicable taxes unless stated otherwise. Delivery fees, where applicable, are calculated and shown at checkout before you confirm. Prices online may differ from prices at the counter and can change at any time; the price charged is the one shown when you place your order. Promotions and wallet bonuses may have their own conditions.`,
          `We accept Visa and Mastercard through our secure payment partner MontyPay, cash on delivery for courier orders inside Lebanon, cash or card at pickup, and your ${n} wallet balance. Card details are entered on the payment provider's secure page and are never stored by ${n}. You confirm that you are authorised to use the payment method you select and that all charges will be honoured. Please keep your order confirmation for your records.`,
        ]},
        { heading: "5. Shipping and delivery", paragraphs: [
          `Courier delivery is offered inside Lebanon through Aramex; pickup at the lounge is always available. Delivery times shown at checkout are estimates and are not guaranteed. Full details — zones, fees, timelines, failed deliveries — are in our Shipping & Delivery Policy, which forms part of these Terms.`,
        ]},
        { heading: "6. Event tickets and gaming sessions", paragraphs: [
          `A ticket bought online is personal, identified by its ticket code and QR, and must be presented at the door. Tickets are valid only for the event, date and time shown. We may change an event's date, format or venue for operational reasons and will inform ticket holders; if an event is cancelled by us, the ticket price is refunded in full. Lounge rules apply on the premises, and we may refuse entry or end a session in case of abusive or unsafe behaviour without refund.`,
        ]},
        { heading: "7. Intellectual property", paragraphs: [
          `The ${n} name, logo, website design, text, images and videos belong to ${n} or its licensors. Trading-card game names, logos and artwork belong to their respective publishers (for example The Pokémon Company, Konami, Wizards of the Coast) and are used only to identify the products we sell. You may use the Services for personal, non-commercial purposes; you may not copy, scrape, resell or exploit any content without our written permission.`,
        ]},
        { heading: "8. Third-party tools and links", paragraphs: [
          `Payment (MontyPay), delivery (Aramex), maps and social platforms are provided by third parties under their own terms and privacy policies. We are not responsible for their availability or content, and any complaint about a third-party service should be addressed to that provider, although we will gladly help where we can.`,
        ]},
        { heading: "9. Privacy", paragraphs: [
          `Personal information you give us is handled as described in our Privacy Policy. By using the Services you acknowledge that you have read and understood it. Where necessary to provide the Services, your data may be processed by our service providers (payment, delivery, hosting) and stored on cloud servers located outside Lebanon.`,
        ]},
        { heading: "10. Errors, inaccuracies and omissions", paragraphs: [
          `Occasionally the Services may contain typographical errors or inaccuracies in descriptions, prices, promotions, stock or delivery times. We reserve the right to correct them and to cancel affected orders — even after confirmation — with a full refund of any amount paid.`,
        ]},
        { heading: "11. Prohibited uses", paragraphs: [
          `You may use the Services only for lawful purposes. You must not provide false information, use someone else's account or payment method, interfere with the security or operation of the website, attempt to scrape or copy it, transmit harmful code, or use the Services from a country subject to international sanctions where doing so is prohibited. We may suspend or close accounts that breach these Terms.`,
        ]},
        { heading: "12. Termination", paragraphs: [
          `We may suspend or terminate your access to the Services at any time for breach of these Terms. You remain responsible for any amounts due. Provisions on intellectual property, liability, indemnity and governing law survive termination.`,
        ]},
        { heading: "13. Disclaimer of warranties", paragraphs: [
          `Except as expressly stated, the Services and Products are provided “as is” and “as available” without warranties of any kind, express or implied, including merchantability and fitness for a particular purpose. We do not warrant that the website will be uninterrupted or error-free. Nothing in these Terms limits rights you have under Lebanese consumer-protection law that cannot be excluded.`,
        ]},
        { heading: "14. Limitation of liability", paragraphs: [
          `To the fullest extent permitted by law, ${n}, its owners, staff and partners are not liable for indirect, incidental or consequential loss (including loss of profit or data) arising from your use of the Services or Products. Our total liability for any order is limited to the amount you paid for that order.`,
        ]},
        { heading: "15. Indemnification", paragraphs: [
          `You agree to indemnify and hold harmless ${n} and its staff from claims, losses and reasonable legal fees arising from your breach of these Terms, your violation of any law or third-party right, or your misuse of the Services.`,
        ]},
        { heading: "16. Severability, waiver and entire agreement", paragraphs: [
          `If any provision of these Terms is held unenforceable, the remainder stays in force. Our failure to enforce a provision is not a waiver of it. These Terms and the policies they reference are the entire agreement between you and ${n} regarding the Services.`,
        ]},
        { heading: "17. Assignment", paragraphs: [
          `You may not assign your rights under these Terms. We may assign them to a successor of our business.`,
        ]},
        { heading: "18. Force majeure", paragraphs: [
          `We are not liable for delays or failures caused by events beyond our reasonable control, including power or internet outages, courier disruption, strikes, government action, security incidents, epidemics or natural events. Our obligations are suspended for the duration of such an event.`,
        ]},
        { heading: "19. Governing law", paragraphs: [
          `${n} is domiciled in ${c.country}. These Terms are governed by the laws of ${c.country}, and the courts of Beirut have exclusive jurisdiction over any dispute, without prejudice to mandatory consumer rights.`,
        ]},
        { heading: "20. Changes to these Terms", paragraphs: [
          `The current version is always published on this page. We may update it at any time; material changes will be announced on the website. Continued use after an update means you accept the revised Terms.`,
        ]},
        { heading: "21. Contact", paragraphs: [
          `Questions about these Terms: ${c.email} · ${c.phone} · ${n}, ${c.address}, ${c.country}.`,
        ]},
      ],
    },

    privacy: {
      key: "privacy", title: "Privacy Policy", path: "/privacy", updated: UPDATED,
      intro: `This Privacy Policy describes how ${n} (“we”, “us”, “our”) collects, uses and protects your personal information when you visit ${c.domain}, create an account, place an order, buy a ticket or use our lounge services. By using the Services you agree to this policy.`,
      sections: [
        { heading: "1. Information we collect", paragraphs: ["We collect only what we need to serve you:"], bullets: [
          "Contact information — name, phone number, email address, delivery address.",
          "Account information — login details, password (stored hashed, never in plain text), preferences.",
          "Order and ticket information — what you bought, when, how you paid, delivery status, event attendance (check-in).",
          "Wallet and loyalty information — balance, top-ups, points and rewards linked to your account.",
          "Payment information — processed by our payment provider; we receive only a confirmation and the last digits of the card, never the full card number.",
          "Technical information — IP address, browser and device data, and how you use the website (pages visited, errors).",
        ]},
        { heading: "2. How we use your information", paragraphs: ["We use your information to:"], bullets: [
          "Process, prepare, deliver and track your orders and tickets.",
          "Operate your account, wallet and loyalty rewards.",
          "Contact you about your order, ticket or event (confirmations, changes, delivery updates) by phone, WhatsApp or email.",
          "Provide customer support and handle refunds, exchanges and complaints.",
          "Send news about events and offers — only if you opted in; you can opt out at any time.",
          "Prevent fraud, secure the website and comply with legal obligations.",
        ]},
        { heading: "3. Payment security", paragraphs: [
          `All credit/debit card details and personally identifiable information will NOT be stored, sold, shared, rented or leased to any third parties. We do not pass any debit/credit card details to third parties. Card payments are processed through secure and authorised payment service providers (MontyPay); card data is entered on the provider's secure page and never touches ${n}'s servers.`,
        ]},
        { heading: "4. Sharing your information", paragraphs: ["We share your information only with:"], bullets: [
          "Service providers who help us operate — the payment processor (MontyPay), the courier (Aramex, who receives your name, phone and address to deliver your parcel), hosting and IT providers.",
          "Authorities where required by law.",
          "We do not sell your personal information.",
          "Our website and database are hosted on a cloud platform whose servers may be located outside Lebanon; by using the Services you consent to this transfer, which is protected by the security measures described below.",
        ]},
        { heading: "5. Data security", paragraphs: [
          `We protect your information with appropriate technical and organisational measures: encrypted connections (HTTPS), hashed passwords, access limited to staff who need it, and hosting on a secured cloud platform. No transmission over the internet is completely secure, and ${c.domain} cannot guarantee absolute security.`,
        ]},
        { heading: "6. Third-party websites", paragraphs: [
          "Our website links to third-party sites (payment pages, courier tracking, social media, maps). We are not responsible for their privacy practices; please review their policies before providing information to them.",
        ]},
        { heading: "7. Cookies and tracking", paragraphs: [
          "We use essential cookies and browser storage to keep you signed in, remember your cart and make the website work, and basic analytics to understand how the site is used. You can manage or delete cookies in your browser settings; some features (cart, sign-in) need them to function.",
        ]},
        { heading: "8. Data retention", paragraphs: [
          "We keep account, order and ticket records for as long as your account is active and as required for accounting and legal purposes, then delete or anonymise them.",
        ]},
        { heading: "9. Your rights", paragraphs: [
          `You may ask to access, correct or delete your personal information, to close your account, or to stop marketing messages, by contacting us at ${c.email} or at the counter. We will respond within a reasonable time and may need to verify your identity first.`,
        ]},
        { heading: "10. Children's privacy", paragraphs: [
          "Online ordering and ticket purchase are intended for people aged 18 and over. We do not knowingly collect personal information from minors online; a parent or guardian should place orders on behalf of younger players.",
        ]},
        { heading: "11. Policy updates", paragraphs: [
          "We may update this Privacy Policy and our Terms & Conditions to meet legal or operational requirements. Changes take effect when posted on the website; please review these pages regularly.",
        ]},
        { heading: "12. Contact", paragraphs: [
          `${n} · ${c.address}, ${c.country} · ${c.phone} · ${c.email}`,
        ]},
      ],
    },

    shipping: {
      key: "shipping", title: "Shipping & Delivery Policy", path: "/shipping-policy", updated: UPDATED,
      intro: `This policy applies to physical products ordered on ${c.domain} — trading-card products, sleeves, accessories and other retail items. Café orders are for pickup at the lounge only, and event tickets and gaming passes are delivered digitally to your account (no shipping).`,
      sections: [
        { heading: "1. Delivery options", paragraphs: [
          `At checkout you choose either pickup at the ${n} lounge (${c.address}) or courier delivery to your address anywhere in Lebanon. We do not currently ship outside Lebanon.`,
        ]},
        { heading: "2. Shipping costs", paragraphs: [
          "Delivery fees are calculated at checkout based on your city / delivery zone and the parcel weight, and the exact amount is displayed before you confirm the order. Some zones offer free delivery above a minimum order value shown at checkout. Pickup is always free.",
        ]},
        { heading: "3. Processing and delivery time", paragraphs: [
          "Orders are prepared within 1 business day (Monday–Saturday, excluding public holidays) and handed to the courier once accepted and, for card payments, paid. Estimated delivery is 1–2 business days in Beirut and 1–4 business days elsewhere in Lebanon. These are estimates only and can vary with courier performance, weather, road conditions or events beyond our control.",
        ]},
        { heading: "4. Shipping method and tracking", paragraphs: [
          "Parcels are shipped with Aramex. Once your parcel is handed over you receive an Aramex tracking number, and the live status is shown on your order page under “My orders”.",
        ]},
        { heading: "5. Cash on delivery", paragraphs: [
          "For courier orders you may pay in cash to the Aramex courier on delivery. The exact amount (products + delivery fee) is shown at checkout and on your order page; please have it ready in US dollars. A cash-on-delivery order that is refused at the door is treated as a cancelled order, and we may ask for card payment on future orders.",
        ]},
        { heading: "6. Customs, duties and taxes", paragraphs: [
          "Not applicable — we ship within Lebanon only.",
        ]},
        { heading: "7. Delivery issues", paragraphs: [
          "Please make sure your address and phone number are correct; the courier will call before delivering. If a delivery fails because the address was wrong or incomplete or nobody could be reached, a second delivery attempt may be charged at the standard delivery fee. If your parcel arrives damaged, note it with the courier and contact us within 48 hours with photos. Delivery fees are non-refundable once the parcel has been handed to the courier, unless the problem was our error.",
        ]},
        { heading: "8. Contact", paragraphs: [
          `Shipping questions: ${c.email} · ${c.phone} (WhatsApp).`,
        ]},
      ],
    },

    refunds: {
      key: "refunds", title: "Refund, Cancellation & Exchange Policy", path: "/refund-policy", updated: UPDATED,
      intro: `We want you to be happy with what you buy from ${n}. This policy explains when refunds, cancellations and exchanges are available. Please read it before ordering; it forms part of our Terms & Conditions.`,
      sections: [
        { heading: "1. Refund policy", paragraphs: ["Refunds are offered for physical products in the following cases:"], bullets: [
          "The wrong product was delivered.",
          "The product is defective or was damaged during shipping.",
          "The product's factory seal was tampered with before it reached you.",
          "We cancelled or could not fulfil your order.",
        ]},
        { heading: "", paragraphs: [
          "To be eligible, contact us within 3 days of receiving the product with your order code and photos of the item and packaging. Approved refunds are returned to the original payment method: card payments within 7–14 business days depending on your bank, cash payments as store credit to your wallet or in cash at the lounge.",
          "No refund is available for: sealed trading-card products that have been opened (booster packs, boxes, decks — the contents are random by nature); single cards once sleeved/played; food and drinks; digital services once delivered (gaming sessions started, wallet top-ups already spent); and items marked final sale. Delivery fees are refunded only when the return is due to our error.",
        ]},
        { heading: "2. Event tickets", paragraphs: [
          "Event tickets are non-refundable and non-transferable once purchased, except when the event is cancelled by us, in which case the ticket price is refunded in full to the original payment method. If we change the date of an event you may ask, before the new date, for a full refund. A no-show is not refundable.",
        ]},
        { heading: "3. Cancellation policy", paragraphs: [
          "You can cancel an online order yourself from “My orders” as long as its status is still “Received” or “Awaiting payment” — that is, before our team has accepted it. After acceptance, cancellations are at our discretion; an order that has been handed to the courier cannot be cancelled, but you may refuse it at the door (see Shipping & Delivery Policy). Card payments for cancelled orders are refunded in full. Pickup orders that are not collected within 3 days are cancelled; card payments are refunded in full and unpaid orders simply expire.",
          "Cancellation requests can also be sent to us on WhatsApp or by email with your order code.",
        ]},
        { heading: "4. Exchange policy", paragraphs: ["We exchange physical products when:"], bullets: [
          "The wrong product was delivered.",
          "The product is defective or damaged.",
          "The item does not match its description.",
          "You want a different colour / type option of the same item, provided it is unopened, in original condition and requested within 3 days of delivery (subject to stock).",
        ]},
        { heading: "", paragraphs: [
          "Sealed trading-card products that have been opened, food, drinks and final-sale items cannot be exchanged.",
        ]},
        { heading: "5. General conditions", paragraphs: [
          "Return shipping is at the customer's cost unless the issue is due to our error, in which case we arrange the pickup. Items can also be returned in person at the lounge. We reserve the right to inspect returned items before approving a refund or exchange. Refunds are never paid to a different card or person than the one that paid.",
        ]},
        { heading: "6. Contact", paragraphs: [
          `Refund, cancellation or exchange requests: ${c.email} · ${c.phone} (WhatsApp) · ${n}, ${c.address}.`,
        ]},
      ],
    },
  };
}
