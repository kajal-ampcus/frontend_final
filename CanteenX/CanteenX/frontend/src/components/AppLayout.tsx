import { useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid,
  Clock3,
  Wallet,
  Bell,
  UtensilsCrossed,
  LogOut,
  Search,
  Settings,
  ShoppingCart,
} from "lucide-react";
import type { ReactNode } from "react";
import { logout, getCurrentUser } from "@/lib/auth";
import { BottomNav, type BottomNavItem } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCart } from "@/lib/store";


const nav: BottomNavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, color: "bg-gradient-to-br from-orange-400 to-red-500" },
  { to: "/menu", label: "Menu", icon: UtensilsCrossed, color: "bg-gradient-to-br from-emerald-400 to-teal-600" },
  { to: "/orders", label: "Orders", icon: Clock3, color: "bg-gradient-to-br from-blue-400 to-indigo-600" },
  { to: "/wallet", label: "Wallet", icon: Wallet, color: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { to: "/notifications", label: "Alerts", icon: Bell, color: "bg-gradient-to-br from-pink-400 to-rose-600" },
];

export function AppLayout({
  children,
  title,
  brand = "Canteen Portal",
  user,
}: {
  children: ReactNode;
  title?: string;
  brand?: string;
  brandSub?: string;
  user?: { name: string; role: string };
  showQuickOrder?: boolean;
}) {
  const navigate = useNavigate();
  const session = typeof window !== "undefined" ? getCurrentUser() : null;
  const cart = useCart();
  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const displayUser = user ?? {
    name: session?.name ?? "Guest",
    role: (session?.department ?? "EMPLOYEE").toUpperCase(),
  };

  const displayName = displayUser.name || "Guest";
  const displayRole = displayUser.role || "EMPLOYEE";
  const avatarInitials = displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("");

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 text-white shadow-lg shadow-primary/30">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-primary leading-tight">{brand}</div>
              <div className="text-[11px] tracking-wider text-muted-foreground">
                {title ?? "EMPLOYEE"}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mx-auto hidden max-w-sm flex-1 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search meals, items..."
              className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: "/notifications" })}
              className="relative rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">3</span>
            </button>

            <button
              onClick={() => navigate({ to: "/cart" })}
              className="relative rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white animate-bounce-gentle">
                  {cartCount}
                </span>
              )}
            </button>

            <ThemeToggle />


          </div>

          {/* User */}
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight">{displayName}</div>
              <div className="text-[11px] tracking-wider text-muted-foreground">
                {displayRole}
              </div>
            </div>
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-amber-600 ring-2 ring-primary/20">
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                {avatarInitials}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 px-4 py-6 pb-32 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav items={nav} />
    </div>
  );
}
