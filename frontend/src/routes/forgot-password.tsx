import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { MOCK_USERS } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const user = MOCK_USERS.find((u) => u.id.toLowerCase() === id.trim().toLowerCase());
    if (!user) {
      setError("No account found with that ID");
      return;
    }
    setSent(true);
    setTimeout(() => navigate({ to: "/reset-password", search: { id: user.id } }), 1200);
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
            <div className="text-lg font-bold text-slate-900">Reset your PIN</div>
            <div className="text-xs text-slate-500">Enter your ID and we'll send recovery instructions</div>
          </div>
        </div>

        {sent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <div className="text-sm font-semibold text-emerald-800">Recovery link sent!</div>
            <div className="mt-1 text-xs text-emerald-700">Redirecting to reset page…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Employee / Staff ID</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="EMP-1234 or CHEF-001"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-primary"
                  required
                />
              </div>
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
              Send Reset Link
            </button>

            <p className="text-center text-[11px] text-slate-500">
              Demo: This is a mock flow — clicking submit will navigate you to the reset page directly.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
