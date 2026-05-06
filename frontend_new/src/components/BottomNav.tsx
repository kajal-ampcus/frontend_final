import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

export type BottomNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  color?: string;
};

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const location = useLocation();
  const [isHidden, setIsHidden] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const lastScrollY = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBounceAnimation = useCallback(() => {
    setShowBounce(true);
    setVisibleItems([]);

    // Stagger the appearance of each item
    items.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, index]);
      }, index * 80);
    });

    // Reset bounce state after all animations complete
    bounceTimer.current = setTimeout(() => {
      setShowBounce(false);
    }, items.length * 80 + 400);
  }, [items]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDiff = currentScrollY - lastScrollY.current;

          // Only hide if scrolling down significantly
          if (scrollDiff > 5 && currentScrollY > 50) {
            setIsHidden(true);
            setShowBounce(false);
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }

      // Clear existing timer
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
      }

      // Set timer to show nav after scroll stops
      scrollTimer.current = setTimeout(() => {
        setIsHidden(false);
        triggerBounceAnimation();
      }, 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Initial animation on mount
    triggerBounceAnimation();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      if (bounceTimer.current) clearTimeout(bounceTimer.current);
    };
  }, [triggerBounceAnimation]);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-500 ease-out ${
        isHidden ? "translate-y-full" : "translate-y-0"
      }`}
      aria-label="Primary navigation"
    >
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-3xl px-2 pb-4 pt-2 sm:px-4 sm:pb-6 sm:pt-3">
        {/* Glass container */}
        <div className="rounded-2xl border border-border/50 bg-card/80 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-2">
          <ul className="flex items-center justify-start gap-1 overflow-x-auto px-1 hide-scrollbar sm:justify-around sm:gap-0 sm:overflow-visible sm:px-0">
            {items.map((item, index) => {
              const active = location.pathname === item.to;
              const isVisible = visibleItems.includes(index);

              // Calculate wave delay for hide animation
              const waveDelay = Math.abs(index - Math.floor(items.length / 2)) * 50;

              return (
                <li
                  key={item.to}
                  className="relative shrink-0"
                  style={{
                    transitionDelay: isHidden ? `${waveDelay}ms` : "0ms",
                  }}
                >
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    className={`group relative flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all duration-300 sm:min-w-0 sm:px-3 ${
                      active ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    {/* Icon container with bounce animation */}
                    <span
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-white transition-all duration-300 sm:h-11 sm:w-11 ${
                        item.color ?? "bg-gradient-to-br from-primary to-orange-600"
                      } ${active ? "scale-110 shadow-lg" : "scale-95 opacity-80 group-hover:scale-105 group-hover:opacity-100"}`}
                      style={{
                        animation: showBounce && isVisible
                          ? `bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`
                          : "none",
                        transform: isHidden
                          ? `translateY(${30 + Math.sin(index * 0.8) * 10}px) scale(0.8)`
                          : undefined,
                        opacity: isHidden ? 0 : undefined,
                        transition: `all 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${isHidden ? waveDelay : 0}ms`,
                      }}
                    >
                      <item.icon className="h-4 w-4 stroke-[2.2] sm:h-5 sm:w-5" />

                      {/* Active indicator ring */}
                      {active && (
                        <span className="absolute inset-0 rounded-xl ring-4 ring-primary/30 animate-pulse" />
                      )}
                    </span>

                    {/* Label */}
                    <span
                      className={`text-[9px] font-semibold transition-all duration-300 sm:text-[10px] ${
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                      style={{
                        opacity: isHidden ? 0 : 1,
                        transform: isHidden ? "translateY(10px)" : "translateY(0)",
                        transition: `all 0.3s ease ${isHidden ? waveDelay + 50 : 0}ms`,
                      }}
                    >
                      {item.label}
                    </span>

                    {/* Active dot indicator */}
                    {active && !isHidden && (
                      <span
                        className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary shadow-lg shadow-primary/50"
                        style={{
                          animation: showBounce && isVisible ? "scaleIn 0.3s ease forwards 0.3s" : undefined,
                        }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: translateY(30px) scale(0.5);
          }
          50% {
            opacity: 1;
            transform: translateY(-8px) scale(1.1);
          }
          70% {
            transform: translateY(3px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes scaleIn {
          0% {
            transform: translateX(-50%) scale(0);
          }
          100% {
            transform: translateX(-50%) scale(1);
          }
        }
      `}</style>
    </nav>
  );
}
