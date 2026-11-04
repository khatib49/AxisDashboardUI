/**
 * Minimal Code 128 encoder (no dependency). Produces the module widths of
 * the bars/spaces so a label page can draw them as SVG rects.
 *
 * - All-digit input of length >= 4 uses code set C (two digits per symbol,
 *   with a single leading code-set-B digit when the length is odd), which
 *   keeps 13-digit EANs short.
 * - Anything else uses code set B (ASCII 32..126). Other characters are
 *   replaced by "?" so the label still prints.
 *
 * Module widths table: index = symbol value 0..106 (103/104/105 = start
 * A/B/C, 106 = stop). Every pattern is bar,space,bar,space,bar,space.
 */
const PATTERNS: readonly string[] = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

export const START_A = 103;
export const START_B = 104;
export const START_C = 105;
export const CODE_C = 99;
export const STOP = 106;

export type Code128Result = {
    /** Symbol values in order: start, data…, checksum, stop. */
    values: number[];
    /** Concatenated module widths (bar, space, bar, …), e.g. "211214111323…2331112". */
    pattern: string;
    /** Total width in modules (for the SVG viewBox). */
    modules: number;
};

/** Symbol values for the text, without checksum/stop. Returns null for empty input. */
export function code128Values(text: string): number[] | null {
    if (!text || text.length === 0) return null;
    const values: number[] = [];
    const allDigits = /^[0-9]+$/.test(text);
    if (allDigits && text.length >= 4) {
        let i = 0;
        if (text.length % 2 === 1) {
            values.push(START_B, text.charCodeAt(0) - 32);
            values.push(CODE_C);
            i = 1;
        } else {
            values.push(START_C);
        }
        for (; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
        return values;
    }
    values.push(START_B);
    for (const ch of text) {
        const c = ch.charCodeAt(0);
        values.push(c >= 32 && c <= 126 ? c - 32 : 63 - 32 /* "?" */);
    }
    return values;
}

/** Modulo-103 checksum: start value + Σ(value × position) over the data symbols. */
export function code128Checksum(values: number[]): number {
    let sum = values[0];
    for (let i = 1; i < values.length; i++) sum += values[i] * i;
    return sum % 103;
}

export function encodeCode128(text: string): Code128Result | null {
    const data = code128Values(text);
    if (!data) return null;
    const values = [...data, code128Checksum(data), STOP];
    const pattern = values.map((v) => PATTERNS[v]).join("");
    let modules = 0;
    for (const d of pattern) modules += Number(d);
    return { values, pattern, modules };
}

export type BarRect = { x: number; w: number };

/** Bars only (x offset + width in modules) for drawing; spaces are skipped. */
export function code128Bars(pattern: string): BarRect[] {
    const bars: BarRect[] = [];
    let x = 0;
    for (let i = 0; i < pattern.length; i++) {
        const w = Number(pattern[i]);
        if (i % 2 === 0) bars.push({ x, w });
        x += w;
    }
    return bars;
}

/** Exposed for the self-check script: every pattern must be 6 digits summing to 11 (stop: 7 digits / 13). */
export function patternTable(): readonly string[] {
    return PATTERNS;
}
