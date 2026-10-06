import { Pill } from "../../ui/PageKit";
import { marginHint, marginTone, pct } from "./format";

/** Margin % as a coloured pill — the number is always shown, colour only reinforces it. */
export default function MarginPill({ value }: { value: number | null | undefined }) {
    const tone = marginTone(value);
    return (
        <span title={marginHint(value)} className="tabular-nums">
            <Pill tone={tone} dot={value != null}>{pct(value)}</Pill>
        </span>
    );
}
