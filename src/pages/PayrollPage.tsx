import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Download, Eye, Filter, Mail, MessageCircle, Plus, Printer, Search, Share2, Trash2, Users, X } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import FormAlert from "../components/FormAlert";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PageHeader from "../components/PageHeader";
import SearchableSelect from "../components/SearchableSelect";
import { useToast } from "../context/ToastContext";
import { api, currency, downloadBlob, downloadFile, fetchFile, monthName } from "../services/api";
import type { Employee, Payroll } from "../types";

type GenerateAllResult = {
  message: string;
  count: number;
  skipped: number;
  failed: { employeeId: string; employeeName: string; message: string }[];
};

const emptyForm = { employeeId: "", month: 7, year: 2026, workingDays: 22, bonus: 0, incomeTax: 0, otherDeduction: 0, overtimeRate: 250, extraEarnings: [] as { label: string; amount: number }[], extraDeductions: [] as { label: string; amount: number }[] };
const emptyBulkForm = { month: 7, year: 2026, workingDays: 22, overtimeRate: 250 };

type FieldErrors = Record<string, string>;

function validate(form: typeof emptyForm, payrolls: Payroll[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.employeeId) errors.employeeId = "Please select an employee";
  if (!form.month || form.month < 1 || form.month > 12) errors.month = "Month must be between 1 and 12";
  if (!form.year || form.year < 2020 || form.year > 2100) errors.year = "Enter a valid year";
  if (!form.workingDays || form.workingDays <= 0 || form.workingDays > 31) errors.workingDays = "Working days must be between 1 and 31";
  if (form.overtimeRate < 0) errors.overtimeRate = "Overtime rate cannot be negative";
  if (form.bonus < 0) errors.bonus = "Bonus cannot be negative";
  if (form.incomeTax < 0) errors.incomeTax = "Income tax cannot be negative";
  if (form.otherDeduction < 0) errors.otherDeduction = "Other deduction cannot be negative";
  if (form.extraEarnings.some((item) => !item.label.trim())) errors.extraEarnings = "Every extra earning row needs a label, or remove the empty row";
  if (form.extraDeductions.some((item) => !item.label.trim())) errors.extraDeductions = "Every extra deduction row needs a label, or remove the empty row";
  if (form.employeeId && !errors.month && !errors.year && payrolls.some((item) => item.employeeId === form.employeeId && item.month === Number(form.month) && item.year === Number(form.year))) {
    errors.employeeId = "Payroll has already been generated for this employee for the selected month. Choose a different employee or period.";
  }
  return errors;
}

