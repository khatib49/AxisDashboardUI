// Public event registration page — 100% data-driven.
// Routes: /events/:eventKey  and  /events/:eventKey/paid
//
// Everything (title, copy, feature cards, video, price, which payment
// methods to show) comes from the Events row the admin manages under
// Admin → Events. Nothing about a specific event is hardcoded here.

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useLocation } from "react-router";
import {
  getPublicEvent, registerForEvent,
  EventPublic, EventRegisterResult,
} from "../../services/eventService";

type PayMethod = "Visa" | "Whish" | "Cash";

export default function EventRegistrationPage() {
  const { eventKey = "" } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const isPaidPage = location.pathname.endsWith("/paid");
  const paymentFailed = search.get("payment") === "failed";
  const wasCancelled = search.get("cancelled") === "1";

  const [ev, setEv] = useState<EventPublic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [method, setMethod]       = useState<PayMethod | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState<EventRegisterResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!eventKey) return;
    setLoading(true);
    getPublicEvent(eventKey)
      .then(e => { setEv(e); setNotFound(false); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [eventKey]);

  // Preselect when only one payment method is available.
  useEffect(() => {
    if (!ev) return;
    const avail: PayMethod[] = [];
    if (ev.visaAvailable) avail.push("Visa");
    if (ev.whishAvailable) avail.push("Whish");
    if (ev.cashAvailable) avail.push("Cash");
    if (avail.length === 1) setMethod(avail[0]);
  }, [ev]);

  // Scroll-reveal
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("sg-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".sg-reveal").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [ev, result, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    if (!method) { setError("Please choose a payment method."); return; }

    // Open the tab NOW, inside the click gesture. Browsers (mobile Safari
    // especially) block window.open once an await has broken the user-gesture
    // chain, so we grab the tab first and point it at WhatsApp when the API
    // answers. If the registration fails we just close it again.
    const waTab = window.open("", "_blank");

    setSubmitting(true); setError(null);
    try {
      const res = await registerForEvent({
        firstName: firstName.trim(), lastName: lastName.trim(),
        phone: phone.trim(), email: email.trim() || null,
        paymentMethod: method, eventKey,
      });

      // Card/Whish redirect wins — payment first, WhatsApp after they return.
      if (res.redirectUrl) {
        waTab?.close();
        window.location.href = res.redirectUrl;
        return;
      }

      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Registered — send them straight to WhatsApp.
      if (res.whatsAppUrl) {
        if (waTab && !waTab.closed) {
          waTab.location.href = res.whatsAppUrl;
        } else {
          // Popup was blocked; a same-tab navigation is never blocked. The
          // success panel is already rendered behind it, so Back returns to it.
          window.location.href = res.whatsAppUrl;
        }
      } else {
        waTab?.close();
      }
    } catch (err: any) {
      waTab?.close();
      setError(err?.response?.data?.message ?? "Registration failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="sg-root"><style>{CSS}</style><div className="sg-bg" />
      <div className="sg-center-msg">Loading…</div></div>;
  }

  if (notFound || !ev) {
    return <div className="sg-root"><style>{CSS}</style><div className="sg-bg" />
      <div className="sg-center-msg">
        <Symbols />
        <h2>Event not found</h2>
        <p>This event doesn't exist or isn't open for registration yet.</p>
      </div></div>;
  }

  const anyOnline = ev.visaAvailable || ev.whishAvailable;
  const noMethods = !ev.visaAvailable && !ev.whishAvailable && !ev.cashAvailable;
  const closed = ev.isSoldOut || noMethods;

  return (
    <div className="sg-root">
      <style>{CSS}</style>
      <div className="sg-bg" />
      <div className="sg-symbols-bg" aria-hidden>
        {["○","□","△","△","○","□","□","△","○","○","□","△"].map((s, i) => <span key={i}>{s}</span>)}
      </div>

      {/* ══ HERO ══ */}
      <header className="sg-hero">
        {ev.heroImageUrl && <img src={ev.heroImageUrl} alt="" className="sg-hero-img" />}
        <Symbols />
        <p className="sg-pretitle">AXIS Lounge presents</p>
        <h1>{ev.title}</h1>
        {ev.subtitle && <p className="sg-tag">{ev.subtitle}</p>}
        {ev.description && <p className="sg-tag" style={{ marginTop: 8 }}>{ev.description}</p>}

        <div className="sg-meta">
          {ev.eventDate && (
            <span>📅 {new Date(ev.eventDate).toLocaleString("en-GB", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          )}
          {ev.location && <span>📍 {ev.location}</span>}
          <span>🎟 {ev.currency === "USD" ? "$" : ""}{ev.price} {ev.currency !== "USD" ? ev.currency : ""}</span>
        </div>

        {ev.isSoldOut && <div className="sg-soldout">SOLD OUT</div>}
        {!isPaidPage && !closed && <a href="#register" className="sg-btn" style={{ marginTop: 26 }}>Register Now</a>}
        <Symbols style={{ marginTop: 32 }} />
      </header>

      {/* ══ PAID STATE ══ */}
      {isPaidPage && (
        <section className="sg-wrap">
          <div className="sg-card sg-success sg-reveal">
            <div className="sg-big">🎉</div>
            <h2>Payment Received</h2>
            <p>You're officially in. We've saved your spot — see you there.</p>
            <p className="sg-muted">Keep an eye on your phone; we'll message the final details before the event.</p>
          </div>
        </section>
      )}

      {/* ══ POST-SUBMIT (cash / offline) ══ */}
      {result && !isPaidPage && (
        <section className="sg-wrap">
          <div className="sg-card sg-success sg-reveal">
            <div className="sg-big">✅</div>
            <h2>You're Registered!</h2>
            <p>{result.message}</p>
            <div className="sg-reg-no">Registration #{result.registrationId}</div>

            {/* Whish link mode: pay first, then confirm — so the pay button
                comes before the WhatsApp one and is visually primary. */}
            {result.payLinkUrl && (
              <div className="sg-payrow">
                <a href={result.payLinkUrl} target="_blank" rel="noreferrer" className="sg-btn sg-pay">
                  📲 Pay {result.amount.toFixed(2)} {result.currency} with Whish
                </a>
              </div>
            )}

            {/* WhatsApp already opened automatically on submit — this stays
                as the fallback for a blocked popup or a closed tab. */}
            {result.whatsAppUrl && (
              <a href={result.whatsAppUrl} target="_blank" rel="noreferrer" className="sg-btn sg-wa">
                💬 Open WhatsApp again
              </a>
            )}
            <p className="sg-muted" style={{ marginTop: 14 }}>
              {result.payLinkUrl
                ? <>Pay through the Whish link, screenshot the receipt, then send us the WhatsApp message — your spot is held once we confirm it.</>
                : <>We opened WhatsApp for you — just press <b>send</b>. Your spot is held once we confirm payment.</>}
            </p>
          </div>
        </section>
      )}

      {/* ══ FORM ══ */}
      {!isPaidPage && !result && (
        <section id="register" className="sg-wrap">
          {(paymentFailed || wasCancelled) && (
            <div className="sg-alert sg-reveal">
              {paymentFailed
                ? "We couldn't confirm that payment. Try again, or pick another method."
                : "Payment was cancelled. No problem — try again below."}
            </div>
          )}

          {closed ? (
            <div className="sg-card sg-success sg-reveal">
              <div className="sg-big">{ev.isSoldOut ? "🔒" : "⏸"}</div>
              <h2>{ev.isSoldOut ? "Sold Out" : "Registration Closed"}</h2>
              <p>{ev.isSoldOut
                ? "Every spot is taken. Follow us for the next one."
                : "Registration isn't open right now. Check back soon."}</p>
            </div>
          ) : (
            <form ref={formRef} className="sg-card sg-reveal" onSubmit={submit} noValidate>
              <div className="sg-accent" />
              <h2><span className="sg-s">□</span> Registration</h2>
              <p className="sg-sub">Fill in your details to secure your spot. Takes under a minute.</p>

              <div className="sg-grid2">
                <Field label="First Name" required>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)}
                    required autoComplete="given-name" placeholder="e.g. Karim" />
                </Field>
                <Field label="Last Name" required>
                  <input value={lastName} onChange={e => setLastName(e.target.value)}
                    required autoComplete="family-name" placeholder="e.g. Haddad" />
                </Field>
              </div>

              <Field label="Phone Number" required>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                  inputMode="tel" required autoComplete="tel" placeholder="e.g. 70 123 456" />
              </Field>

              <Field label="Email Address" hint="(optional, but preferred)">
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  autoComplete="email" placeholder="you@example.com" />
              </Field>

              <div className="sg-field" style={{ marginTop: 24 }}>
                <label>Payment Method <span className="sg-req">*</span></label>
                <div className="sg-pay">
                  {ev.visaAvailable && (
                    <PayOption value="Visa" icon="💳" name="Visa" desc="Secure card payment"
                      checked={method === "Visa"} onSelect={setMethod} />
                  )}
                  {ev.whishAvailable && (
                    <PayOption value="Whish" icon="📲" name="Whish" desc="Whish Money"
                      checked={method === "Whish"} onSelect={setMethod} />
                  )}
                  {ev.cashAvailable && (
                    <PayOption value="Cash" icon="💵" name="Cash at Store" desc="Pay at AXIS"
                      checked={method === "Cash"} onSelect={setMethod} />
                  )}
                </div>
                {ev.cashAvailable && (
                  <div className="sg-note">
                    💡 You can complete your payment in cash directly at the AXIS store before the event.
                  </div>
                )}
                {!anyOnline && ev.cashAvailable && (
                  <div className="sg-note" style={{ marginTop: 8 }}>
                    Online payment isn't available for this event — pay at the store.
                  </div>
                )}
              </div>

              {error && <div className="sg-error">{error}</div>}

              <div style={{ textAlign: "center", marginTop: 26 }}>
                <button type="submit" className="sg-btn" disabled={submitting}>
                  {submitting ? "Processing…" : "Secure My Spot ➜"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ══ FEATURES ══ */}
      {ev.features.length > 0 && (
        <section className="sg-wrap">
          <div className="sg-head sg-reveal">
            <Symbols />
            <h2>What to Expect</h2>
          </div>
          <div className="sg-features">
            {ev.features.map((f, i) => (
              <div className="sg-feat sg-reveal" key={i}
                style={i === ev.features.length - 1 && ev.features.length % 2 === 1
                  ? { gridColumn: "1 / -1" } : undefined}>
                <div className="sg-fi">{f.icon}</div>
                <div><b>{f.title}</b><span>{f.desc}</span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ VIDEO ══ */}
      {(ev.videoUrl || ev.videoYoutubeId) && (
        <section className="sg-wrap">
          <div className="sg-head sg-reveal">
            <Symbols />
            <h2>Watch the Official Trailer</h2>
            <p>Sound on. 🔊</p>
          </div>
          <div className="sg-video sg-reveal">
            {ev.videoUrl ? (
              // Uploaded file wins over a YouTube id.
              <video src={ev.videoUrl} controls playsInline preload="metadata"
                poster={ev.heroImageUrl ?? undefined} />
            ) : (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ev.videoYoutubeId}?rel=0&modestbranding=1`}
                title="Event trailer" loading="lazy" allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
          </div>
        </section>
      )}

      {/* ══ FINAL CTA ══ */}
      {!isPaidPage && !result && !closed && (
        <section className="sg-wrap">
          <div className="sg-final sg-reveal">
            <Symbols />
            <h2>Ready to Play?</h2>
            <p>Spots are filling fast. Don't watch from the sidelines.</p>
            <a href="#register" className="sg-btn">Register Now</a>
          </div>
        </section>
      )}

      <footer className="sg-footer">
        <Symbols />
        <p>AXIS Lounge — Where Everything Connects.<br />{ev.title} · All rights reserved.</p>
      </footer>
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────
function Symbols({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="sg-symbols" style={style} aria-hidden>
      <span className="sg-c">○</span><span className="sg-s">□</span><span className="sg-t">△</span>
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="sg-field">
      <label>{label} {required && <span className="sg-req">*</span>}
        {hint && <span className="sg-opt"> {hint}</span>}</label>
      {children}
    </div>
  );
}

function PayOption({ value, icon, name, desc, checked, onSelect }: {
  value: PayMethod; icon: string; name: string; desc: string;
  checked: boolean; onSelect: (m: PayMethod) => void;
}) {
  return (
    <button type="button" className={`sg-pay-opt${checked ? " on" : ""}`} onClick={() => onSelect(value)}>
      <span className="ico">{icon}</span>
      <span className="nm">{name}</span>
      <span className="ds">{desc}</span>
    </button>
  );
}

const CSS = `
.sg-root{--bg:#07060B;--card:#131020;--card2:#191430;--purple:#8B5CF6;--purple2:#A78BFA;--blue:#3B82F6;--cyan:#22D3EE;--pink:#F43F5E;--text:#EDEBF7;--muted:#9CA3AF;--border:rgba(139,92,246,.25);
  background:var(--bg);color:var(--text);min-height:100vh;font-family:"Segoe UI",system-ui,sans-serif;line-height:1.6;overflow-x:hidden;position:relative;scroll-behavior:smooth}
.sg-bg{position:fixed;inset:0;z-index:0;background:radial-gradient(60% 40% at 15% 10%,rgba(139,92,246,.16),transparent 60%),radial-gradient(50% 35% at 85% 25%,rgba(59,130,246,.13),transparent 60%),radial-gradient(45% 40% at 50% 90%,rgba(244,63,94,.08),transparent 60%),var(--bg)}
.sg-symbols-bg{position:fixed;inset:0;z-index:0;opacity:.05;font-size:130px;color:var(--purple);display:flex;flex-wrap:wrap;gap:90px;align-content:space-around;justify-content:space-around;pointer-events:none;user-select:none}
.sg-root>*:not(.sg-bg):not(.sg-symbols-bg){position:relative;z-index:1}
.sg-center-msg{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:var(--muted);padding:20px}
.sg-center-msg h2{color:var(--text);font-size:26px;font-weight:800}
.sg-wrap{max-width:760px;margin:0 auto;padding:44px 20px}
.sg-reveal{opacity:0;transform:translateY(28px);transition:opacity .7s,transform .7s}
.sg-in{opacity:1;transform:none}
.sg-symbols{display:flex;justify-content:center;gap:26px;font-size:26px;margin:8px 0}
.sg-symbols span{transition:transform .3s}
.sg-symbols span:hover{transform:scale(1.35) rotate(8deg)}
.sg-c{color:var(--cyan);text-shadow:0 0 12px rgba(34,211,238,.8)}
.sg-s{color:var(--purple);text-shadow:0 0 12px rgba(139,92,246,.8)}
.sg-t{color:var(--pink);text-shadow:0 0 12px rgba(244,63,94,.8)}
.sg-hero{text-align:center;padding:70px 20px 40px;max-width:760px;margin:0 auto}
.sg-hero-img{width:100%;max-height:280px;object-fit:cover;border-radius:18px;margin-bottom:24px;border:1px solid var(--border)}
.sg-pretitle{font-size:13px;letter-spacing:6px;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.sg-hero h1{font-size:clamp(34px,8vw,66px);font-weight:900;line-height:1.06;background:linear-gradient(100deg,#fff 10%,var(--purple2) 45%,var(--blue) 75%,var(--cyan) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 26px rgba(139,92,246,.35))}
.sg-tag{margin-top:16px;color:var(--muted);font-size:clamp(15px,2.6vw,18px)}
.sg-meta{margin-top:20px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.sg-meta span{padding:7px 16px;border:1px solid var(--border);border-radius:999px;font-size:13.5px;background:rgba(139,92,246,.1)}
.sg-soldout{margin-top:20px;display:inline-block;padding:10px 26px;border-radius:999px;background:rgba(244,63,94,.15);border:1px solid var(--pink);color:#FDA4AF;font-weight:800;letter-spacing:2px}
.sg-btn{display:inline-block;border:none;cursor:pointer;padding:16px 42px;border-radius:999px;font-size:17px;font-weight:700;color:#fff;text-decoration:none;background:linear-gradient(95deg,var(--purple),var(--blue));box-shadow:0 0 24px rgba(139,92,246,.45);transition:transform .25s,box-shadow .25s,filter .25s}
.sg-btn:hover:not(:disabled){transform:translateY(-3px) scale(1.03);box-shadow:0 0 34px rgba(139,92,246,.7);filter:brightness(1.1)}
.sg-btn:disabled{opacity:.5;cursor:not-allowed}
.sg-wa{background:linear-gradient(95deg,#16A34A,#22C55E);box-shadow:0 0 24px rgba(34,197,94,.45);margin-top:18px}
/* Whish brand-ish red — the pay-first action in link mode. */
.sg-pay{background:linear-gradient(95deg,#DC2626,#F43F5E);box-shadow:0 0 24px rgba(244,63,94,.45);margin-top:18px}
/* Forces the pay CTA onto its own line above the WhatsApp button. */
.sg-payrow{display:block}
.sg-card{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--border);border-radius:18px;padding:30px 26px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.sg-card h2{font-size:24px;font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:10px}
.sg-sub{color:var(--muted);font-size:14px;margin-bottom:20px}
.sg-accent{height:5px;border-radius:18px 18px 0 0;background:linear-gradient(90deg,var(--cyan),var(--purple),var(--pink));margin:-30px -26px 24px}
.sg-field{margin-bottom:18px}
.sg-field label{display:block;font-size:14px;font-weight:600;margin-bottom:7px}
.sg-req{color:var(--pink)}
.sg-opt{color:var(--muted);font-weight:400;font-size:12px}
.sg-field input{width:100%;padding:14px 16px;background:rgba(7,6,11,.7);border:1.5px solid rgba(156,163,175,.25);border-radius:12px;color:var(--text);font-size:16px;transition:border-color .25s,box-shadow .25s}
.sg-field input:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.18)}
.sg-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:540px){.sg-grid2{grid-template-columns:1fr}}
.sg-pay{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.sg-pay-opt{cursor:pointer;background:rgba(7,6,11,.6);border:1.5px solid rgba(156,163,175,.25);border-radius:14px;padding:18px 12px;text-align:center;color:var(--text);transition:border-color .25s,box-shadow .25s,transform .2s;display:block}
.sg-pay-opt:hover{transform:translateY(-2px);border-color:var(--blue)}
.sg-pay-opt.on{border-color:var(--purple);box-shadow:0 0 0 4px rgba(139,92,246,.18),0 0 24px rgba(139,92,246,.45);background:rgba(139,92,246,.1)}
.sg-pay-opt .ico{font-size:26px;display:block;margin-bottom:6px}
.sg-pay-opt .nm{font-weight:700;font-size:15px;display:block}
.sg-pay-opt .ds{font-size:11.5px;color:var(--muted);display:block}
.sg-note{margin-top:14px;padding:12px 16px;font-size:13.5px;background:rgba(34,211,238,.07);border-left:3px solid var(--cyan);border-radius:8px;color:#C7F5FC}
.sg-error{margin-top:16px;padding:12px 16px;background:rgba(244,63,94,.1);border-left:3px solid var(--pink);border-radius:8px;font-size:14px;color:#FDA4AF}
.sg-alert{margin-bottom:18px;padding:14px 18px;background:rgba(251,191,36,.1);border-left:3px solid #FBBF24;border-radius:8px;font-size:14px;color:#FDE68A}
.sg-success{text-align:center}
.sg-big{font-size:56px;margin-bottom:10px}
.sg-success h2{justify-content:center}
.sg-reg-no{margin-top:12px;font-family:monospace;font-size:13px;color:var(--muted)}
.sg-muted{color:var(--muted);font-size:13.5px}
.sg-head{text-align:center;margin-bottom:26px}
.sg-head h2{font-size:clamp(24px,5vw,34px);font-weight:900;background:linear-gradient(95deg,#fff,var(--purple2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sg-head p{color:var(--muted);font-size:14.5px;margin-top:6px}
.sg-features{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(max-width:620px){.sg-features{grid-template-columns:1fr}}
.sg-feat{background:linear-gradient(160deg,var(--card),var(--card2));border:1px solid var(--border);border-radius:16px;padding:20px 18px;display:flex;align-items:flex-start;gap:14px;transition:transform .25s,box-shadow .25s,border-color .25s}
.sg-feat:hover{transform:translateY(-4px);border-color:var(--purple);box-shadow:0 0 24px rgba(139,92,246,.45)}
.sg-fi{font-size:30px;line-height:1}
.sg-feat b{display:block;font-size:15.5px;margin-bottom:2px}
.sg-feat span{font-size:13px;color:var(--muted)}
.sg-video{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--border);box-shadow:0 0 60px rgba(59,130,246,.25);aspect-ratio:16/9;background:#000}
.sg-video iframe,.sg-video video{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:contain;background:#000}
.sg-final{text-align:center;padding:56px 24px;background:linear-gradient(160deg,rgba(139,92,246,.14),rgba(59,130,246,.1));border:1px solid var(--border);border-radius:22px}
.sg-final h2{font-size:clamp(26px,6vw,40px);font-weight:900;margin-bottom:10px}
.sg-final p{color:var(--muted);margin-bottom:24px}
.sg-footer{text-align:center;padding:40px 20px 60px;color:var(--muted);font-size:13px}
`;
