import { useState } from "react";
import { loginCustomer, registerCustomer, type CustomerDto } from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";
const field = "w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800";

/** Inline sign-in / create-account (shop/auth). Till-created customers "claim" their phone by registering. */
export default function ShopAuthForm({ onDone, compact = false }: { onDone?: (c: CustomerDto) => void; compact?: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const c = mode === "login"
        ? await loginCustomer({ identifier, password })
        : await registerCustomer({ firstName, lastName, phone, email: email || null, password });
      onDone?.(c);
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const tab = (m: "login" | "register", label: string) => (
    <button type="button" onClick={() => { setMode(m); setError(null); }}
      className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === m ? "bg-white shadow text-gray-900 dark:bg-gray-700 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
      aria-pressed={mode === m}>{label}</button>
  );

  return (
    <form onSubmit={submit} className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${compact ? "p-4" : "p-5"}`} data-testid="shop-auth">
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-4">{tab("login", "Sign in")}{tab("register", "Create account")}</div>
      {mode === "login" ? (
        <div className="space-y-3">
          <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Phone or email</span>
            <input className={field} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required name="identifier" /></label>
          <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Password</span>
            <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required name="password" /></label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">First name</span>
              <input className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} required name="firstName" autoComplete="given-name" /></label>
            <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Last name</span>
              <input className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} name="lastName" autoComplete="family-name" /></label>
          </div>
          <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Phone</span>
            <input className={field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required name="phone" autoComplete="tel" placeholder="+961 70 000 000" /></label>
          <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Email (optional)</span>
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} name="email" autoComplete="email" /></label>
          <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Password (6+ characters)</span>
            <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} name="password" autoComplete="new-password" /></label>
          <p className="text-xs text-gray-500 dark:text-gray-400">Already a customer at the counter? Use the same phone number to set your password.</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="mt-4 w-full h-11 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50">
        {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
