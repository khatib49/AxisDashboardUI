import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnGhost, btnPrimary } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { ensureStationCode, listStationCodes, type StationCode } from "../../services/phase5Service";

/** QR per PS5 station / table: guests order food on the running session without leaving the game. */
export default function StationCodesAdmin() {
  const { t } = useI18n();
  const [codes, setCodes] = useState<StationCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () => listStationCodes().then(setCodes).catch((e) => setError((e as Error).message));
  useEffect(() => { void reload(); }, []);
  const make = (setId: number, rotate: boolean) => { if (rotate && !window.confirm("Make a new code? The old printed QR stops working.")) return; void ensureStationCode(setId, rotate).then(reload).catch((e) => setError((e as Error).message)); };
  const url = (c: StationCode) => `${window.location.origin}/station/${c.token}`;
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Station QR Ordering | Axis" description="Station QR codes" />
      <PageBreadcrumb pageTitle={t("Station QR Ordering")} />
      {error && <Notice kind="error" text={error} onClose={() => setError(null)} />}
      <Card title={t("Station QR Ordering")} actions={<button type="button" className={btnGhost} onClick={() => window.print()}>{t("Print")}</button>}>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">Stick the QR on each console or table. Guests order while their game runs; the food goes on one open invoice for that station and to the kitchen as usual.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {codes.map((c) => (
            <div key={c.setId} className="rounded-xl border border-gray-200 p-3 text-center dark:border-gray-800">
              <p className="font-semibold text-gray-800 dark:text-white/90">{c.room} · {c.station}</p>
              {c.token ? (
                <>
                  <div className="my-2 inline-block rounded-lg bg-white p-2"><QRCodeSVG value={url(c)} size={140} /></div>
                  <p className="break-all text-xs text-gray-500 dark:text-gray-400">{url(c)}</p>
                  <div className="mt-2 flex justify-center gap-2 print:hidden"><a className={btnGhost} href={url(c)} target="_blank" rel="noreferrer">{t("Open")}</a><button type="button" className={btnGhost} onClick={() => make(c.setId, true)}>New code</button></div>
                </>
              ) : <button type="button" className={`${btnPrimary} mt-3`} onClick={() => make(c.setId, false)}>Create QR</button>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
