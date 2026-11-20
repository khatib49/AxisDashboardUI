import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { forgotPassword, resetPassword } from "../../services/authService";

// /reset-password
//   no token in the URL → ask for the email and send the link
//   ?email=…&token=…    → (opened from the email) set the new password

const errorText = (err: unknown, fallback: string): string => {
  const e = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
  if (e?.response?.status === 429) return "Too many attempts. Wait a few minutes and try again.";
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
};

function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const cls = kind === "error"
    ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300"
    : "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-300";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export default function ResetPasswordForm() {
  const [params] = useSearchParams();
  const linkEmail = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const hasLink = linkEmail !== "" && token !== "";

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full">
        <div className="mb-7 sm:mb-9">
          <h1 className="mb-2 font-bold tracking-tight text-gray-900 text-title-sm dark:text-white sm:text-title-md">
            {hasLink ? "Choose a new password" : "Forgot your password?"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hasLink
              ? <>Setting a new password for <b className="text-gray-700 dark:text-gray-300">{linkEmail}</b>.</>
              : "Enter the email you sign in with and we'll send you a link to reset it."}
          </p>
        </div>
        {hasLink ? <SetNewPassword email={linkEmail} token={token} /> : <RequestLink />}
        <p className="mt-5 text-sm text-center text-gray-700 dark:text-gray-400 sm:text-start">
          <Link to="/signin" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

function RequestLink() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    setBusy(true);
    try {
      setSent(await forgotPassword(email.trim()));
    } catch (err) {
      setError(errorText(err, "Couldn't send the link. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{sent} Check your inbox and spam folder. The link expires in 2 hours.</Alert>
        <button type="button" onClick={() => setSent(null)} className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Label>Email <span className="text-error-500">*</span></Label>
        <Input type="email" placeholder="info@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <Button type="submit" className="w-full disabled:opacity-50" size="lg" variant="gradient" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

function SetNewPassword({ email, token }: { email: string; token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    try {
      setDone(await resetPassword(email, token, password));
    } catch (err) {
      setError(errorText(err, "Couldn't reset the password. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{done}</Alert>
        <Button className="w-full" size="lg" variant="gradient" onClick={() => navigate("/signin", { replace: true })}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Label>New password <span className="text-error-500">*</span></Label>
        <div className="relative">
          <Input type={show ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span onClick={() => setShow(!show)} className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2">
            {show ? <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" /> : <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">At least 8 characters, with an uppercase letter, a lowercase letter and a number.</p>
      </div>
      <div>
        <Label>Confirm new password <span className="text-error-500">*</span></Label>
        <Input type={show ? "text" : "password"} placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && (
        <Alert kind="error">
          {error}
          {/expired|invalid/i.test(error) && (
            <> <Link to="/reset-password" className="font-semibold underline">Request a new link</Link></>
          )}
        </Alert>
      )}
      <Button type="submit" className="w-full disabled:opacity-50" size="lg" variant="gradient" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
