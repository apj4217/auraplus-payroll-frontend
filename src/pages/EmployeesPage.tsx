import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import FormAlert from "../components/FormAlert";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PageHeader from "../components/PageHeader";
import SearchableSelect from "../components/SearchableSelect";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { api, currency } from "../services/api";
import type { Department, Employee } from "../types";

const emptyForm = {
  firstName: "", lastName: "", email: "", phone: "", gender: "", dateOfBirth: "",
  departmentId: "", designation: "", employmentType: "full-time", joiningDate: "", status: "active",
  address: { line1: "", city: "Pune", state: "Maharashtra", postalCode: "" },
  bankDetails: { bankName: "", accountNumber: "", ifscCode: "" },
  statutory: { pan: "", uan: "", pfNumber: "" },
  salaryStructure: {
    basicSalary: 30000, pfPercentage: 12,
    earnings: [{ label: "House Rent Allowance", amount: 12000 }, { label: "Special Allowance", amount: 3000 }],
    deductions: [{ label: "Professional Tax", amount: 200 }],
  },
};

type FieldErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9]{10}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function validate(form: any): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required";
  if (!form.lastName.trim()) errors.lastName = "Last name is required";
  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
  if (form.phone && !PHONE_PATTERN.test(form.phone.trim())) errors.phone = "Phone number must be exactly 10 digits";
  if (!form.departmentId) errors.departmentId = "Please select a department";
  if (!form.designation.trim()) errors.designation = "Designation is required";
  if (!form.joiningDate) errors.joiningDate = "Joining date is required";
  if (!form.salaryStructure.basicSalary || Number(form.salaryStructure.basicSalary) <= 0) errors.basicSalary = "Basic salary must be greater than 0";
  if (form.salaryStructure.earnings.some((item: { label: string }) => !item.label.trim())) errors.earnings = "Every earning row needs a label, or remove the empty row";
  if (form.salaryStructure.deductions.some((item: { label: string }) => !item.label.trim())) errors.deductions = "Every deduction row needs a label, or remove the empty row";
  if (form.statutory.pan && !PAN_PATTERN.test(form.statutory.pan.trim().toUpperCase())) errors.pan = "PAN must look like ABCDE1234F";
  if (form.bankDetails.ifscCode && !IFSC_PATTERN.test(form.bankDetails.ifscCode.trim().toUpperCase())) errors.ifscCode = "IFSC must look like HDFC0001234";
  if (form.bankDetails.accountNumber && !/^[0-9]{6,20}$/.test(form.bankDetails.accountNumber.trim())) errors.accountNumber = "Account number should be 6-20 digits";
  return errors;
}

