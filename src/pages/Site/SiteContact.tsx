import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useSiteContent } from "./SiteContentContext";
import { BTN_PRIMARY, EYEBROW, ScrollCue } from "./SiteUi";
import { hasText, phoneUrl, whatsappUrl } from "./siteHelpers";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#87b2dd]";
const LABEL = "text-sm font-semibold text-white/75";
const SUBJECTS = ["General Enquiry", "Event Booking", "Birthday Bundle", "Café / Menu", "Other"];

export default function SiteContact() {
  const { contact } = useSiteContent();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");

  const waUrl = whatsappUrl(contact.whatsapp);
  const telUrl = phoneUrl(contact.phone);

  // The form hands the message to WhatsApp — the channel AXIS actually answers on.
  const sendViaWhatsApp = () => {
    const lines = [
      "Hello AXIS,",
      name.trim() ? `My name: ${name.trim()}` : null,
      email.trim() ? `Email: ${email.trim()}` : null,
      `Subject: ${subject}`,
      "",
      message.trim() || "(no message)",
    ].filter((l) => l !== null);
    window.open(`${waUrl}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noreferrer");
  };

  return (
    <div>
      <PageMeta title="Contact — AXIS" description={contact.description} />

      <section className="relative overflow-hidden px-4 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className={EYEBROW}>{contact.eyebrow}</p>
          <h1 className="mt-6 text-4xl font-black uppercase tracking-[0.08em] text-white sm:text-6xl lg:text-7xl">
            {contact.title} <span className="text-[#87b2dd]">{contact.highlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">{contact.description}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href={waUrl} target="_blank" rel="noreferrer" className={BTN_PRIMARY}>
              Send a Message
            </a>
            <a
              href={telUrl}
              className="rounded-full border border-[#87b2dd]/70 px-8 py-4 font-bold text-[#d8e8f8] transition-colors hover:bg-[#87b2dd]/10"
            >
              Call Us
            </a>
          </div>
        </div>
      </section>

      <ScrollCue />

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Message form */}
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#b9d3ee]">{contact.formTitle}</p>
              <p className="mt-4 text-white/60">{contact.formDescription}</p>
            </div>
            <form
              className="mt-8 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                sendViaWhatsApp();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className={LABEL}>Name</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={FIELD} />
                </label>
                <label className="space-y-2">
                  <span className={LABEL}>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={FIELD}
                  />
                </label>
              </div>
              <label className="block space-y-2">
                <span className={LABEL}>Subject</span>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={FIELD}>
                  {SUBJECTS.map((s) => (
                    <option key={s} className="bg-[#0c0f14]">
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className={LABEL}>Message</span>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className={FIELD}
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] px-6 py-4 font-bold text-[#071018] shadow-lg shadow-[#87b2dd]/40 transition-transform hover:scale-[1.02]"
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Map + details */}
          <div className="space-y-6">
            {contact.mapEmbed && (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-4 shadow-2xl shadow-black/20 sm:p-5">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#050507]">
                  <div className="relative aspect-[4/3] w-full">
                    <iframe
                      src={contact.mapEmbed}
                      className="absolute inset-0 h-full w-full"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      title="AXIS Local Gaming Hub map"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050507]/30 via-transparent to-transparent" />
                  </div>
                  <div className="border-t border-white/10 px-5 py-4 text-center text-sm text-white/70 sm:text-base">
                    {contact.addressLong || contact.address}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 shadow-2xl shadow-black/20 sm:p-8">
              <div className="space-y-5 text-white/80">
                <div className="flex items-start gap-4">
                  <span className="mt-1 text-[#87b2dd]">📍</span>
                  <p>{contact.address}</p>
                </div>
                <div className="flex items-start gap-4">
                  <span className="mt-1 text-[#87b2dd]">📞</span>
                  <a className="hover:text-white" href={telUrl}>
                    {contact.phone}
                  </a>
                </div>
                <div className="flex items-start gap-4">
                  <span className="mt-1 text-[#87b2dd]">✉️</span>
                  <a className="hover:text-white" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </div>
              </div>
              <div className="mt-8 border-t border-white/10 pt-6">
                <h2 className="text-lg font-extrabold uppercase tracking-[0.18em] text-white">Opening Hours</h2>
                <div className="mt-5 space-y-3">
                  {contact.hours.filter((h) => hasText(h.day, h.time)).map((h, i) => (
                    <div
                      key={`${h.day}-${i}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <span className="font-semibold text-white/80">{h.day}</span>
                      <span className="text-white/55">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
