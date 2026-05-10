import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTableToolbar } from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createAnnouncement,
  deleteAnnouncement,
  type Announcement,
  updateAnnouncement,
  useStore,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { AdminLayout } from "./admin-orders";

export const Route = createFileRoute("/admin-announcements")({ component: AdminAnnouncements });

type AnnouncementForm = {
  title: string;
  message: string;
  date: string;
  fromTime: string;
  toTime: string;
  specialDish: string;
  active: boolean;
};

type AnnouncementErrors = Partial<Record<keyof AnnouncementForm, string>>;
type AdminAnnouncement = Announcement;

const PAGE_SIZE = 6;

const createDefaultForm = (): AnnouncementForm => ({
  title: "",
  message: "",
  date: new Date().toISOString().slice(0, 10),
  fromTime: "07:00",
  toTime: "09:00",
  specialDish: "",
  active: true,
});

function AdminAnnouncements() {
  const announcements = useStore((state) => state.announcements) as AdminAnnouncement[];
  const menu = useStore((state) => state.menuItems ?? []);

  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<AnnouncementForm>(createDefaultForm);
  const [errors, setErrors] = useState<AnnouncementErrors>({});

  const availableDishes = useMemo(
    () =>
      [...new Set(menu.filter((item) => item.available).map((item) => item.name))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [menu],
  );

  const filteredAnnouncements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...announcements]
      .filter((announcement) => {
        const matchesQuery =
          !normalizedQuery ||
          announcement.title.toLowerCase().includes(normalizedQuery) ||
          announcement.message.toLowerCase().includes(normalizedQuery) ||
          announcement.date.includes(normalizedQuery) ||
          announcement.fromTime.includes(normalizedQuery) ||
          announcement.toTime.includes(normalizedQuery) ||
          (announcement.specialDish ?? "").toLowerCase().includes(normalizedQuery);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" ? announcement.active : !announcement.active);

        return matchesQuery && matchesStatus;
      })
      .sort((first, second) => {
        const dateCompare = second.date.localeCompare(first.date);
        if (dateCompare !== 0) return dateCompare;
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      });
  }, [announcements, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / PAGE_SIZE));
  const pagedAnnouncements = filteredAnnouncements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreateDialog = () => {
    setEditing(null);
    setErrors({});
    setForm(createDefaultForm());
    setIsDialogOpen(true);
  };

  const openEditDialog = (announcement: AdminAnnouncement) => {
    setEditing(announcement);
    setErrors({});
    setForm({
      title: announcement.title,
      message: announcement.message,
      date: announcement.date,
      fromTime: announcement.fromTime,
      toTime: announcement.toTime,
      specialDish: announcement.specialDish ?? "",
      active: announcement.active,
    });
    setIsDialogOpen(true);
  };

  const handleDialogChange = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setErrors({});
      setEditing(null);
      setForm(createDefaultForm());
    }
  };

  const updateFormField = <K extends keyof AnnouncementForm>(
    field: K,
    value: AnnouncementForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateForm = (values: AnnouncementForm) => {
    const nextErrors: AnnouncementErrors = {};
    const trimmedTitle = values.title.trim();
    const trimmedMessage = values.message.trim();

    if (!trimmedTitle) nextErrors.title = "Title is required.";
    else if (trimmedTitle.length < 3) nextErrors.title = "Title must be at least 3 characters.";
    else if (trimmedTitle.length > 80) nextErrors.title = "Title should stay under 80 characters.";

    if (!trimmedMessage) nextErrors.message = "Message is required.";
    else if (trimmedMessage.length < 10)
      nextErrors.message = "Message must be at least 10 characters.";
    else if (trimmedMessage.length > 280)
      nextErrors.message = "Message should stay under 280 characters.";

    if (!values.date) nextErrors.date = "Date is required.";
    if (!values.fromTime) nextErrors.fromTime = "From time is required.";
    if (!values.toTime) nextErrors.toTime = "To time is required.";

    return nextErrors;
  };

  const handleSave = () => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the highlighted announcement fields.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      date: form.date,
      fromTime: form.fromTime,
      toTime: form.toTime,
      specialDish: form.specialDish,
      active: form.active,
      priority: "normal" as const,
    };

    if (editing) {
      updateAnnouncement(editing.id, payload);
      toast.success("Announcement updated successfully.");
    } else {
      createAnnouncement(payload);
      toast.success("Announcement created successfully.");
    }

    handleDialogChange(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this announcement?")) return;

    deleteAnnouncement(id);
    if (editing?.id === id) {
      handleDialogChange(false);
    }
    toast.success("Announcement deleted.");
  };

  return (
    <AdminLayout crumb="Announcement">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Manage announcements in one place with quick filters, table actions, and a focused popup
            form.
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-gradient-to-r from-amber-100 via-white to-orange-100 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#4f3222] dark:from-[#2b1b13] dark:via-[#1d1511] dark:to-[#332116] dark:text-[#fff1df]"
        >
          <Plus className="h-4 w-4" />
          New Announcement
        </button>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <AnnouncementStat
          label="Total announcements"
          value={String(announcements.length)}
          hint="All records"
          icon={Bell}
          accent="text-orange-500"
        />
        <AnnouncementStat
          label="Active now"
          value={String(announcements.filter((announcement) => announcement.active).length)}
          hint="Visible to employees"
          icon={Sparkles}
          accent="text-emerald-500"
        />
        <AnnouncementStat
          label="Special dishes"
          value={String(announcements.filter((announcement) => announcement.specialDish).length)}
          hint="Announcements with dish"
          icon={CalendarDays}
          accent="text-sky-500"
        />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <DataTableToolbar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search title, message, date, slot, or special dish..."
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          activeOption={statusFilter}
          onOptionChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
        />
      </div>

      <TablePanel
        title="Announcement Table"
        description={`${filteredAnnouncements.length} announcements matched your current filters`}
        summary={
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
            {announcements.filter((announcement) => announcement.active).length} active
          </Badge>
        }
        // actions={
        //   <button
        //     onClick={openCreateDialog}
        //     className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        //   >
        //     <Plus className="h-4 w-4" />
        //     Add New
        //   </button>
        // }
      >
        {filteredAnnouncements.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div className="text-base font-semibold">No announcements found</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Try changing the filters or create a fresh announcement from the button above.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead>Special Dish</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedAnnouncements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{announcement.title}</div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAnnouncementDate(announcement.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {announcement.fromTime} — {announcement.toTime}
                      </Badge>
                    </TableCell>
                    <TableCell>{announcement.specialDish || "None"}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "rounded-full border-0 px-3 py-1 shadow-none",
                          announcement.active
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                        )}
                      >
                        {announcement.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {announcement.message}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditDialog(announcement)}
                          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredAnnouncements.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </TablePanel>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          disableAnimation
          className="max-w-2xl overflow-hidden rounded-[22px] border border-[#eadfce] bg-white p-0 shadow-[0_22px_60px_-26px_rgba(38,24,12,0.35)] dark:border-[#4d3122] dark:bg-[#17110d]"
        >
          <div className="bg-white dark:bg-[#17110d]">
            <div className="border-b border-[#efe3d4] px-5 py-4 dark:border-[#3f2a1f] sm:px-6">
              <DialogHeader className="text-left">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1dd] text-[#d97706] dark:bg-[#382216] dark:text-[#ffb467]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <DialogTitle className="text-[1.7rem] font-bold leading-tight text-slate-900 dark:text-[#fff3e5]">
                  {editing ? "Edit Announcement" : "Create New Announcement"}
                </DialogTitle>
                <DialogDescription className="max-w-xl text-sm leading-5 text-slate-600 dark:text-[#c9af95]">
                  Write a clear update for employees, choose the active time range, and decide
                  whether it should go live right away.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid gap-3.5">
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <Field
                    label="Title"
                    error={errors.title}
                    hint={`${form.title.trim().length}/80 characters`}
                  >
                    <Input
                      value={form.title}
                      onChange={(event) => updateFormField("title", event.target.value)}
                      placeholder="Iftar Celebration"
                      className={inputClassName(errors.title)}
                    />
                  </Field>

                  <Field label="Announcement status" error={errors.active}>
                    <button
                      type="button"
                      onClick={() => updateFormField("active", !form.active)}
                      className={cn(
                        "flex h-9 items-center justify-between rounded-xl border px-4 text-sm font-medium",
                        form.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
                      )}
                    >
                      <span>{form.active ? "Live on dashboards" : "Saved as inactive"}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                          form.active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {form.active ? "Active" : "Inactive"}
                      </span>
                    </button>
                  </Field>
                </div>

                <Field
                  label="Message"
                  error={errors.message}
                  hint={`${form.message.trim().length}/280 characters`}
                >
                  <Textarea
                    value={form.message}
                    onChange={(event) => updateFormField("message", event.target.value)}
                    rows={3}
                    placeholder="Refreshment will be served in the lunch slot with a special dish."
                    className={cn(
                      "resize-none rounded-xl px-4 py-3",
                      inputClassName(errors.message),
                    )}
                  />
                </Field>

                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Date" error={errors.date}>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(event) => updateFormField("date", event.target.value)}
                      className={inputClassName(errors.date)}
                    />
                  </Field>

                  <Field label="From" error={errors.fromTime}>
                    <Input
                      type="time"
                      value={form.fromTime}
                      onChange={(event) => updateFormField("fromTime", event.target.value)}
                      className={inputClassName(errors.fromTime)}
                    />
                  </Field>

                  <Field label="To" error={errors.toTime}>
                    <Input
                      type="time"
                      value={form.toTime}
                      onChange={(event) => updateFormField("toTime", event.target.value)}
                      className={inputClassName(errors.toTime)}
                    />
                  </Field>

                  <Field label="Special dish">
                    <Select
                      value={form.specialDish || "__none__"}
                      onValueChange={(value) =>
                        updateFormField("specialDish", value === "__none__" ? "" : value)
                      }
                    >
                      <SelectTrigger className="h-9 rounded-xl px-4">
                        <SelectValue placeholder="Choose special dish" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {availableDishes.map((dish) => (
                          <SelectItem key={dish} value={dish}>
                            {dish}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="rounded-2xl border border-[#efe3d4] bg-[#fffaf4] p-3.5 dark:border-[#433024] dark:bg-[#221712]">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c26c18]">
                    Preview
                  </div>
                  <div className="rounded-xl border border-[#efe3d4] bg-white p-3.5 dark:border-[#433024] dark:bg-[#18110d]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-slate-900">
                        {form.title.trim() || "Announcement title"}
                      </span>
                      <Badge
                        className={cn(
                          "rounded-full border-0 shadow-none",
                          form.active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {form.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-[#c9af95]">
                      {form.message.trim() || "Your announcement message preview will appear here."}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-[#b7997d]">
                      <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-[#2a1c16]">
                        {form.date ? formatAnnouncementDate(form.date) : "No date"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-[#2a1c16]">
                        {form.fromTime} — {form.toTime}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-[#2a1c16]">
                        {form.specialDish || "No special dish"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-5 gap-3 border-t border-[#efe3d4] pt-4 dark:border-[#3f2a1f] sm:justify-between sm:space-x-0">
                <button
                  type="button"
                  onClick={() => handleDialogChange(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef7f1a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#dd7418]"
                >
                  <Sparkles className="h-4 w-4" />
                  {editing ? "Update Announcement" : "Create Announcement"}
                </button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function AnnouncementStat({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Bell;
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:border-[#37231a] dark:bg-[#16100d]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-2 text-3xl font-bold text-foreground">{value}</div>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={cn("rounded-2xl bg-muted p-3", accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-[#b7997d]">
          {label}
        </span>
        {hint ? <span className="text-xs text-slate-400 dark:text-[#8f755e]">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="mt-2 text-xs font-medium text-red-500">{error}</p> : null}
    </label>
  );
}

function inputClassName(error?: string) {
  return cn(
    "h-10 rounded-xl border-slate-200 px-4 shadow-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-orange-200 dark:border-[#4f3529] dark:bg-[#201511] dark:text-[#fff3e5] dark:placeholder:text-[#9d8268]",
    error ? "border-red-400 ring-1 ring-red-200 focus-visible:ring-red-200" : "",
  );
}

function formatAnnouncementDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
