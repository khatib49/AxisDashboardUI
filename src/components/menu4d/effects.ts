/** Which living effect suits a menu item, guessed from its name, category and type. */
export type Effect4D = "steam" | "fizz" | "foil" | "glow";

const COLD = ["iced", "cold", "frapp", "smoothie", "shake", "milkshake", "icetea", "ice tea", "juice", "soda", "cola", "coke", "pepsi", "7up", "7 up", "sprite",
  "fanta", "water", "mojito", "lemonade", "beer", "energy", "red bull", "slush", "frozen", "mirinda", "tonic"];
/** Only used when nothing more specific matched (so "Hot drinks" still steams). */
const COLD_WEAK = ["soft drink", "beverage", "drink"];
const DESSERT = ["ice cream", "gelato", "cake", "brownie", "cookie", "dessert", "waffle", "crepe", "donut"];
const HOT = ["coffee", "espresso", "latte", "cappuccino", "americano", "macchiato", "mocha", "tea", "hot ", "soup", "burger", "pizza",
  "pasta", "penne", "fettuccine", "tagliatelle", "spaghetti", "lasagna", "wings", "fries", "chicken", "steak", "sandwich", "wrap",
  "platter", "grill", "tawouk", "falafel", "halloumi", "noodle", "ramen", "rice", "toast", "nachos", "quesadilla", "hot dog", "sub", "kebab",
  "shawarma", "manakish", "croque", "panini", "fried", "meal", "sizzling"];
const FOIL = ["tcg", "pokemon", "pokémon", "yugioh", "yu-gi-oh", "magic", "mtg", "booster", "pack", "card", "sleeve", "deck", "binder",
  "lorcana", "flesh", "grand archive", "one piece", "playmat", "dice", "toploader"];

/** True when a keyword starts a word in the text ("ice" matches "iced", not "choice"). */
const has = (t: string, words: string[]) => words.some((k) => new RegExp(`(^|[^a-z])${k.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));

export function effectFor(name: string, hint?: string | null): Effect4D {
  const t = `${name} ${hint ?? ""}`.toLowerCase();
  if (has(t, FOIL)) return "foil";
  if (has(t, DESSERT)) return "glow";
  if (has(t, COLD)) return "fizz";
  if (has(t, HOT)) return "steam";
  if (has(t, COLD_WEAK)) return "fizz";
  return "glow";
}

/** Ask iPhone for motion access so the photo tilts with the phone; must run inside a tap. */
export function requestMotionAccess() {
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") DOE.requestPermission().catch(() => undefined);
}
