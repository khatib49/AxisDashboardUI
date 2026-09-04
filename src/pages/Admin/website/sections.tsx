// One form per website section. Each receives the whole document plus a
// `patch` that applies a mutation to a fresh copy.
import { Link } from "react-router";
import { Alert, ColorPicker, Input, Switch } from "antd";
import { SiteContent } from "../../Site/siteContent";
import { Field, ImageField, Repeater, Section, TextField } from "./fields";
import { moveItem } from "./utils";

export type SectionProps = {
  c: SiteContent;
  patch: (fn: (draft: SiteContent) => void) => void;
};

const TWO_COL = "grid gap-4 md:grid-cols-2";

// ── General & contact ──────────────────────────────────────────────────
export function GeneralSection({ c, patch }: SectionProps) {
  return (
    <div className="space-y-5">
      <Section
        title="Announcement bar"
        desc="A slim banner at the very top of every page — promotions, holiday hours, new arrivals."
        action={
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span>{c.announcement.active ? "Shown" : "Hidden"}</span>
            <Switch checked={c.announcement.active} onChange={(v) => patch((d) => { d.announcement.active = v; })} />
          </div>
        }
      >
        <TextField label="Text" value={c.announcement.text} onChange={(v) => patch((d) => { d.announcement.text = v; })} maxLength={160} />
        <div className="flex flex-wrap gap-6">
          <Field label="Background color">
            <ColorPicker value={c.announcement.bgColor} showText onChange={(col) => patch((d) => { d.announcement.bgColor = col.toHexString(); })} />
          </Field>
          <Field label="Text color">
            <ColorPicker value={c.announcement.textColor} showText onChange={(col) => patch((d) => { d.announcement.textColor = col.toHexString(); })} />
          </Field>
          <div className="flex-1 self-end">
            <div
              className="rounded-lg px-4 py-2 text-center text-sm font-semibold"
              style={{ backgroundColor: c.announcement.bgColor, color: c.announcement.textColor }}
            >
              {c.announcement.text || "Preview of the bar"}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Contact details" desc="Used in the footer, the contact page, the WhatsApp button and the join-event messages.">
        <div className={TWO_COL}>
          <TextField label="Phone" value={c.contact.phone} onChange={(v) => patch((d) => { d.contact.phone = v; })} placeholder="78 729 282" />
          <TextField label="WhatsApp number" hint="with country code" value={c.contact.whatsapp} onChange={(v) => patch((d) => { d.contact.whatsapp = v; })} placeholder="+961 78 729 282" />
          <TextField label="Email" value={c.contact.email} onChange={(v) => patch((d) => { d.contact.email = v; })} />
          <TextField label="Instagram link" hint="leave empty to hide the icon" value={c.contact.instagram} onChange={(v) => patch((d) => { d.contact.instagram = v; })} />
          <TextField label="Address (short)" value={c.contact.address} onChange={(v) => patch((d) => { d.contact.address = v; })} />
          <TextField label="Address (under the map)" value={c.contact.addressLong} onChange={(v) => patch((d) => { d.contact.addressLong = v; })} />
          <TextField
            className="md:col-span-2"
            label="Google Maps embed link"
            hint="Google Maps → Share → Embed a map → copy the src=… link. Leave empty to hide the map."
            value={c.contact.mapEmbed}
            onChange={(v) => patch((d) => { d.contact.mapEmbed = v; })}
          />
        </div>
      </Section>

      <Section title="Opening hours" desc="Shown on the contact page, in the order below.">
        <Repeater
          items={c.contact.hours}
          addLabel="Add a row"
          emptyText="No opening hours shown on the site."
          onAdd={() => patch((d) => { d.contact.hours.push({ day: "", time: "" }); })}
          onMove={(i, dir) => patch((d) => moveItem(d.contact.hours, i, dir))}
          onRemove={(i) => patch((d) => { d.contact.hours.splice(i, 1); })}
          renderRow={(h, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={h.day} placeholder="Mon - Thu" onChange={(e) => patch((d) => { d.contact.hours[i].day = e.target.value; })} />
              <Input value={h.time} placeholder="12 pm - 10 pm" onChange={(e) => patch((d) => { d.contact.hours[i].time = e.target.value; })} />
            </div>
          )}
        />
      </Section>

      <Section title="Footer" desc="Bottom of every page.">
        <TextField label="About text" rows={3} value={c.footer.blurb} onChange={(v) => patch((d) => { d.footer.blurb = v; })} />
        <div className={TWO_COL}>
          <TextField label="Tagline (bottom right)" value={c.footer.tagline} onChange={(v) => patch((d) => { d.footer.tagline = v; })} />
          <TextField label="Note under the contact column" value={c.footer.openNote} onChange={(v) => patch((d) => { d.footer.openNote = v; })} />
        </div>
      </Section>
    </div>
  );
}

