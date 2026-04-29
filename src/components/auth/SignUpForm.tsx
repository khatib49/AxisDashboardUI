import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import { registerUser } from "../../services/authService";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!isChecked) { setError('You must accept terms.'); return; }
    setSubmitting(true);
    try {
      await registerUser({ email, password, displayName: `${firstName} ${lastName}`.trim(), roleName: 'User' });
      setSuccess('Account created. Redirecting to sign in...');
      setTimeout(() => navigate('/signin'), 1200);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="flex flex-col w-full">
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 px-2.5 py-1 mb-5 rounded-full border border-brand-200 bg-brand-50 text-[10px] font-mono uppercase tracking-[0.24em] text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
          <span className="size-1.5 rounded-full bg-brand-500" />
          Request Access
        </span>
        <h1 className="mb-2 font-semibold text-gray-900 text-title-sm dark:text-white sm:text-title-md">
          Create your operator account
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          New accounts require approval from an AXIS administrator.
        </p>
      </div>
      <div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>First Name<span className="text-error-500">*</span></Label>
                    <Input type="text" id="fname" name="fname" placeholder="Enter your first name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>Last Name<span className="text-error-500">*</span></Label>
                    <Input type="text" id="lname" name="lname" placeholder="Enter your last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Email<span className="text-error-500">*</span></Label>
                  <Input type="email" id="email" name="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Password<span className="text-error-500">*</span></Label>
                  <div className="relative">
                    <Input placeholder="Enter your password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <span onClick={() => setShowPassword(!showPassword)} className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2">
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox className="w-5 h-5" checked={isChecked} onChange={setIsChecked} />
                  <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                    By creating an account means you agree to the{" "}
                    <span className="text-gray-800 dark:text-white/90">Terms and Conditions,</span>{" "}
                    and our{" "}
                    <span className="text-gray-800 dark:text-white">Privacy Policy</span>
                  </p>
                </div>
                {error && <p className="text-sm text-error-500">{error}</p>}
                {success && <p className="text-sm text-success-500">{success}</p>}
                <div>
                  <button disabled={submitting} className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg disabled:opacity-50 bg-brand-500 shadow-theme-xs hover:bg-brand-600">
                    {submitting ? 'Creating...' : 'Request access'}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm font-normal text-center text-gray-600 dark:text-gray-400 sm:text-start">
                Already have an account?{" "}
                <Link to="/signin" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
      </div>
    </div>
  );
}
