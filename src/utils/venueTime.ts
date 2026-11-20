// Venue time zone
// ===============
// The API stores and returns every timestamp in UTC (ISO strings ending in
// "Z"). The dashboard formats them with Date#toLocaleString / DateString /
// TimeString, which without a `timeZone` option render in the *device's* zone,
// so a tablet or PC set to another zone showed the wrong times.
//
// installVenueTimeZone() makes those three methods default to Asia/Beirut.
// Calls that pass their own `timeZone` (e.g. the charts' "UTC" day buckets)
// are left untouched. Date#getHours()/dayjs() still use the device zone.

export const VENUE_TIME_ZONE = "Asia/Beirut";

type LocaleFn = (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) => string;

let installed = false;

export function installVenueTimeZone(timeZone: string = VENUE_TIME_ZONE): void {
  if (installed) return;
  installed = true;
  try {
    // Fails on a browser without IANA zone data — then keep device time.
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    return;
  }
  const proto = Date.prototype as unknown as Record<string, LocaleFn>;
  for (const name of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    const original = proto[name];
    proto[name] = function (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      if (options?.timeZone) return original.call(this, locales, options);
      return original.call(this, locales, { ...options, timeZone });
    };
  }
}
