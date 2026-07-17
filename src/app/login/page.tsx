import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Hyderabad Sweets Analytics",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between p-12 text-brand-cream lg:flex brand-gradient">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-cream/15 text-brand-cream ring-1 ring-brand-cream/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-xl font-semibold leading-tight">Hyderabad Sweets</p>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-cream/80">Analytics Console</p>
          </div>
        </div>

        <div className="space-y-5">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Understand your customers.
            <br />
            Plan your next sweet spot.
          </h1>
          <p className="max-w-md text-brand-cream/90">
            An internal analytics and expansion planning tool for Hyderabad, Secunderabad &amp; the HMR
            region. Capture purchases, see who&apos;s travelling how far, and discover where the next
            branch should open.
          </p>

          <ul className="space-y-2 text-sm text-brand-cream/85">
            <li>• Area &amp; sub-area level demand insights</li>
            <li>• Branch catchment &amp; travel-distance reports</li>
            <li>• Transparent recommendation engine for new locations</li>
          </ul>
        </div>

        <p className="text-xs text-brand-cream/70">
          Internal use only · Hyderabad, Secunderabad &amp; HMDA region
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your staff account to continue.
            </p>
          </div>

          <Suspense fallback={<Skeleton className="h-44 w-full" />}>
            <LoginForm />
          </Suspense>

          <p className="text-xs text-muted-foreground">
            Don&apos;t have access?{" "}
            <Link href="mailto:owner@hyderabadsweets.local" className="underline underline-offset-4">
              Contact the administrator
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
