// PersonAvatar — rounded initials badge for a user (Users Management, Audit Logs).
// The gradient is picked from a stable hash of `seed`, so a person keeps the
// same colour across pages and reloads.

const GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-rose-500",
  "from-pink-500 to-purple-500",
  "from-indigo-500 to-sky-500",
];

function gradientFor(seed: unknown) {
  const s = String(seed ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function initialsOf(name: string) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}

export default function PersonAvatar({ name, seed, size = "md" }: { name: string; seed?: unknown; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-7 w-7 rounded-lg text-[10px]" : "h-9 w-9 rounded-xl text-xs";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-sm ${dims} ${gradientFor(seed ?? name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
