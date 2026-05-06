import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  UtensilsCrossed,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Lock,
  Pizza,
} from "lucide-react";
import { useEffect, useState } from "react";
import { login, homeRouteFor, type Role } from "@/lib/auth";

export const Route = createFileRoute("/login")({ component: Login });

const holdingCharacter = "/login-card-holder.png";
const heroCharacter = "/food-character-3.png";

const DEMO_HINTS: Record<Role, { id: string; pin: string; label: string }> = {
  employee: { id: "EMP-1234", pin: "1234", label: "Employee" },
  kitchen: { id: "CHEF-001", pin: "0001", label: "Kitchen Staff" },
  admin: { id: "ADM-001", pin: "9999", label: "Admin" },
};

function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Role>("employee");
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTabChange = (nextTab: Role) => {
    setTab(nextTab);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(tab, id.trim(), pin.trim());
      await new Promise((resolve) => setTimeout(resolve, 400));
      navigate({ to: homeRouteFor(user.role) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setId(DEMO_HINTS[tab].id);
    setPin(DEMO_HINTS[tab].pin);
    setError("");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#fbf8f2] md:fixed md:inset-0 md:overflow-hidden">
      <div className="absolute inset-0">
        <svg
          className="absolute right-0 top-0 hidden h-full md:block"
          style={{ width: "63%" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="loginBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffefb9" />
              <stop offset="55%" stopColor="#fde7a7" />
              <stop offset="100%" stopColor="#f8dd94" />
            </linearGradient>
            <filter id="loginBgShadow" x="-20%" y="-20%" width="160%" height="160%">
              <feDropShadow
                dx="-2"
                dy="0"
                stdDeviation="2.8"
                floodColor="#b8a36d"
                floodOpacity="0.25"
              />
            </filter>
          </defs>
          <path
            d="M28,0
               C18,8 16,24 18,36
               C20,46 28,52 36,55
               C46,59 51,68 49,80
               C47,93 55,100 71,100
               L100,100 L100,0 Z"
            fill="url(#loginBgGradient)"
            filter="url(#loginBgShadow)"
          />
        </svg>

        <div className="absolute right-[10%] top-[18%] hidden md:block">
          <div className="flex h-10 w-10 rotate-[16deg] items-center justify-center rounded-full bg-white/55 text-[23px] shadow-[0_12px_24px_rgba(192,145,51,0.18)]">
            <Pizza className="h-5 w-5 text-[#df734f]" />
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-4 z-50 flex items-center gap-2 sm:left-6 sm:top-5 md:left-8 md:top-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-red-500 shadow-xl shadow-primary/40">
          <UtensilsCrossed className="h-6 w-6 text-white" />
        </div>
        <span className="text-xl font-bold sm:text-2xl">
          <span className="text-primary">Canteen</span>
          <span className="text-slate-700">Pro</span>
        </span>
      </div>

      <div className="absolute left-0 top-0 flex min-h-screen w-full items-start md:h-full">
        <div
          className={`relative z-20 w-full px-4 pb-10 pt-24 transition-all duration-700 sm:px-6 md:w-[50%] md:px-10 md:pt-40 lg:w-[46%] lg:px-12 lg:pt-36 xl:pl-24 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="mb-5 max-w-[430px] lg:mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#df734f]">
              Login to continue
            </p>
          </div>

          <div className="relative max-w-[470px] md:ml-20 lg:ml-28">
            <div
              className="pointer-events-none absolute left-0 top-1/2 z-30 hidden -translate-x-[78%] -translate-y-[43%] md:block"
              style={{ width: "300px" }}
            >
              <img
                src={holdingCharacter}
                alt="Mascot holding the login card"
                className="w-full"
                style={{ filter: "drop-shadow(0 28px 40px rgba(57, 33, 22, 0.18))" }}
              />
            </div>

            <div className="relative z-20 rounded-[28px] border border-[#f1e5d0] bg-white/95 p-4 shadow-[0_28px_80px_-24px_rgba(90,69,36,0.28)] backdrop-blur sm:p-6 md:p-7 lg:p-8">
              <h3 className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.24em] text-[#df734f]">
                Please Login to Continue
              </h3>

              <div className="mb-5 flex rounded-2xl bg-[#f7f1e4] p-1 text-[11px] font-semibold sm:text-xs">
                {(["employee", "kitchen", "admin"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleTabChange(role)}
                    className={`flex-1 rounded-xl py-2.5 capitalize transition-all duration-300 ${
                      tab === role
                        ? "bg-[#df734f] text-white shadow-lg shadow-[#df734f]/30"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    {tab === "employee"
                      ? "Employee ID"
                      : tab === "kitchen"
                        ? "Chef ID"
                        : "Admin ID"}
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder={DEMO_HINTS[tab].id}
                      className="w-full rounded-2xl border-2 border-[#e4d9c7] bg-[#fcfaf4] py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-[#df734f] focus:bg-white focus:shadow-lg focus:shadow-[#df734f]/10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Password / PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      type={showPin ? "text" : "password"}
                      placeholder="****"
                      maxLength={4}
                      className="w-full rounded-2xl border-2 border-[#e4d9c7] bg-[#fcfaf4] py-3 pl-11 pr-12 text-sm text-slate-900 outline-none transition-all focus:border-[#df734f] focus:bg-white focus:shadow-lg focus:shadow-[#df734f]/10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary accent-primary"
                    />
                    <span className="text-xs">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-[#df734f] sm:text-right"
                  >
                    Forgot Password
                  </Link>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#df734f] to-[#ef9b5b] py-3.5 text-sm font-bold text-white shadow-xl shadow-[#df734f]/35 transition-all hover:shadow-2xl hover:shadow-[#df734f]/40 disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        LOGIN
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="rounded-2xl border-2 border-[#f2c15f] bg-white px-5 py-3.5 text-sm font-bold text-[#4a4038] transition-all hover:bg-[#fff7e6] sm:min-w-[120px]"
                  >
                    DEMO
                  </button>
                </div>
              </form>

              <p className="mt-4 text-center text-[11px] text-slate-400">
                Demo: <span className="font-semibold text-slate-500">{DEMO_HINTS[tab].id}</span> /{" "}
                <span className="font-semibold text-slate-500">{DEMO_HINTS[tab].pin}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-[15%] top-[18%] z-10 hidden md:block lg:right-[11%] lg:top-[8%]">
        <img
          src={heroCharacter}
          alt="Food character on yellow background"
          className="h-auto w-[320px] object-contain lg:w-[410px] xl:w-[460px]"
          style={{ filter: "drop-shadow(0 32px 48px rgba(111, 84, 28, 0.22))" }}
        />
      </div>

      <div className="absolute bottom-10 right-10 z-20 hidden text-right md:block">
        <p className="text-xl font-black tracking-tight text-[#df734f] lg:text-[34px]">
          A TASTE BEYOND
        </p>
        <p className="text-xl font-black tracking-tight text-[#df734f] lg:text-[34px]">
          YOUR IMAGINATION
        </p>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .fixed > div:first-child svg {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
