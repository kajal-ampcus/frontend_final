import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, FileUp, Plus, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "./admin-orders";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV } from "@/lib/store";

export const Route = createFileRoute("/admin-employees")({ component: AdminEmployees });

const STORAGE_KEY = "admin-employees-v1";
const PAGE_SIZE = 10;

type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  joiningDate: string;
  gender: string;
  address: string;
  createdAt: string;
};

type EmployeeInput = Omit<Employee, "id" | "createdAt">;

const EMPTY_INPUT: EmployeeInput = {
  employeeId: "",
  fullName: "",
  department: "",
  designation: "",
  email: "",
  phone: "",
  joiningDate: "",
  gender: "",
  address: "",
};

function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_INPUT);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Employee[];
      if (Array.isArray(parsed)) setEmployees(parsed);
    } catch {
      toast.error("Failed to load employee records");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  }, [employees]);

  const departmentOptions = useMemo(
    () => ["All", ...new Set(employees.map((employee) => employee.department).filter(Boolean))],
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (departmentFilter !== "All") {
      list = list.filter((employee) => employee.department === departmentFilter);
    }

    if (!query.trim()) return list;
    const normalizedQuery = query.toLowerCase();
    return list.filter(
      (employee) =>
        employee.employeeId.toLowerCase().includes(normalizedQuery) ||
        employee.fullName.toLowerCase().includes(normalizedQuery) ||
        employee.department.toLowerCase().includes(normalizedQuery) ||
        employee.designation.toLowerCase().includes(normalizedQuery) ||
        employee.email.toLowerCase().includes(normalizedQuery) ||
        employee.phone.toLowerCase().includes(normalizedQuery),
    );
  }, [departmentFilter, employees, query]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const pagedEmployees = filteredEmployees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, departmentFilter]);

  const addEmployee = (input: EmployeeInput) => {
    const trimmed: EmployeeInput = {
      employeeId: input.employeeId.trim(),
      fullName: input.fullName.trim(),
      department: input.department.trim(),
      designation: input.designation.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      joiningDate: input.joiningDate.trim(),
      gender: input.gender.trim(),
      address: input.address.trim(),
    };

    if (
      !trimmed.employeeId ||
      !trimmed.fullName ||
      !trimmed.department ||
      !trimmed.designation ||
      !trimmed.email ||
      !trimmed.phone ||
      !trimmed.joiningDate
    ) {
      toast.error("Please fill all required employee fields");
      return false;
    }

    const exists = employees.some((employee) => employee.employeeId.toLowerCase() === trimmed.employeeId.toLowerCase());
    if (exists) {
      toast.error(`Employee ID "${trimmed.employeeId}" already exists`);
      return false;
    }

    const entry: Employee = {
      ...trimmed,
      id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setEmployees((current) => [entry, ...current]);
    return true;
  };

  const handleSubmitSingle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = addEmployee(form);
    if (!success) return;
    setForm(EMPTY_INPUT);
    toast.success("Employee added");
  };

  const handleExport = () => {
    if (filteredEmployees.length === 0) {
      toast.error("No employee records to export");
      return;
    }
    downloadCSV(
      filteredEmployees.map((employee) => ({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        department: employee.department,
        designation: employee.designation,
        email: employee.email,
        phone: employee.phone,
        joiningDate: employee.joiningDate,
        gender: employee.gender,
        address: employee.address,
        createdAt: new Date(employee.createdAt).toLocaleString(),
      })),
      "employees",
    );
    toast.success("Employee CSV exported");
  };

  const handleBulkFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (rows.length === 0) {
        toast.error("File is empty");
        return;
      }

      const parsed = mapCsvRowsToEmployees(rows);
      if (parsed.length === 0) {
        toast.error("No valid rows found in file");
        return;
      }

      const existingIds = new Set(employees.map((employee) => employee.employeeId.toLowerCase()));
      const uniqueRows = parsed.filter((row) => !existingIds.has(row.employeeId.toLowerCase()));
      const duplicateCount = parsed.length - uniqueRows.length;

      if (uniqueRows.length === 0) {
        toast.error("All uploaded employee IDs already exist");
        return;
      }

      setEmployees((current) => [
        ...uniqueRows.map((row) => ({
          ...row,
          id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
        })),
        ...current,
      ]);

      if (duplicateCount > 0) {
        toast.success(`${uniqueRows.length} employees uploaded (${duplicateCount} duplicates skipped)`);
      } else {
        toast.success(`${uniqueRows.length} employees uploaded`);
      }
    } catch {
      toast.error("Failed to parse file. Upload CSV format.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <AdminLayout crumb="Employees">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employee Admin</h1>
          <p className="text-xs text-muted-foreground">
            Add employees one-by-one or bulk upload CSV, then manage them in one shared table layout.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Plus className="h-4 w-4 text-primary" /> Add Individual Employee
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">Required: employee id, name, department, designation, email, phone, joining date.</p>

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmitSingle}>
            <InputField label="Employee ID*" value={form.employeeId} onChange={(value) => setForm((current) => ({ ...current, employeeId: value }))} />
            <InputField label="Full Name*" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} />
            <InputField label="Department*" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
            <InputField label="Designation*" value={form.designation} onChange={(value) => setForm((current) => ({ ...current, designation: value }))} />
            <InputField label="Email*" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} type="email" />
            <InputField label="Phone*" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
            <InputField
              label="Joining Date*"
              value={form.joiningDate}
              onChange={(value) => setForm((current) => ({ ...current, joiningDate: value }))}
              type="date"
            />
            <InputField label="Gender" value={form.gender} onChange={(value) => setForm((current) => ({ ...current, gender: value }))} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Address</label>
              <textarea
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Current address"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Add Employee
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Upload className="h-4 w-4 text-info" /> Bulk Upload Employees
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Upload CSV with headers: employeeId, fullName, department, designation, email, phone, joiningDate, gender, address
          </p>

          <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm hover:bg-muted">
            <FileUp className="h-4 w-4 text-primary" />
            <span>{uploading ? "Uploading..." : "Choose CSV file"}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBulkFile} disabled={uploading} />
          </label>

          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Tip: Keep unique <span className="font-semibold text-foreground">employeeId</span> values. Duplicate employee ids are skipped during import.
          </div>
        </section>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <DataTableToolbar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search by employee id, name, department..."
          extraFilters={
            <>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </>
          }
          actions={
            <button
              onClick={handleExport}
              className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          }
        />
      </div>

      <TablePanel
        title="Created Employees"
        description={`${filteredEmployees.length} employee records matched`}
        summary={
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {employees.length} total
          </span>
        }
      >
        {filteredEmployees.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No employees found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-semibold text-primary">{employee.employeeId}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{employee.fullName}</div>
                    <div className="text-xs text-muted-foreground">{employee.gender || "NA"}</div>
                  </TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.designation}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{employee.email}</TableCell>
                  <TableCell>{employee.phone}</TableCell>
                  <TableCell>{employee.joiningDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filteredEmployees.length}
          pageSize={PAGE_SIZE}
        />
      </TablePanel>
    </AdminLayout>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function parseCsvRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

