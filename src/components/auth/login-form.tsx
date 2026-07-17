"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/dashboard";
  const isConfigError = params.get("error") === "config";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back!");
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isConfigError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Supabase environment variables are missing on this deployment. Set{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
          <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code>, then redeploy.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@hyderabadsweets.local"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" variant="maroon" size="lg" className="w-full" disabled={isLoading}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in
      </Button>
    </form>
  );
}
