import type { ReactNode } from "react";
import { Search } from "lucide-react";

type FilterOption = {
  value: string;
  label: string;
};

type DataTableToolbarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  title?: string;
  options?: FilterOption[];
  activeOption?: string;
  onOptionChange?: (value: string) => void;
  customOptionValue?: string;
  fromValue?: string;
  toValue?: string;
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
  extraFilters?: ReactNode;
  actions?: ReactNode;
};

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  options = [],
  activeOption,
  onOptionChange,
  customOptionValue = "custom",
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  extraFilters,
  actions,
}: DataTableToolbarProps) {
  const showCustomRange = activeOption === customOptionValue;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {onSearchChange ? (
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {extraFilters}
          {actions}
        </div>
      </div>

      {options.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => onOptionChange?.(option.value)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  activeOption === option.value
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "border border-border bg-card hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {showCustomRange ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Custom Range
              </div>
              <input
                value={fromValue ?? ""}
                onChange={(e) => onFromChange?.(e.target.value)}
                placeholder="dd/mm/yy"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                value={toValue ?? ""}
                onChange={(e) => onToChange?.(e.target.value)}
                placeholder="dd/mm/yy"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function formatShortDateInput(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function parseShortDateInput(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return null;
  }

  return date;
}
