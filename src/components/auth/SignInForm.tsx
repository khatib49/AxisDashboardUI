import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../context/AuthContext";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login({ email, password });
    setSubmitting(false);
    if (res.success) {
      navigate("/", { replace: true });
    } else if (res.error) {
      setError(res.error);
    }
  }
  return (
    <div className="flex flex-col w-full">
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 px-2.5 py-1 mb-5 rounded-full border border-brand-200 bg-brand-50 text-[10px] font-mono uppercase tracking-[0.24em] text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
          <span className="size-1.5 rounded-full bg-brand-500" />
          Operator Login
        </span>
        <h1 className="mb-2 font-semibold text-gray-900 text-title-sm dark:text-white sm:text-title-md">
          Welcome back
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sign in to continue running the AXIS lounge.
        </p>
      </div>
      <div>
          <div>
            <div className="relative py-3 sm:py-5" />
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Email <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input placeholder="info@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Keep me logged in
                    </span>
                  </div>
                  <Link
                    to="/reset-password"
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Forgot password?
                  </Link>
                </div>
                {error && <p className="text-sm text-error-500">{error}</p>}
                <div>
                  <Button className="w-full disabled:opacity-50" size="sm" disabled={submitting}>
                    {submitting ? 'Signing in...' : 'Sign in'}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm font-normal text-center text-gray-600 dark:text-gray-400 sm:text-start">
                New to AXIS?{" "}
                <Link
                  to="/signup"
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Request access
                </Link>
              </p>
            </div>
          </div>
      </div>
    </div>
  );
}
