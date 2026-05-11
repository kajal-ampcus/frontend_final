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
import api from "@/api/client";

export const Route = createFileRoute("/admin-employees")({ component: AdminEmployees });

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
  temporary_password?: string;
};

type EmployeeInput = {
  employeeId: string;
  fullName: string;
  departmentId: number | null;
  designation: string;
  email: string;
  phone: string;
  joiningDate: string;
  gender: string;
  address: string;
};

type Department = {
  id: number;
  name: string;
};

const EMPTY_INPUT: EmployeeInput = {
  employeeId: "",
  fullName: "",
  departmentId: null,
  designation: "",
  email: "",
  phone: "",
  joiningDate: "",
  gender: "",
  address: "",
};

// ── Validation utility functions ────────────────────────────────────────────

/**
 * Validate full name: max 50 characters
 */
function validateFullName(fullName: string): { valid: boolean; error?: string } {
  if (!fullName) {
    return { valid: false, error: "Full name is required" };
  }

  const nameTrimmed = fullName.trim();
  
  if (nameTrimmed.length > 50) {
    return { valid: false, error: `Full name cannot exceed 50 characters (got ${nameTrimmed.length})` };
  }
  
  return { valid: true };
}

/**
 * Validate designation: max 20 characters
 */
function validateDesignation(designation: string): { valid: boolean; error?: string } {
  if (!designation) {
    return { valid: false, error: "Designation is required" };
  }

  const desTrimmed = designation.trim();
  
  if (desTrimmed.length > 50) {
    return { valid: false, error: `Designation cannot exceed 20 characters (got ${desTrimmed.length})` };
  }
  
  return { valid: true };
}

/**
 * Validate phone number: must be exactly 10 digits, no special characters
 */
function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  const phoneTrimmed = phone.trim();
  
  // Check if it contains only digits (no spaces, hyphens, or special chars)
  if (!/^\d+$/.test(phoneTrimmed)) {
    return { valid: false, error: "Phone number must contain only digits (no spaces, hyphens, or special characters)." };
  }
  
  // Check if it's exactly 10 digits
  if (phoneTrimmed.length !== 10) {
    return { valid: false, error: `Phone number must be exactly 10 digits (got ${phoneTrimmed.length})` };
  }
  
  return { valid: true };
}

/**
 * Validate employee ID: max 10 characters
 */
function validateEmployeeId(employeeId: string): { valid: boolean; error?: string } {
  if (!employeeId) {
    return { valid: false, error: "Employee ID is required" };
  }

  const idTrimmed = employeeId.trim();
  
  if (idTrimmed.length > 10) {
    return { valid: false, error: `Employee ID cannot exceed 10 characters (got ${idTrimmed.length})` };
  }
  
  return { valid: true };
}

// ── API utility functions ────────────────────────────────────────────────────

async function fetchDepartments(): Promise<Department[]> {
  try {
    const response = await api.get("/auth/departments/");
    return response.data.results || response.data || [];
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return [];
  }
}

