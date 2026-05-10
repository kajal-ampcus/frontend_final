import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, KeyRound, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : "",
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { id: presetId } = Route.useSearch();
  const navigate = useNavigate();
  const [id, setId] = useState(presetId);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pin !== confirm) {
      setError("PINs do not match");
      return;
    }
    try {
      resetPassword(id.trim(), pin);
      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0e1730] via-[#13203f] to-[#0a1226] p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#f3ece1] p-8 shadow-2xl">
        <Link to="/login" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary">
          <ArrowLeft className="h-3 w-3" /> Back to Login
        </Link>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">Create new PIN</div>
            <div className="text-xs text-slate-500">Choose a new 4-digit access PIN</div>
          </div>
        </div>

        {done ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <div className="text-sm font-semibold text-emerald-800">PIN updated successfully</div>
            <div className="mt-1 text-xs text-emerald-700">Redirecting to login…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Your ID</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="EMP-1234"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">New PIN (4 digits)</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-primary"
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Confirm PIN</label>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                maxLength={4}
                placeholder="••••"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                required
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
            >
              Update PIN
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