function mapCsvRowsToEmployees(rows: string[][]): EmployeeInput[] {
  const [header, ...body] = rows;
  const normalizedHeader = header.map((cell) => normalizeHeader(cell));
  const getIndex = (key: string) => normalizedHeader.indexOf(normalizeHeader(key));

  const indexMap = {
    employeeId: getIndex("employeeId"),
    fullName: getIndex("fullName"),
    department: getIndex("department"),
    designation: getIndex("designation"),
    email: getIndex("email"),
    phone: getIndex("phone"),
    joiningDate: getIndex("joiningDate"),
    gender: getIndex("gender"),
    address: getIndex("address"),
  };

  const required = [
    indexMap.employeeId,
    indexMap.fullName,
    indexMap.department,
    indexMap.designation,
    indexMap.email,
    indexMap.phone,
    indexMap.joiningDate,
  ];
  if (required.some((index) => index < 0)) return [];

  return body
    .map((row) => ({
      employeeId: row[indexMap.employeeId] ?? "",
      fullName: row[indexMap.fullName] ?? "",
      department: row[indexMap.department] ?? "",
      designation: row[indexMap.designation] ?? "",
      email: row[indexMap.email] ?? "",
      phone: row[indexMap.phone] ?? "",
      joiningDate: row[indexMap.joiningDate] ?? "",
      gender: indexMap.gender >= 0 ? row[indexMap.gender] ?? "" : "",
      address: indexMap.address >= 0 ? row[indexMap.address] ?? "" : "",
    }))
    .filter((row) => row.employeeId && row.fullName && row.department && row.designation && row.email && row.phone && row.joiningDate);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