// ── Home page ──────────────────────────────────────────────────────────
export function HomeSection({ c, patch }: SectionProps) {
  const { hero, overview, gallery, cta } = c.home;
  return (
    <div className="space-y-5">
      <Section title="Hero" desc="The full-screen opening of the home page.">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <ImageField label="Background photo" value={hero.image} onChange={(v) => patch((d) => { d.home.hero.image = v; })} />
            <TextField label="Small line above the title" value={hero.eyebrow} onChange={(v) => patch((d) => { d.home.hero.eyebrow = v; })} />
            <TextField label="Title" value={hero.title} onChange={(v) => patch((d) => { d.home.hero.title = v; })} maxLength={60} />
            <TextField label="Description" rows={3} value={hero.description} onChange={(v) => patch((d) => { d.home.hero.description = v; })} />
          </div>
          <div className="space-y-4">
            <div className={TWO_COL}>
              <TextField label="Primary button" value={hero.primaryLabel} onChange={(v) => patch((d) => { d.home.hero.primaryLabel = v; })} />
              <TextField label="Primary button link" hint="e.g. /menu" value={hero.primaryHref} onChange={(v) => patch((d) => { d.home.hero.primaryHref = v; })} />
              <TextField label="Secondary button" value={hero.secondaryLabel} onChange={(v) => patch((d) => { d.home.hero.secondaryLabel = v; })} />
              <TextField label="Secondary button link" hint="e.g. /services" value={hero.secondaryHref} onChange={(v) => patch((d) => { d.home.hero.secondaryHref = v; })} />
            </div>
            <Field label="Stats under the buttons" hint="big number + small label">
              <Repeater
                items={hero.stats}
                addLabel="Add a stat"
                emptyText="No stats shown."
                onAdd={() => patch((d) => { d.home.hero.stats.push({ value: "", label: "" }); })}
                onMove={(i, dir) => patch((d) => moveItem(d.home.hero.stats, i, dir))}
                onRemove={(i) => patch((d) => { d.home.hero.stats.splice(i, 1); })}
                renderRow={(s, i) => (
                  <div className="grid grid-cols-[6rem_1fr] gap-2">
                    <Input value={s.value} placeholder="5+" onChange={(e) => patch((d) => { d.home.hero.stats[i].value = e.target.value; })} />
                    <Input value={s.label} placeholder="Ways to play" onChange={(e) => patch((d) => { d.home.hero.stats[i].label = e.target.value; })} />
                  </div>
                )}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Overview" desc="The story of AXIS, right under the hero.">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <TextField label="Small line above the title" value={overview.eyebrow} onChange={(v) => patch((d) => { d.home.overview.eyebrow = v; })} />
          <TextField label="Title" value={overview.title} onChange={(v) => patch((d) => { d.home.overview.title = v; })} />
        </div>
        <Field label="Paragraphs">
          <Repeater
            items={overview.paragraphs}
            addLabel="Add a paragraph"
            emptyText="No paragraphs."
            onAdd={() => patch((d) => { d.home.overview.paragraphs.push(""); })}
            onMove={(i, dir) => patch((d) => moveItem(d.home.overview.paragraphs, i, dir))}
            onRemove={(i) => patch((d) => { d.home.overview.paragraphs.splice(i, 1); })}
            renderRow={(p, i) => (
              <Input.TextArea rows={3} value={p} onChange={(e) => patch((d) => { d.home.overview.paragraphs[i] = e.target.value; })} />
            )}
          />
        </Field>
      </Section>

      <Section title="Gallery" desc="Four photos look best; any number works.">
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label="Small line above the title" value={gallery.eyebrow} onChange={(v) => patch((d) => { d.home.gallery.eyebrow = v; })} />
          <TextField label="Title" value={gallery.title} onChange={(v) => patch((d) => { d.home.gallery.title = v; })} />
          <TextField label="Description" value={gallery.description} onChange={(v) => patch((d) => { d.home.gallery.description = v; })} />
        </div>
        <Repeater
          items={gallery.items}
          addLabel="Add a photo"
          emptyText="No photos in the gallery."
          onAdd={() => patch((d) => { d.home.gallery.items.push({ image: "", caption: "" }); })}
          onMove={(i, dir) => patch((d) => moveItem(d.home.gallery.items, i, dir))}
          onRemove={(i) => patch((d) => { d.home.gallery.items.splice(i, 1); })}
          renderRow={(g, i) => (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ImageField label="Photo" value={g.image} aspect="aspect-[16/9]" onChange={(v) => patch((d) => { d.home.gallery.items[i].image = v; })} />
              <TextField label="Caption" value={g.caption} onChange={(v) => patch((d) => { d.home.gallery.items[i].caption = v; })} />
            </div>
          )}
        />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Highlights strip" desc="Short keywords in a row between the gallery and the closing message.">
          <Repeater
            items={c.home.tags}
            addLabel="Add a keyword"
            emptyText="The strip is hidden while empty."
            onAdd={() => patch((d) => { d.home.tags.push(""); })}
            onMove={(i, dir) => patch((d) => moveItem(d.home.tags, i, dir))}
            onRemove={(i) => patch((d) => { d.home.tags.splice(i, 1); })}
            renderRow={(t, i) => <Input value={t} placeholder="Board Games" onChange={(e) => patch((d) => { d.home.tags[i] = e.target.value; })} />}
          />
        </Section>

        <Section title="Closing message" desc="The call to action at the bottom of the home page.">
          <TextField label="Title" value={cta.title} onChange={(v) => patch((d) => { d.home.cta.title = v; })} />
          <TextField label="Description" rows={2} value={cta.description} onChange={(v) => patch((d) => { d.home.cta.description = v; })} />
          <div className={TWO_COL}>
            <TextField label="Primary button" value={cta.primaryLabel} onChange={(v) => patch((d) => { d.home.cta.primaryLabel = v; })} />
            <TextField label="Primary button link" value={cta.primaryHref} onChange={(v) => patch((d) => { d.home.cta.primaryHref = v; })} />
            <TextField label="Secondary button" value={cta.secondaryLabel} onChange={(v) => patch((d) => { d.home.cta.secondaryLabel = v; })} />
            <TextField label="Secondary button link" value={cta.secondaryHref} onChange={(v) => patch((d) => { d.home.cta.secondaryHref = v; })} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Menu page ──────────────────────────────────────────────────────────
export function MenuSection({ c, patch }: SectionProps) {
  return (
    <div className="space-y-5">
      <Alert
        type="info"
        showIcon
        message="Dishes, drinks and prices come from Inventory → Items. This page only controls the header of the menu."
      />
      <Section title="Menu page header">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <ImageField label="Background photo" value={c.menu.image} onChange={(v) => patch((d) => { d.menu.image = v; })} />
            <TextField label="Small line above the title" value={c.menu.eyebrow} onChange={(v) => patch((d) => { d.menu.eyebrow = v; })} />
          </div>
          <div className="space-y-4">
            <div className={TWO_COL}>
              <TextField label="Title (white part)" value={c.menu.title} onChange={(v) => patch((d) => { d.menu.title = v; })} />
              <TextField label="Title (blue part)" value={c.menu.highlight} onChange={(v) => patch((d) => { d.menu.highlight = v; })} />
            </div>
            <TextField label="Description" rows={4} value={c.menu.description} onChange={(v) => patch((d) => { d.menu.description = v; })} />
            <TextField label="Note under the description" value={c.menu.note} onChange={(v) => patch((d) => { d.menu.note = v; })} />
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Services & pricing ─────────────────────────────────────────────────
export function ServicesSection({ c, patch }: SectionProps) {
  const s = c.services;
  return (
    <div className="space-y-5">
      <Section title="Page header">
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label="Small line above the title" value={s.eyebrow} onChange={(v) => patch((d) => { d.services.eyebrow = v; })} />
          <TextField label="Title" value={s.title} onChange={(v) => patch((d) => { d.services.title = v; })} />
          <TextField label="Description" value={s.description} onChange={(v) => patch((d) => { d.services.description = v; })} />
        </div>
      </Section>

      <Section title="Service cards & prices" desc="One card per activity. Each card lists its passes with a price.">
        <Repeater
          items={s.items}
          addLabel="Add a service"
          emptyText="No services yet."
          confirmText="Remove this service and its passes?"
          onAdd={() => patch((d) => { d.services.items.push({ title: "", tagline: "", image: "", passes: [{ label: "", price: "" }] }); })}
          onMove={(i, dir) => patch((d) => moveItem(d.services.items, i, dir))}
          onRemove={(i) => patch((d) => { d.services.items.splice(i, 1); })}
          renderRow={(item, i) => (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-3">
                <ImageField label="Photo" value={item.image} aspect="aspect-[16/9]" onChange={(v) => patch((d) => { d.services.items[i].image = v; })} />
                <TextField label="Title" value={item.title} placeholder="Board Games" onChange={(v) => patch((d) => { d.services.items[i].title = v; })} />
                <TextField label="Tagline" rows={2} value={item.tagline} onChange={(v) => patch((d) => { d.services.items[i].tagline = v; })} />
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Highlight this card with a “Bundle” badge</span>
                  <Switch checked={!!item.featured} onChange={(v) => patch((d) => { d.services.items[i].featured = v; })} />
                </div>
              </div>
              <Field label="Passes & prices" hint="label · price · optional note">
                <Repeater
                  items={item.passes}
                  addLabel="Add a pass"
                  emptyText="No passes on this card."
                  onAdd={() => patch((d) => { d.services.items[i].passes.push({ label: "", price: "" }); })}
                  onMove={(j, dir) => patch((d) => moveItem(d.services.items[i].passes, j, dir))}
                  onRemove={(j) => patch((d) => { d.services.items[i].passes.splice(j, 1); })}
                  rowClassName="!bg-white dark:!bg-white/[0.03]"
                  renderRow={(p, j) => (
                    <div className="grid gap-2 sm:grid-cols-[1.2fr_5rem_1fr]">
                      <Input value={p.label} placeholder="Hour pass" onChange={(e) => patch((d) => { d.services.items[i].passes[j].label = e.target.value; })} />
                      <Input value={p.price} placeholder="3$" onChange={(e) => patch((d) => { d.services.items[i].passes[j].price = e.target.value; })} />
                      <Input value={p.note ?? ""} placeholder="Note (optional)" onChange={(e) => patch((d) => { d.services.items[i].passes[j].note = e.target.value || undefined; })} />
                    </div>
                  )}
                />
              </Field>
            </div>
          )}
        />
      </Section>

      <Section title="Closing message" desc="The call to action under the cards.">
        <div className={TWO_COL}>
          <TextField label="Title" value={s.ctaTitle} onChange={(v) => patch((d) => { d.services.ctaTitle = v; })} />
          <TextField label="Description" value={s.ctaDescription} onChange={(v) => patch((d) => { d.services.ctaDescription = v; })} />
          <TextField label="Button" value={s.ctaButtonLabel} onChange={(v) => patch((d) => { d.services.ctaButtonLabel = v; })} />
          <TextField label="Button link" value={s.ctaButtonHref} onChange={(v) => patch((d) => { d.services.ctaButtonHref = v; })} />
        </div>
      </Section>
    </div>
  );
}

// ── Events page ────────────────────────────────────────────────────────
export function EventsSection({ c, patch }: SectionProps) {
  const { hero, listing, cta } = c.events;
  return (
    <div className="space-y-5">
      <Alert
        type="info"
        showIcon
        message={
          <span>
            The events themselves are managed under <Link to="/admin/events">Events → Manage Events</Link>: every event
            marked <b>Show on website</b> appears on this page, and visitors register on the event's own page. Only the
            wording of the page is edited here.
          </span>
        }
      />
      <Section title="Page header">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <ImageField label="Background photo" value={hero.image} onChange={(v) => patch((d) => { d.events.hero.image = v; })} />
            <TextField label="Small line above the title" value={hero.eyebrow} onChange={(v) => patch((d) => { d.events.hero.eyebrow = v; })} />
            <div className={TWO_COL}>
              <TextField label="Title (white part)" value={hero.title} onChange={(v) => patch((d) => { d.events.hero.title = v; })} />
              <TextField label="Title (blue part)" value={hero.highlight} onChange={(v) => patch((d) => { d.events.hero.highlight = v; })} />
            </div>
          </div>
          <div className="space-y-4">
            <TextField label="Description" rows={6} value={hero.description} onChange={(v) => patch((d) => { d.events.hero.description = v; })} />
            <div className={TWO_COL}>
              <TextField label="Outline button" value={hero.secondaryLabel} onChange={(v) => patch((d) => { d.events.hero.secondaryLabel = v; })} />
              <TextField label="Outline button link" value={hero.secondaryHref} onChange={(v) => patch((d) => { d.events.hero.secondaryHref = v; })} />
              <TextField label="Join button" value={hero.joinLabel} onChange={(v) => patch((d) => { d.events.hero.joinLabel = v; })} />
            </div>
          </div>
        </div>
      </Section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Event list">
          <TextField label="Small line above the title" value={listing.eyebrow} onChange={(v) => patch((d) => { d.events.listing.eyebrow = v; })} />
          <TextField label="Title" value={listing.title} onChange={(v) => patch((d) => { d.events.listing.title = v; })} />
          <TextField label="Message when there are no events" value={listing.emptyState} onChange={(v) => patch((d) => { d.events.listing.emptyState = v; })} />
        </Section>
        <Section title="Closing message">
          <TextField label="Title" value={cta.title} onChange={(v) => patch((d) => { d.events.cta.title = v; })} />
          <TextField label="Description" value={cta.description} onChange={(v) => patch((d) => { d.events.cta.description = v; })} />
          <div className={TWO_COL}>
            <TextField label="Button" value={cta.buttonLabel} onChange={(v) => patch((d) => { d.events.cta.buttonLabel = v; })} />
            <TextField label="Button link" value={cta.buttonHref} onChange={(v) => patch((d) => { d.events.cta.buttonHref = v; })} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Contact page ───────────────────────────────────────────────────────
export function ContactSection({ c, patch }: SectionProps) {
  return (
    <div className="space-y-5">
      <Alert
        type="info"
        showIcon
        message="Phone, email, address, map and opening hours live in General & Contact — they are shared by every page."
      />
      <Section title="Page header">
        <TextField label="Small line above the title" value={c.contact.eyebrow} onChange={(v) => patch((d) => { d.contact.eyebrow = v; })} />
        <div className={TWO_COL}>
          <TextField label="Title (white part)" value={c.contact.title} onChange={(v) => patch((d) => { d.contact.title = v; })} />
          <TextField label="Title (blue part)" value={c.contact.highlight} onChange={(v) => patch((d) => { d.contact.highlight = v; })} />
        </div>
        <TextField label="Description" rows={2} value={c.contact.description} onChange={(v) => patch((d) => { d.contact.description = v; })} />
      </Section>
      <Section title="Message form" desc="The form sends the message to your WhatsApp number.">
        <div className={TWO_COL}>
          <TextField label="Form title" value={c.contact.formTitle} onChange={(v) => patch((d) => { d.contact.formTitle = v; })} />
          <TextField label="Form description" value={c.contact.formDescription} onChange={(v) => patch((d) => { d.contact.formDescription = v; })} />
        </div>
      </Section>
    </div>
  );
}