export default function PayrollPage() {
  const { showSuccess, showError } = useToast();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Payroll | null>(null);
  const [preview, setPreview] = useState<{ url: string; payroll: Payroll } | null>(null);
  const [emailingId, setEmailingId] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState(emptyForm);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [bulkFormKey, setBulkFormKey] = useState(0);
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<GenerateAllResult | null>(null);

  const [payTarget, setPayTarget] = useState<Payroll | null>(null);
  const [payReference, setPayReference] = useState("");
  const [payReferenceError, setPayReferenceError] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Payroll | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [histSearch, setHistSearch] = useState("");
  const [histEmployeeId, setHistEmployeeId] = useState("");
  const [histMonth, setHistMonth] = useState("");
  const [histYear, setHistYear] = useState("");
  const [histStatus, setHistStatus] = useState("");

  async function load() {
    const [p, e] = await Promise.all([api<{ payrolls: Payroll[] }>("/payroll"), api<{ employees: Employee[] }>("/employees")]);
    setPayrolls(p.payrolls); setEmployees(e.employees);
  }
  useEffect(() => { load().catch((err) => showError(err instanceof Error ? err.message : "Unable to load payroll records")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

  const availableYears = useMemo(() => Array.from(new Set(payrolls.map((p) => p.year))).sort((a, b) => b - a), [payrolls]);

  const filteredPayrolls = useMemo(() => payrolls.filter((p) => {
    const text = `${p.employeeName} ${p.employeeCode} ${p.payslipNumber} ${p.departmentName}`.toLowerCase();
    if (histSearch && !text.includes(histSearch.toLowerCase())) return false;
    if (histEmployeeId && p.employeeId !== histEmployeeId) return false;
    if (histMonth && p.month !== Number(histMonth)) return false;
    if (histYear && p.year !== Number(histYear)) return false;
    if (histStatus && p.paymentStatus !== histStatus) return false;
    return true;
  }), [payrolls, histSearch, histEmployeeId, histMonth, histYear, histStatus]);

  const selectedPeriodPayroll = useMemo(() => payrolls.find((payroll) => payroll.employeeId === form.employeeId && payroll.month === Number(form.month) && payroll.year === Number(form.year)), [payrolls, form.employeeId, form.month, form.year]);

  const hasActiveFilters = Boolean(histSearch || histEmployeeId || histMonth || histYear || histStatus);
  function clearFilters() { setHistSearch(""); setHistEmployeeId(""); setHistMonth(""); setHistYear(""); setHistStatus(""); }

  function openGenerate() {
    setError(""); setFieldErrors({}); setForm(emptyForm); setFormKey((k) => k + 1); setOpen(true);
  }

  function updateField<K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => { const next = { ...current }; delete next[key as string]; return next; });
  }

  function addExtraLine(kind: "extraEarnings" | "extraDeductions") {
    setForm((current) => ({ ...current, [kind]: [...current[kind], { label: "", amount: 0 }] }));
  }

  function removeExtraLine(kind: "extraEarnings" | "extraDeductions", index: number) {
    setForm((current) => ({ ...current, [kind]: current[kind].filter((_, i) => i !== index) }));
    setFieldErrors((current) => { const next = { ...current }; delete next[kind]; return next; });
  }

  function updateExtraLine(kind: "extraEarnings" | "extraDeductions", index: number, field: "label" | "amount", value: string | number) {
    setForm((current) => ({ ...current, [kind]: current[kind].map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
    setFieldErrors((current) => { const next = { ...current }; delete next[kind]; return next; });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const errors = validate(form, payrolls);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setError("Please fix the highlighted fields before generating payroll."); return; }
    setSaving(true);
    try {
      await api("/payroll/generate", { method: "POST", body: JSON.stringify({ ...form, generatedBy: "Payroll Admin" }) });
      setOpen(false);
      const employeeName = employees.find((item) => item.id === form.employeeId)?.name || "Employee";
      showSuccess(`Payroll for ${employeeName} (${monthName(form.month)} ${form.year}) was generated successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate payroll. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openBulk() {
    setBulkError(""); setBulkResult(null); setBulkForm(emptyBulkForm); setBulkFormKey((k) => k + 1); setBulkOpen(true);
  }

  async function submitBulk(e: FormEvent) {
    e.preventDefault();
    setBulkError(""); setBulkResult(null); setBulkLoading(true);
    try {
      const res = await api<GenerateAllResult>("/payroll/generate-all", { method: "POST", body: JSON.stringify({ ...bulkForm, generatedBy: "Payroll Admin" }) });
      setBulkResult(res);
      if (res.count > 0) showSuccess(res.message);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Unable to generate payroll for all employees.");
    } finally {
      setBulkLoading(false);
    }
  }

  function openMarkPaid(payroll: Payroll) {
    setPayTarget(payroll); setPayReference(`UTR${Date.now()}`); setPayReferenceError("");
  }

  async function confirmMarkPaid() {
    if (!payTarget) return;
    if (!payReference.trim()) { setPayReferenceError("Please enter a bank transaction reference or UTR number."); return; }
    setMarkingPaid(true);
    try {
      await api(`/payroll/${payTarget.id}/payment-status`, { method: "PATCH", body: JSON.stringify({ paymentStatus: "paid", paymentReference: payReference.trim() }) });
      showSuccess(`${payTarget.employeeName}'s payroll was marked as paid.`);
      setPayTarget(null);
      await load();
    } catch (err) {
      setPayReferenceError(err instanceof Error ? err.message : "Unable to update payment status.");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/payroll/${deleteTarget.id}`, { method: "DELETE" });
      showSuccess(`Payroll record for ${deleteTarget.employeeName} was deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to delete payroll record.");
    } finally {
      setDeleting(false);
    }
  }

  async function payslip(p: Payroll) {
    try {
      await downloadFile(`/payroll/${p.id}/payslip`, `Payslip-${p.employeeCode}-${p.year}-${p.month}.pdf`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to download payslip.");
    }
  }

  async function previewPayslip(p: Payroll) {
    try {
      const { blob } = await fetchFile(`/payroll/${p.id}/payslip`, `Payslip-${p.employeeCode}-${p.year}-${p.month}.pdf`);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(blob), payroll: p });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to load payslip preview.");
    }
  }

  async function sharePayslip(p: Payroll) {
    try {
      const { blob, name } = await fetchFile(`/payroll/${p.id}/payslip`, `Payslip-${p.employeeCode}-${p.year}-${p.month}.pdf`);
      const file = new File([blob], name, { type: "application/pdf" });
      const shareData = { title: `Payslip - ${p.employeeName}`, text: `Payslip for ${monthName(p.month)} ${p.year}`, files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) await navigator.share(shareData);
      else { downloadBlob(blob, name); showSuccess("Payslip downloaded. You can now attach it to your preferred sharing app."); }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") showError(err.message || "Unable to share payslip.");
    }
  }

  async function shareByWhatsApp(p: Payroll) {
    try {
      const { blob, name } = await fetchFile(`/payroll/${p.id}/payslip`, `Payslip-${p.employeeCode}-${p.year}-${p.month}.pdf`);
      downloadBlob(blob, name);
      const text = `Hello ${p.employeeName}, your payslip for ${monthName(p.month)} ${p.year} is ready. Please find the downloaded PDF attached.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to share payslip on WhatsApp.");
    }
  }

  async function shareByEmail(p: Payroll) {
    if (!p.employeeEmail) { showError("This employee does not have an email address saved. Add it in Employee details first."); return; }
    setEmailingId(p.id);
    try {
      const result = await api<{ message: string }>(`/payroll/${p.id}/email`, { method: "POST" });
      showSuccess(result.message);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to email payslip.");
    } finally {
      setEmailingId("");
    }
  }

  return <div>
    <PageHeader
      title="Payroll & Payslips"
      description="Calculate salary, record payment status and download employee payslips."
      action={<div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={openBulk}><Users size={18} />Generate for all employees</button>
        <button className="btn-primary" onClick={openGenerate}><Plus size={18} />Generate payroll</button>
      </div>}
    />

    <div className="card mb-5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600"><Filter size={16} />Salary history filters</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input pl-9" placeholder="Search employee, code..." value={histSearch} onChange={(e) => setHistSearch(e.target.value)} /></div>
        <select className="input" value={histEmployeeId} onChange={(e) => setHistEmployeeId(e.target.value)}>
          <option value="" className="bg-slate-950 text-white">All employees</option>
          {employees.map((e) => <option key={e.id} value={e.id} className="bg-slate-950 text-white">{e.name}</option>)}
        </select>
        <select className="input" value={histMonth} onChange={(e) => setHistMonth(e.target.value)}>
          <option value="" className="bg-slate-950 text-white">All months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m} className="bg-slate-950 text-white">{monthName(m)}</option>)}
        </select>
        <select className="input" value={histYear} onChange={(e) => setHistYear(e.target.value)}>
          <option value="" className="bg-slate-950 text-white">All years</option>
          {availableYears.map((y) => <option key={y} value={y} className="bg-slate-950 text-white">{y}</option>)}
        </select>
        <select className="input" value={histStatus} onChange={(e) => setHistStatus(e.target.value)}>
          <option value="" className="bg-slate-950 text-white">All statuses</option>
          <option value="pending" className="bg-slate-950 text-white">Pending</option>
          <option value="processed" className="bg-slate-950 text-white">Processed</option>
          <option value="paid" className="bg-slate-950 text-white">Paid</option>
        </select>
      </div>
      {hasActiveFilters && <button className="mt-3 flex items-center gap-1 text-xs font-bold text-brand-rose hover:underline" onClick={clearFilters}><X size={14} />Clear filters</button>}
    </div>

    <div className="table-wrap bg-white">
      <table className="table">
        <thead><tr><th>Employee</th><th>Pay period</th><th>Gross earnings</th><th>Deductions</th><th>Net salary</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{filteredPayrolls.map((p) => <tr key={p.id} className="border-t">
          <td><p className="font-semibold">{p.employeeName}</p><p className="text-xs text-slate-400">{p.employeeCode} · {p.departmentName}</p></td>
          <td><p>{monthName(p.month)} {p.year}</p><p className="text-xs text-slate-400">{p.payslipNumber}</p></td>
          <td>{currency(p.grossSalary)}</td>
          <td className="text-red-600">-{currency(p.totalDeduction)}</td>
          <td className="font-black text-slate-950">{currency(p.netSalary)}</td>
          <td><Badge text={p.paymentStatus} /></td>
          <td><div className="flex gap-1">
            <button className="icon-btn" title="View details" onClick={() => setSelected(p)}><Eye size={16} /></button>
            <button className="icon-btn text-violet-700" title="Print preview" onClick={() => previewPayslip(p)}><Printer size={16} /></button>
            <button className="icon-btn text-blue-700" title="Download PDF payslip" onClick={() => payslip(p)}><Download size={16} /></button>
            {p.paymentStatus !== "paid" && <button className="icon-btn text-emerald-700" title="Mark paid" onClick={() => openMarkPaid(p)}><CheckCircle2 size={16} /></button>}
            {p.paymentStatus !== "paid" && <button className="icon-btn text-red-600" title="Delete pending payroll" onClick={() => setDeleteTarget(p)}><Trash2 size={16} /></button>}
          </div></td>
        </tr>)}</tbody>
      </table>
      {!payrolls.length && <div className="p-12 text-center text-sm text-slate-400">No payroll records available. Generate payroll for an employee to get started.</div>}
      {Boolean(payrolls.length) && !filteredPayrolls.length && <div className="p-12 text-center text-sm text-slate-400">No salary records match the selected filters.</div>}
    </div>

    <Modal open={open} title="Generate employee payroll" onClose={() => !saving && setOpen(false)}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <FormAlert type="error" message={error} />}
        <SearchableSelect
          label="Employee"
          value={form.employeeId}
          onChange={(v) => updateField("employeeId", v)}
          options={activeEmployees.map((e) => ({ value: e.id, label: e.name, sublabel: e.departmentName }))}
          placeholder="Select employee"
          required
          error={fieldErrors.employeeId}
        />
        {selectedPeriodPayroll && <FormAlert type={selectedPeriodPayroll.paymentStatus === "paid" ? "error" : "success"} message={selectedPeriodPayroll.paymentStatus === "paid" ? `Alert: ${selectedPeriodPayroll.employeeName}'s payroll for ${monthName(selectedPeriodPayroll.month)} ${selectedPeriodPayroll.year} is already PAID (UTR: ${selectedPeriodPayroll.paymentReference || "not recorded"}). A new payroll cannot be generated.` : `Payroll for this employee and period already exists with ${selectedPeriodPayroll.paymentStatus.toUpperCase()} status. Choose another month or employee.`} />}
        {!activeEmployees.length && <p className="-mt-2 text-xs text-slate-400">No active employees available. Add an employee first.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField key={`month-${formKey}`} label="Month (1-12)" value={form.month} min={1} max={12} placeholder="e.g. 7" required error={fieldErrors.month} onChange={(v) => updateField("month", v)} />
          <NumberField key={`year-${formKey}`} label="Year" value={form.year} min={2020} max={2100} placeholder="e.g. 2026" required error={fieldErrors.year} onChange={(v) => updateField("year", v)} />
          <NumberField key={`wd-${formKey}`} label="Working days" value={form.workingDays} min={1} max={31} placeholder="e.g. 22" required error={fieldErrors.workingDays} onChange={(v) => updateField("workingDays", v)} />
          <NumberField key={`ot-${formKey}`} label="Overtime rate per hour" value={form.overtimeRate} min={0} placeholder="e.g. 250" error={fieldErrors.overtimeRate} onChange={(v) => updateField("overtimeRate", v)} />
          <NumberField key={`bonus-${formKey}`} label="Bonus" value={form.bonus} min={0} placeholder="e.g. 0" error={fieldErrors.bonus} onChange={(v) => updateField("bonus", v)} />
          <NumberField key={`itax-${formKey}`} label="Income tax" value={form.incomeTax} min={0} placeholder="e.g. 0" error={fieldErrors.incomeTax} onChange={(v) => updateField("incomeTax", v)} />
          <NumberField key={`odeduct-${formKey}`} label="Other deduction" value={form.otherDeduction} min={0} placeholder="e.g. 0" error={fieldErrors.otherDeduction} onChange={(v) => updateField("otherDeduction", v)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Extra earnings this month <span className="font-normal text-slate-400">(one-time, e.g. festival bonus)</span></label>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => addExtraLine("extraEarnings")}><Plus size={14} />Add earning</button>
          </div>
          <div className="space-y-2">
            {form.extraEarnings.map((item, index) => (
              <div className="flex items-center gap-2" key={`xe-${formKey}-${index}`}>
                <input className="input" placeholder="e.g. Diwali Bonus" value={item.label} onChange={(e) => updateExtraLine("extraEarnings", index, "label", e.target.value)} />
                <div className="w-40"><NumberField label="" value={item.amount} placeholder="Amount" onChange={(v) => updateExtraLine("extraEarnings", index, "amount", v)} /></div>
                <button type="button" className="icon-btn text-red-600" title="Remove" onClick={() => removeExtraLine("extraEarnings", index)}><Trash2 size={16} /></button>
              </div>
            ))}
            {fieldErrors.extraEarnings && <p className="field-error">{fieldErrors.extraEarnings}</p>}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Extra deductions this month <span className="font-normal text-slate-400">(one-time, e.g. salary advance)</span></label>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => addExtraLine("extraDeductions")}><Plus size={14} />Add deduction</button>
          </div>
          <div className="space-y-2">
            {form.extraDeductions.map((item, index) => (
              <div className="flex items-center gap-2" key={`xd-${formKey}-${index}`}>
                <input className="input" placeholder="e.g. Salary Advance" value={item.label} onChange={(e) => updateExtraLine("extraDeductions", index, "label", e.target.value)} />
                <div className="w-40"><NumberField label="" value={item.amount} placeholder="Amount" onChange={(v) => updateExtraLine("extraDeductions", index, "amount", v)} /></div>
                <button type="button" className="icon-btn text-red-600" title="Remove" onClick={() => removeExtraLine("extraDeductions", index)}><Trash2 size={16} /></button>
              </div>
            ))}
            {fieldErrors.extraDeductions && <p className="field-error">{fieldErrors.extraDeductions}</p>}
          </div>
        </div>

        <div className="rounded-xl bg-orange-50/60 p-4 text-sm text-slate-600">The employee's salary structure, attendance and approved unpaid leave for the selected month are included automatically.</div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Calculating..." : "Calculate payroll"}</button>
        </div>
      </form>
    </Modal>

    <Modal open={bulkOpen} title="Generate payroll for all employees" onClose={() => !bulkLoading && setBulkOpen(false)}>
      <form onSubmit={submitBulk} className="space-y-4" noValidate>
        {bulkError && <FormAlert type="error" message={bulkError} />}
        {bulkResult && <FormAlert type="success" message={bulkResult.message} />}
        {bulkResult && bulkResult.failed.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <p className="mb-1 font-semibold">Could not generate for:</p>
          <ul className="list-disc pl-4">{bulkResult.failed.map((f) => <li key={f.employeeId}>{f.employeeName}: {f.message}</li>)}</ul>
        </div>}
        <p className="text-sm text-slate-500">Payroll will be calculated for every active employee for the selected period, using each employee's attendance and salary structure. Employees who already have payroll for this period are skipped automatically — nothing will be generated twice.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField key={`bmonth-${bulkFormKey}`} label="Month (1-12)" value={bulkForm.month} min={1} max={12} placeholder="e.g. 7" onChange={(v) => setBulkForm({ ...bulkForm, month: v })} />
          <NumberField key={`byear-${bulkFormKey}`} label="Year" value={bulkForm.year} min={2020} max={2100} placeholder="e.g. 2026" onChange={(v) => setBulkForm({ ...bulkForm, year: v })} />
          <NumberField key={`bwd-${bulkFormKey}`} label="Working days" value={bulkForm.workingDays} min={1} max={31} placeholder="e.g. 22" onChange={(v) => setBulkForm({ ...bulkForm, workingDays: v })} />
          <NumberField key={`bot-${bulkFormKey}`} label="Overtime rate per hour" value={bulkForm.overtimeRate} min={0} placeholder="e.g. 250" onChange={(v) => setBulkForm({ ...bulkForm, overtimeRate: v })} />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" type="button" onClick={() => setBulkOpen(false)}>Close</button>
          <button className="btn-primary" disabled={bulkLoading}>{bulkLoading ? "Generating..." : "Generate for all employees"}</button>
        </div>
      </form>
    </Modal>

    <Modal open={Boolean(payTarget)} title="Mark payroll as paid" onClose={() => !markingPaid && setPayTarget(null)}>
      {payTarget && <div className="space-y-4">
        {payReferenceError && <FormAlert type="error" message={payReferenceError} />}
        <p className="text-sm text-slate-600">Confirm payment for <span className="font-semibold text-slate-900">{payTarget.employeeName}</span> — {monthName(payTarget.month)} {payTarget.year} — <span className="font-semibold">{currency(payTarget.netSalary)}</span></p>
        <div>
          <label className="label">Bank transaction reference / UTR<span className="text-red-500"> *</span></label>
          <input className={`input ${payReferenceError ? "input-error" : ""}`} value={payReference} onChange={(e) => { setPayReference(e.target.value); setPayReferenceError(""); }} placeholder="e.g. UTR2026080600123" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setPayTarget(null)} disabled={markingPaid}>Cancel</button>
          <button type="button" className="btn-primary" onClick={confirmMarkPaid} disabled={markingPaid}>{markingPaid ? "Saving..." : "Confirm payment"}</button>
        </div>
      </div>}
    </Modal>

    <Modal open={Boolean(selected)} title="Payroll details" onClose={() => setSelected(null)}>
      {selected && <div>
        <div className="mb-5 rounded-xl bg-orange-50/60 p-4"><p className="font-black">{selected.employeeName}</p><p className="mt-1 text-sm text-slate-500">{selected.payslipNumber} · {monthName(selected.month)} {selected.year}</p></div>
        <div className="grid gap-5 sm:grid-cols-2"><MoneyList title="Earnings" data={selected.earnings} /><MoneyList title="Deductions" data={selected.deductions} /></div>
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-brand-dark p-4 text-white">
          <div><p className="text-xs text-slate-400">Gross</p><p className="mt-1 font-bold">{currency(selected.grossSalary)}</p></div>
          <div><p className="text-xs text-slate-400">Deductions</p><p className="mt-1 font-bold">{currency(selected.totalDeduction)}</p></div>
          <div><p className="text-xs text-slate-400">Net salary</p><p className="mt-1 font-black text-brand-amber">{currency(selected.netSalary)}</p></div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button className="btn-primary" onClick={() => previewPayslip(selected)}><Printer size={17} />Print preview</button>
          <button className="btn-secondary" onClick={() => payslip(selected)}><Download size={17} />Download PDF</button>
          <button className="btn-secondary" onClick={() => sharePayslip(selected)}><Share2 size={17} />Share payslip</button>
          <button className="btn-secondary" onClick={() => shareByWhatsApp(selected)}><MessageCircle size={17} />WhatsApp</button>
          <button className="btn-secondary sm:col-span-2" disabled={emailingId === selected.id} onClick={() => shareByEmail(selected)}><Mail size={17} />{emailingId === selected.id ? "Sending payslip..." : "Email employee"}</button>
        </div>
      </div>}
    </Modal>

    <Modal open={Boolean(preview)} title={preview ? `Payslip print preview — ${preview.payroll.employeeName}` : "Payslip print preview"} onClose={() => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }}>
      {preview && <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-brand-purple/20 bg-white p-3"><img src="/logo-wordmark.png" alt="Aura Plus logo" className="h-10 w-auto" /><p className="font-bold text-brand-purple">Aura Plus Management Pvt. Ltd.</p></div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><iframe id="payslip-preview" title="Payslip PDF preview" src={preview.url} className="h-[65vh] w-full bg-white" /></div>
        <div className="flex flex-wrap justify-end gap-3">
          <button className="btn-secondary" onClick={() => payslip(preview.payroll)}><Download size={17} />Download</button>
          <button className="btn-primary" onClick={() => { const frame = document.getElementById("payslip-preview") as HTMLIFrameElement | null; frame?.contentWindow?.print(); }}><Printer size={17} />Print</button>
        </div>
      </div>}
    </Modal>

    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title="Delete payroll record?"
      description={`This will permanently remove the payroll record for ${deleteTarget?.employeeName ?? "this employee"} (${deleteTarget ? `${monthName(deleteTarget.month)} ${deleteTarget.year}` : ""}). This action cannot be undone.`}
      confirmLabel="Delete record"
      loading={deleting}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />
  </div>;
}

function Badge({ text }: { text: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${text === "paid" ? "bg-emerald-50 text-emerald-700" : text === "processed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{text}</span>;
}

function MoneyList({ title, data }: { title: string; data: { label: string; amount: number }[] }) {
  const rows = Array.isArray(data) ? data : [];
  return <div><h3 className="mb-2 font-bold">{title}</h3><div className="space-y-2 rounded-xl border border-slate-200 p-3">{rows.length ? rows.map((item, index) => <div className="flex justify-between gap-4 text-sm" key={`${item.label}-${index}`}><span className="text-slate-500">{item.label}</span><span className="font-semibold">{currency(item.amount)}</span></div>) : <p className="text-sm text-slate-400">No data available.</p>}</div></div>;
}