export default function EmployeesPage() {
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [formKey, setFormKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [temporaryCredentials, setTemporaryCredentials] = useState<{ employeeId: string; email: string; password: string } | null>(null);

  async function load() {
    const [e, d] = await Promise.all([api<{ employees: Employee[] }>("/employees"), api<{ departments: Department[] }>("/departments")]);
    setEmployees(e.employees); setDepartments(d.departments);
  }
  useEffect(() => { load().catch((err) => showError(err instanceof Error ? err.message : "Unable to load employees")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => employees.filter((e) => {
    const text = `${e.name} ${e.email} ${e.employeeCode} ${e.designation} ${e.departmentName}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!departmentId || e.departmentId === departmentId);
  }), [employees, search, departmentId]);

  function show(item?: Employee) {
    setError(""); setFieldErrors({});
    setEditing(item || null);
    const base: any = item ? JSON.parse(JSON.stringify(item)) : JSON.parse(JSON.stringify(emptyForm));
    base.salaryStructure = {
      basicSalary: base.salaryStructure?.basicSalary ?? 0,
      pfPercentage: base.salaryStructure?.pfPercentage ?? 12,
      earnings: Array.isArray(base.salaryStructure?.earnings) ? base.salaryStructure.earnings : [],
      deductions: Array.isArray(base.salaryStructure?.deductions) ? base.salaryStructure.deductions : [],
    };
    base.bankDetails = base.bankDetails || { bankName: "", accountNumber: "", ifscCode: "" };
    base.statutory = { pan: "", uan: "", pfNumber: "", ...(base.statutory || {}) };
    setForm(base);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  function updateSection(section: string, key: string, value: string | number) {
    setForm((current: any) => ({ ...current, [section]: { ...current[section], [key]: value } }));
    setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  function updateField(key: string, value: string) {
    setForm((current: any) => {
      if (key === "departmentId") {
        const dept = departments.find((d) => d.id === value);
        const designations = dept?.designations?.filter((d) => d.status === "active") ?? [];
        const stillValid = designations.some((d) => d.title === current.designation);
        // Only auto-clear when the new department actually has a configured designation list; otherwise keep free text as-is.
        return { ...current, departmentId: value, designation: designations.length && !stillValid ? "" : current.designation };
      }
      return { ...current, [key]: value };
    });
    setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  function addSalaryLine(kind: "earnings" | "deductions") {
    setForm((current: any) => ({ ...current, salaryStructure: { ...current.salaryStructure, [kind]: [...current.salaryStructure[kind], { label: "", amount: 0 }] } }));
  }

  function removeSalaryLine(kind: "earnings" | "deductions", index: number) {
    setForm((current: any) => ({ ...current, salaryStructure: { ...current.salaryStructure, [kind]: current.salaryStructure[kind].filter((_: unknown, i: number) => i !== index) } }));
    setFieldErrors((current) => { const next = { ...current }; delete next[kind]; return next; });
  }

  function updateSalaryLine(kind: "earnings" | "deductions", index: number, field: "label" | "amount", value: string | number) {
    setForm((current: any) => ({
      ...current,
      salaryStructure: {
        ...current.salaryStructure,
        [kind]: current.salaryStructure[kind].map((item: { label: string; amount: number }, i: number) => (i === index ? { ...item, [field]: value } : item)),
      },
    }));
    setFieldErrors((current) => { const next = { ...current }; delete next[kind]; return next; });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ employee: Employee; account?: { email: string; temporaryPassword?: string } }>(
        editing ? `/employees/${editing.id}` : "/employees",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) }
      );
      setOpen(false);
      if (!editing && result.account?.temporaryPassword) {
        setTemporaryCredentials({
          employeeId: result.employee.id,
          email: result.account.email,
          password: result.account.temporaryPassword,
        });
      }
      showSuccess(editing ? `${form.firstName} ${form.lastName}'s details were updated successfully.` : `${form.firstName} ${form.lastName} was added as a new employee.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save employee. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function loadTemporaryCredentials(employee: Employee) {
    try {
      const result = await api<{ account: { email: string; temporaryPassword: string } }>(`/employees/${employee.id}/portal-credentials`);
      setTemporaryCredentials({ employeeId: employee.id, email: result.account.email, password: result.account.temporaryPassword });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Temporary password is no longer available.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/employees/${deleteTarget.id}`, { method: "DELETE" });
      showSuccess(`${deleteTarget.name}'s employee record was deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to delete employee record.");
    } finally {
      setDeleting(false);
    }
  }

  return <div>
    <PageHeader title="Employees" description="Manage personal, employment, banking and salary information." action={<button className="btn-primary" onClick={() => show()}><Plus size={18} />Add employee</button>} />
    <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_240px]">
      <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input className="input pl-10" placeholder="Search by name, code, email or designation" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <SearchableSelect value={departmentId} onChange={setDepartmentId} options={departments.map((d) => ({ value: d.id, label: d.name }))} placeholder="All departments" allOptionLabel="All departments" />
    </div>

    <div className="table-wrap bg-white"><table className="table"><thead><tr><th>Employee</th><th>Department</th><th>Designation</th><th>Employment</th><th>Monthly gross</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{filtered.map((item) => { const s = item.salaryStructure; const gross = s.basicSalary + (s.earnings || []).reduce((sum, i) => sum + Number(i.amount || 0), 0); return (
        <tr key={item.id} className="border-t">
          <td><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-brand-rose"><UserRound size={17} /></div><div><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-400">{item.employeeCode} · {item.email}</p></div></div></td>
          <td>{item.departmentName}</td>
          <td>{item.designation}</td>
          <td className="capitalize">{item.employmentType.replace("-", " ")}</td>
          <td className="font-semibold">{currency(gross)}</td>
          <td><Badge text={item.status} /></td>
          <td><div className="flex gap-1"><button className="icon-btn" title="Edit employee" onClick={() => show(item)}><Pencil size={16} /></button>{user?.role === "admin" && <button className="icon-btn" title="View temporary password" onClick={() => loadTemporaryCredentials(item)}>Key</button>}<button className="icon-btn text-red-600" title="Delete employee" onClick={() => setDeleteTarget(item)}><Trash2 size={16} /></button></div></td>
        </tr>); })}</tbody></table>
      {!filtered.length && <div className="p-12 text-center text-sm text-slate-400">No employee records found.</div>}
    </div>

    <Modal open={open} title={editing ? "Edit employee" : "Add employee"} onClose={() => !saving && setOpen(false)}>
      <form onSubmit={submit} className="space-y-6" noValidate>
        {error && <FormAlert type="error" message={error} />}

        <Section title="Personal details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input key={`fn-${formKey}`} label="First name" value={form.firstName} onChange={(v) => updateField("firstName", v)} required placeholder="e.g. Rohit" error={fieldErrors.firstName} />
            <Input key={`ln-${formKey}`} label="Last name" value={form.lastName} onChange={(v) => updateField("lastName", v)} required placeholder="e.g. Patil" error={fieldErrors.lastName} />
            <Input key={`em-${formKey}`} label="Email" type="email" value={form.email} onChange={(v) => updateField("email", v)} required placeholder="e.g. rohit.patil@company.com" error={fieldErrors.email} />
            <Input key={`ph-${formKey}`} label="Phone" value={form.phone} onChange={(v) => updateField("phone", v)} placeholder="10-digit mobile number" error={fieldErrors.phone} />
            <Select key={`ge-${formKey}`} label="Gender" value={form.gender} onChange={(v) => updateField("gender", v)} options={["", "male", "female", "other"]} />
            <Input key={`dob-${formKey}`} label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => updateField("dateOfBirth", v)} />
          </div>
        </Section>

        <Section title="Employment details">
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchableSelect label="Department" value={form.departmentId} onChange={(v) => updateField("departmentId", v)} options={departments.map((d) => ({ value: d.id, label: d.name }))} placeholder="Select department" required error={fieldErrors.departmentId} />
            {(() => {
              const selectedDept = departments.find((d) => d.id === form.departmentId);
              const activeDesignations = selectedDept?.designations?.filter((d) => d.status === "active") ?? [];
              if (form.departmentId && activeDesignations.length) {
                return <SearchableSelect key={`des-select-${formKey}-${form.departmentId}`} label="Designation" value={form.designation} onChange={(v) => updateField("designation", v)} options={activeDesignations.map((d) => ({ value: d.title, label: d.title }))} placeholder="Select designation" required error={fieldErrors.designation} />;
              }
              return <Input key={`des-${formKey}`} label="Designation" value={form.designation} onChange={(v) => updateField("designation", v)} required placeholder={form.departmentId ? "No designations configured — type freely" : "Select a department first"} error={fieldErrors.designation} />;
            })()}
            <Select key={`et-${formKey}`} label="Employment type" value={form.employmentType} onChange={(v) => updateField("employmentType", v)} options={["full-time", "part-time", "contract", "intern"]} />
            <Input key={`jd-${formKey}`} label="Joining date" type="date" value={form.joiningDate} onChange={(v) => updateField("joiningDate", v)} required error={fieldErrors.joiningDate} />
            <Select key={`st-${formKey}`} label="Status" value={form.status} onChange={(v) => updateField("status", v)} options={["active", "inactive"]} />
          </div>
        </Section>

        <Section title="Salary structure">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField key={`basic-${formKey}`} label="Basic salary" value={form.salaryStructure.basicSalary} onChange={(v) => updateSection("salaryStructure", "basicSalary", v)} required placeholder="e.g. 30000" error={fieldErrors.basicSalary} />
            <NumberField key={`pf-${formKey}`} label="PF percentage" value={form.salaryStructure.pfPercentage} onChange={(v) => updateSection("salaryStructure", "pfPercentage", v)} placeholder="e.g. 12" />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Earnings <span className="font-normal text-slate-400">(HRA, allowances, bonuses...)</span></label>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => addSalaryLine("earnings")}><Plus size={14} />Add earning</button>
            </div>
            <div className="space-y-2">
              {form.salaryStructure.earnings.map((item: { label: string; amount: number }, index: number) => (
                <div className="flex items-center gap-2" key={`earn-${formKey}-${index}`}>
                  <input className="input" placeholder="e.g. House Rent Allowance" value={item.label} onChange={(e) => updateSalaryLine("earnings", index, "label", e.target.value)} />
                  <div className="w-40"><NumberField label="" value={item.amount} placeholder="Amount" onChange={(v) => updateSalaryLine("earnings", index, "amount", v)} /></div>
                  <button type="button" className="icon-btn text-red-600" title="Remove" onClick={() => removeSalaryLine("earnings", index)}><Trash2 size={16} /></button>
                </div>
              ))}
              {!form.salaryStructure.earnings.length && <p className="text-sm text-slate-400">No earning components added yet.</p>}
              {fieldErrors.earnings && <p className="field-error">{fieldErrors.earnings}</p>}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Deductions <span className="font-normal text-slate-400">(tax, loans, other recurring cuts...)</span></label>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => addSalaryLine("deductions")}><Plus size={14} />Add deduction</button>
            </div>
            <div className="space-y-2">
              {form.salaryStructure.deductions.map((item: { label: string; amount: number }, index: number) => (
                <div className="flex items-center gap-2" key={`ded-${formKey}-${index}`}>
                  <input className="input" placeholder="e.g. Professional Tax" value={item.label} onChange={(e) => updateSalaryLine("deductions", index, "label", e.target.value)} />
                  <div className="w-40"><NumberField label="" value={item.amount} placeholder="Amount" onChange={(v) => updateSalaryLine("deductions", index, "amount", v)} /></div>
                  <button type="button" className="icon-btn text-red-600" title="Remove" onClick={() => removeSalaryLine("deductions", index)}><Trash2 size={16} /></button>
                </div>
              ))}
              {!form.salaryStructure.deductions.length && <p className="text-sm text-slate-400">No deduction components added yet.</p>}
              {fieldErrors.deductions && <p className="field-error">{fieldErrors.deductions}</p>}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-orange-50/60 p-3 text-sm text-slate-600">
            Estimated monthly gross: <span className="font-bold text-slate-900">{currency(Number(form.salaryStructure.basicSalary || 0) + form.salaryStructure.earnings.reduce((sum: number, i: { amount: number }) => sum + Number(i.amount || 0), 0))}</span>
            <span className="mx-1">·</span>Provident fund ({form.salaryStructure.pfPercentage || 0}% of basic): <span className="font-bold text-slate-900">{currency(Number(form.salaryStructure.basicSalary || 0) * (Number(form.salaryStructure.pfPercentage || 0) / 100))}</span>
          </div>
        </Section>

        <Section title="Bank and statutory details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input key={`bank-${formKey}`} label="Bank name" value={form.bankDetails.bankName || ""} onChange={(v) => updateSection("bankDetails", "bankName", v)} placeholder="e.g. HDFC Bank" />
            <Input key={`acc-${formKey}`} label="Account number" value={form.bankDetails.accountNumber || ""} onChange={(v) => updateSection("bankDetails", "accountNumber", v)} placeholder="e.g. 50100123456789" error={fieldErrors.accountNumber} />
            <Input key={`ifsc-${formKey}`} label="IFSC code" value={form.bankDetails.ifscCode || ""} onChange={(v) => updateSection("bankDetails", "ifscCode", v.toUpperCase())} placeholder="e.g. HDFC0001234" error={fieldErrors.ifscCode} />
            <Input key={`pan-${formKey}`} label="PAN" value={form.statutory.pan || ""} onChange={(v) => updateSection("statutory", "pan", v.toUpperCase())} placeholder="e.g. ABCDE1234F" error={fieldErrors.pan} />
            <Input key={`uan-${formKey}`} label="UAN" value={form.statutory.uan || ""} onChange={(v) => updateSection("statutory", "uan", v)} placeholder="e.g. 100234567890" />
            <Input key={`pf-${formKey}`} label="PF number" value={form.statutory.pfNumber || ""} onChange={(v) => updateSection("statutory", "pfNumber", v)} placeholder="e.g. MH/PUN/12345/67890" />
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save employee"}</button>
        </div>
      </form>
    </Modal>

    <Modal
      open={Boolean(temporaryCredentials)}
      title="Employee login credentials"
      onClose={() => setTemporaryCredentials(null)}
    >
      {temporaryCredentials && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">This temporary password remains available only to Admin until the employee signs in for the first time.</p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Login username</p>
            <p className="mt-1 font-semibold text-slate-900">{temporaryCredentials.email}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Temporary password</p>
            <div className="mt-1 flex items-center gap-2">
              <input className="input font-mono" readOnly value={temporaryCredentials.password} />
              <button type="button" className="btn-primary whitespace-nowrap" onClick={() => navigator.clipboard.writeText(temporaryCredentials.password).then(() => showSuccess("Temporary password copied."))}>Copy</button>
            </div>
          </div>
          <p className="text-xs text-slate-500">After the employee signs in successfully for the first time, the temporary password is permanently removed.</p>
        </div>
      )}
    </Modal>

    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title="Delete employee record?"
      description={`This will permanently remove ${deleteTarget?.name ?? "this employee"}'s record, including their salary structure. This action cannot be undone.`}
      confirmLabel="Delete employee"
      loading={deleting}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="mb-3 border-b border-slate-100 pb-2 font-bold">{title}</h3>{children}</section>;
}

function Input({ label, value, onChange, type = "text", required = false, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; error?: string }) {
  return <div>
    <label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>
    <input className={`input ${error ? "input-error" : ""}`} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    {error && <p className="field-error">{error}</p>}
  </div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <div>
    <label className="label">{label}</label>
    <select className="input capitalize" value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o || "empty"} value={o} className="bg-slate-950 text-white">{o ? o.replace("-", " ") : "Select"}</option>)}
    </select>
  </div>;
}

function Badge({ text }: { text: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${text === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{text}</span>;
}
