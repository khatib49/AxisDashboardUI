import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { AxisMark } from "../../components/common/AxisLogo";

export default function NotFound() {
  return (
    <>
      <PageMeta
        title="AXIS Admin — Page not found"
        description="The page you tried to reach does not exist in the AXIS Admin console."
      />
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden bg-gray-50 dark:bg-gray-950">
        <div className="absolute inset-0 axis-grid-bg opacity-60" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 40%, rgba(91,141,239,0.18) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-brand-500/40 blur-2xl rounded-3xl" />
            <div className="relative">
              <AxisMark size={72} />
            </div>
          </div>

          <p className="font-mono text-[11px] tracking-[0.32em] uppercase text-brand-500 dark:text-brand-400">
            Error 404
          </p>

          <h1 className="mt-4 font-display text-3xl tracking-[0.06em] text-gray-900 dark:text-white sm:text-4xl">
            SIGNAL LOST
          </h1>

          <p className="mt-6 max-w-sm text-base text-gray-600 dark:text-gray-400">
            The page you&apos;re looking for isn&apos;t here. It may have been
            moved, renamed, or is restricted to a different role.
          </p>

          <div className="flex flex-col items-center gap-3 mt-10 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/30"
            >
              Back to dashboard
            </Link>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-gray-700 transition border rounded-lg border-gray-300 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Sign in again
            </Link>
          </div>
        </div>

        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-mono uppercase tracking-[0.32em] text-gray-400 dark:text-gray-600">
          AXIS · Admin · {new Date().getFullYear()}
        </p>
      </div>
    </>
  );
}
