import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="space-y-5">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl brand-gradient text-brand-cream shadow-lg">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="font-display text-4xl font-semibold">Lost in the bylanes</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          We couldn&apos;t find that page. Head back to the dashboard or try one of the workspace
          sections from the sidebar.
        </p>
        <Button asChild variant="maroon">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