async function fetchEmployees(page: number, search?: string, department?: string) {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: PAGE_SIZE.toString(),
    });

    if (search) params.append("search", search);
    if (department) params.append("department", department);

    const response = await api.get(`/auth/employees/?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    toast.error("Failed to load employees");
    throw error;
  }
}

async function createEmployee(data: EmployeeInput): Promise<Employee> {
  let payload: Record<string, unknown> = {};
  try {
    const [firstName, ...lastNameParts] = data.fullName.split(" ");
    const lastName = lastNameParts.join(" ") || firstName;

    // Handle optional departmentId - only send if it's a valid number > 0
    let departmentIdToSend: number | null = null;
    if (data.departmentId && data.departmentId > 0) {
      departmentIdToSend = data.departmentId;
    }

    // Validate gender - only allow valid choices
    const validGenders = ["Male", "Female", "Other", ""];
    const genderToSend = validGenders.includes(data.gender) ? data.gender : "";

    payload = {
      employee_code: data.employeeId,
      firstName: firstName,
      lastName: lastName,
      departmentId: departmentIdToSend,  // ✓ Only send if valid (null otherwise)
      designation: data.designation,
      email: data.email,
      phone: data.phone,
      joiningDate: data.joiningDate,
      gender: genderToSend,  // ✓ Validated against model choices
      address: data.address || "",
    };

    const response = await api.post("/auth/employees/", payload);
    return response.data;
  } catch (error: any) {
    console.error("Employee creation error - Full response:", error.response?.data);
    console.error("Payload sent:", payload);
    
    // Extract detailed error messages
    const errors = error.response?.data || {};
    let errorMsg = "Failed to create employee";
    
    if (errors.detail) {
      errorMsg = errors.detail;
    } else if (Object.keys(errors).length > 0) {
      const fieldLabels: Record<string, string> = {
        employee_code: "Employee Code",
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        phone: "Phone",
        departmentId: "Department",
        gender: "Gender",
      };
      const messages = Object.entries(errors)
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([field, value]) => `${fieldLabels[field] || field}: ${(value as string[])[0]}`);

      if (messages.length > 0) {
        errorMsg = messages.join(" | ");
      } else {
        errorMsg = JSON.stringify(errors, null, 2);
      }
    }
    
    toast.error(errorMsg);
    throw error;
  }
}

async function bulkCreateEmployees(employees: EmployeeInput[]): Promise<Employee[]> {
  try {
    const validGenders = ["Male", "Female", "Other", ""];
    
    const payload = {
      employees: employees.map((emp) => {
        const [firstName, ...lastNameParts] = emp.fullName.split(" ");
        const lastName = lastNameParts.join(" ") || firstName;
        
        // Handle optional departmentId - only send if it's a valid number > 0
        let departmentIdToSend: number | null = null;
        if (emp.departmentId && emp.departmentId > 0) {
          departmentIdToSend = emp.departmentId;
        }
        
        // Validate gender
        const genderToSend = validGenders.includes(emp.gender) ? emp.gender : "";
        
        return {
          employee_code: emp.employeeId,
          firstName: firstName,
          lastName: lastName,
          departmentId: departmentIdToSend,
          designation: emp.designation,
          email: emp.email,
          phone: emp.phone,
          joiningDate: emp.joiningDate,
          gender: genderToSend,
          address: emp.address || "",
        };
      }),
    };

    const response = await api.post("/auth/employees/bulk-create/", payload);
    const data = response.data;
    
    // Show detailed feedback
    if (data.count > 0) {
      let message = `✅ Created ${data.count} employee${data.count !== 1 ? 's' : ''}`;
      if (data.failed_count > 0) {
        message += ` | ❌ Failed: ${data.failed_count}`;
      }
      toast.success(message);
    }
    
    if (data.failed && data.failed.length > 0) {
      const failedList = data.failed
        .slice(0, 3)
        .map((f: any) => `Row ${f.row}: ${f.email}`)
        .join(", ");
      const remaining = data.failed.length > 3 ? ` (+${data.failed.length - 3} more)` : "";
      toast.error(`Failed: ${failedList}${remaining}`);
    }
    
    return data.created || [];
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || "Failed to bulk create employees";
    toast.error(errorMsg);
    throw error;
  }
}

function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_INPUT);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      const depts = await fetchDepartments();
      setDepartments(depts);
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);
        const data = await fetchEmployees(page, query, departmentFilter !== "All" ? departmentFilter : "");
        setEmployees(data.results || []);
        setTotalCount(data.count || 0);
      } catch {
        // Error is handled by fetchEmployees
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [page, query, departmentFilter]);

  const departmentOptions = useMemo(() => {
    const depts = new Set(employees.map((emp) => emp.department).filter(Boolean));
    return ["All", ...Array.from(depts)];
  }, [employees]);

  useEffect(() => {
    setPage(1);
  }, [query, departmentFilter]);

  const addEmployee = async (input: EmployeeInput) => {
    if (creatingEmployee) {
      return false;
    }

    const trimmed: EmployeeInput = {
      employeeId: input.employeeId.trim(),
      fullName: input.fullName.trim(),
      departmentId: input.departmentId,
      designation: input.designation.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      joiningDate: input.joiningDate.trim(),
      gender: input.gender.trim(),
      address: input.address.trim(),
    };

    // Validation
    if (
      !trimmed.employeeId ||
      !trimmed.fullName ||
      !trimmed.designation ||
      !trimmed.email ||
      !trimmed.phone ||
      !trimmed.joiningDate
    ) {
      toast.error("Please fill all required employee fields");
      return false;
    }

    // Validate full name (max 50 characters)
    const fullNameValidation = validateFullName(trimmed.fullName);
    if (!fullNameValidation.valid) {
      toast.error(`Full Name: ${fullNameValidation.error}`);
      return false;
    }

    // Validate designation (max 20 characters)
    const designationValidation = validateDesignation(trimmed.designation);
    if (!designationValidation.valid) {
      toast.error(`Designation: ${designationValidation.error}`);
      return false;
    }

    // Validate employee ID (max 10 characters)
    const empIdValidation = validateEmployeeId(trimmed.employeeId);
    if (!empIdValidation.valid) {
      toast.error(`Employee ID: ${empIdValidation.error}`);
      return false;
    }

    // Validate phone number (10 digits, no special chars)
    const phoneValidation = validatePhoneNumber(trimmed.phone);
    if (!phoneValidation.valid) {
      toast.error(`Phone: ${phoneValidation.error}`);
      return false;
    }

    try {
      setCreatingEmployee(true);
      const toastId = toast.loading("Creating employee...", {
        description: `Adding ${trimmed.fullName} to the system`,
      });
      
      const created = await createEmployee(trimmed);
      toast.dismiss(toastId);
      toast.success("Employee created successfully!", {
        description: created.temporary_password
          ? `Temporary password: ${created.temporary_password}`
          : `${trimmed.fullName} has been added to the system`,
      });
      
      const data = await fetchEmployees(1);
      setEmployees(data.results || []);
      setTotalCount(data.count || 0);
      setPage(1);
      return true;
    } catch {
      return false;
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleSubmitSingle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await addEmployee(form);
    if (!success) return;
    setForm(EMPTY_INPUT);
  };

  const handleExport = () => {
    if (employees.length === 0) {
      toast.error("No employee records to export");
      return;
    }
    downloadCSV(
      employees.map((employee) => ({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        department: employee.department,
        designation: employee.designation,
        email: employee.email,
        phone: employee.phone,
        joiningDate: employee.joiningDate,
        gender: employee.gender || "NA",
        address: employee.address,
        createdAt: new Date(employee.createdAt).toLocaleString(),
      })),
      "employees",
    );
    toast.success("Employee CSV exported");
  };

  const downloadTemplateCSV = () => {
    const templateData = [
      {
        employeeId: "E001",
        fullName: "John Doe",
        department: "IT",
        designation: "Senior Developer",
        email: "john.doe@company.com",
        phone: "9876543210",
        joiningDate: "2024-01-15",
        gender: "Male",
        address: "123 Tech Park",
      },
      {
        employeeId: "E002",
        fullName: "Jane Smith",
        department: "HR",
        designation: "HR Manager",
        email: "jane.smith@company.com",
        phone: "9876543211",
        joiningDate: "2024-02-20",
        gender: "Female",
        address: "456 HR Tower",
      },
    ];
    downloadCSV(templateData, "employee_template");
    toast.success("Template CSV downloaded");
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

      // Validate all rows before upload
      const validationResults = parsed.map((row, idx) => {
        const fullNameValidation = validateFullName(row.fullName);
        const designationValidation = validateDesignation(row.designation);
        const empIdValidation = validateEmployeeId(row.employeeId);
        const phoneValidation = validatePhoneNumber(row.phone);
        
        return {
          index: idx + 2, // +2 because row 1 is header and we're 0-indexed
          employeeId: row.employeeId,
          email: row.email,
          fullNameError: fullNameValidation.error,
          designationError: designationValidation.error,
          empIdError: empIdValidation.error,
          phoneError: phoneValidation.error,
          valid: fullNameValidation.valid && designationValidation.valid && empIdValidation.valid && phoneValidation.valid,
        };
      });

      const invalidRows = validationResults.filter((r) => !r.valid);
      const validRows = parsed.filter((_, idx) => validationResults[idx].valid);

      if (invalidRows.length > 0) {
        const errorSummary = invalidRows
          .slice(0, 5)
          .map((r) => {
            const errors = [r.fullNameError, r.designationError, r.empIdError, r.phoneError].filter(Boolean).join("; ");
            return `Row ${r.index} (${r.employeeId}): ${errors}`;
          })
          .join("\n");
        
        const remaining = invalidRows.length > 5 ? `\n+${invalidRows.length - 5} more rows with errors` : "";
        
        toast.error(`Validation failed:\n${errorSummary}${remaining}`, {
          description: `${invalidRows.length} row(s) failed validation. Fix the issues and try again.`,
        });

        if (validRows.length === 0) {
          return;
        }
      }

      const existingIds = new Set(employees.map((emp) => emp.employeeId.toLowerCase()));
      const uniqueRows = validRows.filter((row) => !existingIds.has(row.employeeId.toLowerCase()));
      const duplicateCount = validRows.length - uniqueRows.length;

      if (uniqueRows.length === 0) {
        toast.error("All uploaded employee IDs already exist or failed validation");
        return;
      }

      await bulkCreateEmployees(uniqueRows);
      const data = await fetchEmployees(1);
      setEmployees(data.results || []);
      setTotalCount(data.count || 0);
      setPage(1);

      let successMessage = `${uniqueRows.length} employees uploaded`;
      if (duplicateCount > 0) {
        successMessage += ` (${duplicateCount} duplicates skipped)`;
      }
      if (invalidRows.length > 0) {
        successMessage += ` (${invalidRows.length} validation errors)`;
      }
      toast.success(successMessage);
    } catch {
      toast.error("Failed to parse file. Upload CSV format.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
          <p className="mb-4 text-xs text-muted-foreground">Required: employee id, name, designation, email, phone, joining date.</p>

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmitSingle}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Employee ID*</label>
              <input
                value={form.employeeId}
                onChange={(e) => {
                  // Limit to 10 characters
                  const limited = e.target.value.slice(0, 10);
                  setForm((current) => ({ ...current, employeeId: limited }));
                }}
                maxLength={10}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Max 10 characters"
              />
              {form.employeeId && form.employeeId.length > 10 && (
                <p className="mt-1 text-xs text-red-500">Max 10 characters</p>
              )}
              {form.employeeId && form.employeeId.length <= 10 && (
                <p className="mt-1 text-xs text-green-600">✓ Valid length ({form.employeeId.length}/10)</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Full Name*</label>
              <input
                value={form.fullName}
                onChange={(e) => {
                  // Limit to 50 characters
                  const limited = e.target.value.slice(0, 50);
                  setForm((current) => ({ ...current, fullName: limited }));
                }}
                maxLength={50}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Max 50 characters"
              />
              {form.fullName && (
                <p className={`mt-1 text-xs ${form.fullName.length > 50 ? "text-red-500" : "text-green-600"}`}>
                  {form.fullName.length > 50 ? "❌ Max 50 characters" : `✓ Valid (${form.fullName.length}/50)`}
                </p>
              )}
            </div>
            
            {/* Department Dropdown */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Department (Optional)</label>
              <select
                value={form.departmentId?.toString() || ""}
                onChange={(e) => setForm((current) => ({ ...current, departmentId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Select Department --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Designation*</label>
              <input
                value={form.designation}
                onChange={(e) => {
                  // Limit to 50 characters
                  const limited = e.target.value.slice(0, 50);
                  setForm((current) => ({ ...current, designation: limited }));
                }}
                maxLength={50}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Max 50 characters"
              />
              {form.designation && (
                <p className={`mt-1 text-xs ${form.designation.length > 50 ? "text-red-500" : "text-green-600"}`}>
                  {form.designation.length > 50 ? "❌ Max 50 characters" : `✓ Valid (${form.designation.length}/50)`}
                </p>
              )}
            </div>
            <InputField label="Email*" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} type="email" />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Phone*</label>
              <input
                value={form.phone}
                onChange={(e) => {
                  // Only allow digits (0-9)
                  const onlyDigits = e.target.value.replace(/\D/g, "");
                  // Limit to 10 digits
                  setForm((current) => ({ ...current, phone: onlyDigits.slice(0, 10) }));
                }}
                type="tel"
                maxLength={10}
                inputMode="numeric"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="10 digits only"
              />
              {form.phone && (() => {
                const validation = validatePhoneNumber(form.phone);
                return !validation.valid ? (
                  <p className="mt-1 text-xs text-red-500">{validation.error}</p>
                ) : (
                  <p className="mt-1 text-xs text-green-600">✓ Valid phone ({form.phone.length}/10)</p>
                );
              })()}
            </div>
            <InputField
              label="Joining Date*"
              value={form.joiningDate}
              onChange={(value) => setForm((current) => ({ ...current, joiningDate: value }))}
              type="date"
            />
            
            {/* Gender Dropdown */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Gender (Optional)</label>
              <select
                value={form.gender}
                onChange={(e) => setForm((current) => ({ ...current, gender: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Select Gender --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
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
                disabled={creatingEmployee}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> {creatingEmployee ? "Adding..." : "Add Employee"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Upload className="h-4 w-4 text-info" /> Bulk Upload Employees
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Upload CSV with headers: employeeId, fullName, departmentId, designation, email, phone, joiningDate, gender, address
          </p>

          <div className="mb-3 flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm hover:bg-muted">
              <FileUp className="h-4 w-4 text-primary" />
              <span>{uploading ? "Uploading..." : "Choose CSV file"}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBulkFile} disabled={uploading} />
            </label>

            <button
              type="button"
              onClick={downloadTemplateCSV}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted"
              title="Download CSV template with example format"
            >
              <Download className="h-4 w-4 text-primary" />
              <span>Template</span>
            </button>
          </div>

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
        description={`${employees.length} employee records on this page`}
        summary={
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {loading ? "Loading..." : `${totalCount} total`}
          </span>
        }
      >
        {employees.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {loading ? "Loading employees..." : "No employees found."}
          </div>
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
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-semibold text-primary">{employee.employeeId}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{employee.fullName}</div>
                    <div className="text-xs text-muted-foreground">{employee.gender || "NA"}</div>
                  </TableCell>
                  <TableCell>{employee.department || "NA"}</TableCell>
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
          totalItems={totalCount}
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
  if (rows.length === 0) return [];
  
  const [header, ...body] = rows;
  if (body.length === 0) {
    console.warn("CSV has no data rows");
    return [];
  }

  const normalizedHeader = header.map((cell) => normalizeHeader(cell));
  const getIndex = (key: string) => normalizedHeader.indexOf(normalizeHeader(key));

  // Build index map with fallbacks for different column name variations
  const indexMap = {
    employeeId: getIndex("employeeid"),
    fullName: getIndex("fullname"),
    departmentId: 
      getIndex("departmentid") >= 0 
        ? getIndex("departmentid") 
        : getIndex("department"),
    designation: getIndex("designation"),
    email: getIndex("email"),
    phone: getIndex("phone"),
    joiningDate: getIndex("joiningdate"),
    gender: getIndex("gender"),
    address: getIndex("address"),
  };

  // Check required fields
  const required = [
    { key: "employeeId", index: indexMap.employeeId },
    { key: "fullName", index: indexMap.fullName },
    { key: "designation", index: indexMap.designation },
    { key: "email", index: indexMap.email },
    { key: "phone", index: indexMap.phone },
    { key: "joiningDate", index: indexMap.joiningDate },
  ];

  const missing = required.filter((f) => f.index < 0);
  if (missing.length > 0) {
    console.error("Missing required columns:", missing.map((m) => m.key).join(", "));
    console.error("Found columns:", normalizedHeader);
    return [];
  }

  return body
    .map((row, rowIdx) => {
      try {
        return {
          employeeId: (row[indexMap.employeeId] ?? "").trim(),
          fullName: (row[indexMap.fullName] ?? "").trim(),
          departmentId: 
            indexMap.departmentId >= 0 
              ? parseInt(row[indexMap.departmentId] ?? "0") || null
              : null,
          designation: (row[indexMap.designation] ?? "").trim(),
          email: (row[indexMap.email] ?? "").trim(),
          phone: (row[indexMap.phone] ?? "").trim(),
          joiningDate: (row[indexMap.joiningDate] ?? "").trim(),
          gender: indexMap.gender >= 0 ? (row[indexMap.gender] ?? "").trim() : "",
          address: indexMap.address >= 0 ? (row[indexMap.address] ?? "").trim() : "",
        };
      } catch (err) {
        console.error(`Error parsing row ${rowIdx}:`, err);
        return null;
      }
    })
    .filter(
      (row): row is EmployeeInput =>
        row !== null &&
        !!row.employeeId &&
        !!row.fullName &&
        !!row.designation &&
        !!row.email &&
        !!row.phone &&
        !!row.joiningDate
    );
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
