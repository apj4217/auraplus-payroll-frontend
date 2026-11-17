import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Calendar, Check, Clock3, Filter, History, Pencil, Plus, Trash2, X } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import FormAlert from "../components/FormAlert";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PageHeader from "../components/PageHeader";
import SearchableSelect from "../components/SearchableSelect";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import type { AttendanceRecord, Employee, Leave } from "../types";

function createEmptyAttendance() {
  // Use the browser's local date so the form never starts with an old hardcoded value.
  const now = new Date();
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return { employeeId: "", date: localToday, status: "present", workingHours: 8, overtimeHours: 0, checkIn: "09:30", checkOut: "18:30", remarks: "" };
}
type AttendanceForm = ReturnType<typeof createEmptyAttendance>;
const emptyLeaveEdit = { leaveType: "Casual Leave", startDate: "", endDate: "", reason: "" };

type FieldErrors = Record<string, string>;

function validateAttendance(form: AttendanceForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.employeeId) errors.employeeId = "Please select an employee";
  if (!form.date) errors.date = "Date is required";
  if ((form.status === "present" || form.status === "half-day")) {
    if (!form.checkIn) errors.checkIn = "Check-in time is required for present or half-day status";
    if (!form.checkOut) errors.checkOut = "Check-out time is required for present or half-day status";
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) errors.checkOut = "Check-out must be after check-in";
  }
  if (form.workingHours < 0 || form.workingHours > 24) errors.workingHours = "Working hours must be between 0 and 24";
  if (form.overtimeHours < 0 || form.overtimeHours > 24) errors.overtimeHours = "Overtime hours must be between 0 and 24";
  return errors;
}

function validateLeaveEdit(form: typeof emptyLeaveEdit): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.startDate) errors.startDate = "Start date is required";
  if (!form.endDate) errors.endDate = "End date is required";
  if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = "End date cannot be before start date";
  return errors;
}

export default function AttendancePage() {
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<"attendance" | "leaves">("attendance");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);

  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterMonth, setFilterMonth] = useState(7);
  const [filterYear, setFilterYear] = useState(2026);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState<AttendanceForm>(createEmptyAttendance);
  const [formKey, setFormKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [leaveStatusFilter, setLeaveStatusFilter] = useState<"" | "pending" | "approved" | "rejected">("");

  const [reviewTarget, setReviewTarget] = useState<{ leave: Leave; action: "approve" | "reject" } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewReasonError, setReviewReasonError] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [editLeaveTarget, setEditLeaveTarget] = useState<Leave | null>(null);
  const [editLeaveForm, setEditLeaveForm] = useState(emptyLeaveEdit);
  const [editLeaveErrors, setEditLeaveErrors] = useState<FieldErrors>({});
  const [editLeaveSaving, setEditLeaveSaving] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<Leave | null>(null);
  const [cancelLeaveTarget, setCancelLeaveTarget] = useState<Leave | null>(null);
  const [cancellingLeave, setCancellingLeave] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (filterEmployee) params.set("employeeId", filterEmployee);
    if (filterMonth) params.set("month", String(filterMonth));
    if (filterYear) params.set("year", String(filterYear));
    const [e, a, l] = await Promise.all([
      api<{ employees: Employee[] }>("/employees"),
      api<{ records: AttendanceRecord[] }>(`/attendance?${params.toString()}`),
      api<{ leaves: Leave[] }>("/leaves"),
    ]);
    setEmployees(e.employees); setRecords(a.records); setLeaves(l.leaves);
  }
  useEffect(() => { load().catch((err) => showError(err instanceof Error ? err.message : "Unable to load attendance data")); }, [filterEmployee, filterMonth, filterYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const names = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);
  const codes = useMemo(() => new Map(employees.map((e) => [e.id, e.employeeCode])), [employees]);
  const pendingLeaves = useMemo(() => leaves.filter((l) => l.status === "pending"), [leaves]);
  const filteredLeaves = useMemo(() => (leaveStatusFilter ? leaves.filter((l) => l.status === leaveStatusFilter) : leaves), [leaves, leaveStatusFilter]);
  const leaveRequestCounts = useMemo(() => {
    const counts = new Map<string, number>();
    leaves.filter((leave) => {
      const date = leave.startDate || leave.createdAt || "";
      return Number(date.slice(5, 7)) === filterMonth && Number(date.slice(0, 4)) === filterYear;
    }).forEach((leave) => counts.set(leave.employeeId, (counts.get(leave.employeeId) || 0) + 1));
    return counts;
  }, [leaves, filterMonth, filterYear]);

  function openCreate() {
    setError(""); setFieldErrors({}); setEditing(null); setForm(createEmptyAttendance()); setFormKey((k) => k + 1); setOpen(true);
  }

  function openEdit(record: AttendanceRecord) {
    setError(""); setFieldErrors({}); setEditing(record);
    setForm({ employeeId: record.employeeId, date: record.date, status: record.status, workingHours: record.workingHours, overtimeHours: record.overtimeHours, checkIn: record.checkIn || "", checkOut: record.checkOut || "", remarks: record.remarks || "" });
    setFormKey((k) => k + 1); setOpen(true);
  }

  function updateField<K extends keyof AttendanceForm>(key: K, value: AttendanceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => { const next = { ...current }; delete next[key as string]; return next; });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const errors = validateAttendance(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setError("Please fix the highlighted fields before saving."); return; }
    setSaving(true);
    try {
      if (editing) {
        await api(`/attendance/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
        showSuccess(`Attendance for ${names.get(form.employeeId) || "employee"} on ${form.date} was updated.`);
      } else {
        await api("/attendance", { method: "POST", body: JSON.stringify(form) });
        showSuccess(`Attendance for ${names.get(form.employeeId) || "employee"} on ${form.date} was recorded.`);
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save attendance record. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/attendance/${deleteTarget.id}`, { method: "DELETE" });
      showSuccess(`Attendance record for ${names.get(deleteTarget.employeeId) || "employee"} on ${deleteTarget.date} was deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to delete attendance record.");
    } finally {
      setDeleting(false);
    }
  }

  async function directApprove(leave: Leave) {
    setReviewing(true);
    try {
      await api(`/leaves/${leave.id}/approve`, { method: "PATCH", body: JSON.stringify({ reviewedBy: "Payroll Admin" }) });
      showSuccess(`Leave request from ${names.get(leave.employeeId) || "employee"} was approved.`);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to approve leave request.");
    } finally {
      setReviewing(false);
    }
  }

  function openReject(leave: Leave) {
    setReviewTarget({ leave, action: "reject" }); setReviewReason(""); setReviewReasonError("");
  }

  async function submitReview() {
    if (!reviewTarget) return;
    if (!reviewReason.trim()) { setReviewReasonError("Please enter a reason."); return; }
    setReviewing(true);
    try {
      await api(`/leaves/${reviewTarget.leave.id}/reject`, { method: "PATCH", body: JSON.stringify({ reviewedBy: "Payroll Admin", reason: reviewReason.trim() }) });
      const wasApproved = reviewTarget.leave.status === "approved";
      showSuccess(`Leave request from ${names.get(reviewTarget.leave.employeeId) || "employee"} was ${wasApproved ? "revoked" : "rejected"}.`);
      setReviewTarget(null);
      await load();
    } catch (err) {
      setReviewReasonError(err instanceof Error ? err.message : "Unable to update leave request.");
    } finally {
      setReviewing(false);
    }
  }

  function openEditLeave(leave: Leave) {
    setEditLeaveTarget(leave); setEditLeaveErrors({});
    setEditLeaveForm({ leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate, reason: leave.reason || "" });
  }

  async function submitEditLeave(e: FormEvent) {
    e.preventDefault();
    if (!editLeaveTarget) return;
    const errors = validateLeaveEdit(editLeaveForm);
    setEditLeaveErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setEditLeaveSaving(true);
    try {
      await api(`/leaves/${editLeaveTarget.id}`, { method: "PATCH", body: JSON.stringify(editLeaveForm) });
      showSuccess(`Leave request from ${names.get(editLeaveTarget.employeeId) || "employee"} was updated and resubmitted for approval.`);
      setEditLeaveTarget(null);
      await load();
    } catch (err) {
      setEditLeaveErrors({ form: err instanceof Error ? err.message : "Unable to update leave request." });
    } finally {
      setEditLeaveSaving(false);
    }
  }

  async function confirmCancelLeave() {
    if (!cancelLeaveTarget) return;
    setCancellingLeave(true);
    try {
      await api(`/leaves/${cancelLeaveTarget.id}`, { method: "DELETE" });
      showSuccess(`Leave request from ${names.get(cancelLeaveTarget.employeeId) || "employee"} was cancelled.`);
      setCancelLeaveTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to cancel leave request.");
    } finally {
      setCancellingLeave(false);
    }
  }

  return <div>
    <PageHeader
      title="Attendance & Leave"
      description="Record daily attendance, overtime and review employee leave requests."
      action={tab === "attendance" ? <button className="btn-primary" onClick={openCreate}><Plus size={18} />Mark attendance</button> : undefined}
    />

    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1">
      <button onClick={() => setTab("attendance")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "attendance" ? "bg-orange-50 text-brand-rose" : "text-slate-600 hover:text-brand-rose"}`}>Attendance</button>
      <button onClick={() => setTab("leaves")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "leaves" ? "bg-orange-50 text-brand-rose" : "text-slate-600 hover:text-brand-rose"}`}>
        Leave requests{pendingLeaves.length > 0 && <span className="ml-2 rounded-full bg-brand-rose px-2 py-0.5 text-xs text-white">{pendingLeaves.length}</span>}
      </button>
    </div>

    {tab === "attendance" ? <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-purple/10 bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Filter size={16} />Filters</div>
        <div className="w-56"><SearchableSelect value={filterEmployee} onChange={setFilterEmployee} options={employees.map((e) => ({ value: e.id, label: e.name, sublabel: e.employeeCode }))} placeholder="All employees" allOptionLabel="All employees" /></div>
        <select className="input w-auto" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m} className="bg-slate-950 text-white">{new Date(2026, m - 1, 1).toLocaleString("en-IN", { month: "long" })}</option>)}
        </select>
        <select className="input w-auto" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y} className="bg-slate-950 text-white">{y}</option>)}
        </select>
        {(filterEmployee || filterMonth !== 7 || filterYear !== 2026) && <button className="btn-secondary ml-auto" onClick={() => { setFilterEmployee(""); setFilterMonth(7); setFilterYear(2026); }}>Reset filters</button>}
      </div>

      <div className="table-wrap bg-white">
        <table className="table">
          <thead><tr><th>Employee</th><th>Date</th><th>Status</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Overtime</th><th>Actions</th></tr></thead>
          <tbody>{records.map((r) => <tr key={r.id} className="border-t">
            <td><p className="font-semibold">{names.get(r.employeeId) || r.employeeId}</p><p className="text-xs text-slate-400">{codes.get(r.employeeId)}</p></td>
            <td>{r.date}</td>
            <td><Badge text={r.status} /></td>
            <td>{r.checkIn || "-"}</td>
            <td>{r.checkOut || "-"}</td>
            <td>{r.workingHours}</td>
            <td>{r.overtimeHours}</td>
            <td><div className="flex gap-1">
              <button className="icon-btn" title="Edit record" onClick={() => openEdit(r)}><Pencil size={15} /></button>
              <button className="icon-btn text-red-600" title="Delete record" onClick={() => setDeleteTarget(r)}><Trash2 size={15} /></button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {!records.length && <div className="p-12 text-center text-sm text-slate-400">No attendance records for the selected filters.</div>}
      </div>
    </> : <>
      {pendingLeaves.length > 0 && <div className="mb-6">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-rose"><Clock3 size={16} />Awaiting your review</h3>
        <div className="grid gap-4 md:grid-cols-2">{pendingLeaves.map((l) => <article className="card p-5" key={l.id}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-bold">{names.get(l.employeeId) || l.employeeId}</p><p className="text-xs text-slate-400">{codes.get(l.employeeId)}</p></div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{l.leaveType}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Calendar size={15} />{l.startDate} to {l.endDate} · {l.totalDays} day{l.totalDays > 1 ? "s" : ""}</div>
          {l.reason && <p className="mt-2 text-sm text-slate-500">{l.reason}</p>}
          <div className="mt-4 flex gap-2">
            <button disabled={reviewing} onClick={() => directApprove(l)} className="btn-primary flex-1 py-2"><Check size={16} />Approve</button>
            <button disabled={reviewing} onClick={() => openReject(l)} className="btn-danger flex-1 py-2"><X size={16} />Reject</button>
          </div>
        </article>)}</div>
      </div>}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">All leave requests</h3>
        <select className="input w-auto" value={leaveStatusFilter} onChange={(e) => setLeaveStatusFilter(e.target.value as typeof leaveStatusFilter)}>
          <option value="" className="bg-slate-950 text-white">All statuses</option>
          <option value="pending" className="bg-slate-950 text-white">Pending</option>
          <option value="approved" className="bg-slate-950 text-white">Approved</option>
          <option value="rejected" className="bg-slate-950 text-white">Rejected</option>
        </select>
      </div>
      <div className="table-wrap bg-white">
        <table className="table">
          <thead><tr><th>Employee</th><th>Leave type</th><th>Period</th><th>Days</th><th>Requests this month</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filteredLeaves.map((l) => <tr key={l.id} className="border-t">
            <td className="font-semibold">{names.get(l.employeeId) || l.employeeId}</td>
            <td>{l.leaveType}</td>
            <td>{l.startDate} to {l.endDate}</td>
            <td>{l.totalDays}</td>
            <td><span className="rounded-full bg-brand-purple/10 px-2.5 py-1 text-xs font-bold text-brand-purple">{leaveRequestCounts.get(l.employeeId) || 0}</span></td>
            <td className="max-w-64 whitespace-normal">{l.reason || "-"}{l.status === "rejected" && l.rejectionReason && <p className="mt-1 text-xs text-red-500">Reason: {l.rejectionReason}</p>}</td>
            <td><Badge text={l.status} /></td>
            <td><div className="flex gap-1">
              <button className="icon-btn" title="View history" onClick={() => setHistoryTarget(l)}><History size={15} /></button>
              {l.status === "pending" && <button className="icon-btn text-red-600" title="Cancel request" onClick={() => setCancelLeaveTarget(l)}><Trash2 size={15} /></button>}
              {l.status === "approved" && <button className="icon-btn text-red-600" title="Revoke approval" onClick={() => openReject(l)}><X size={15} /></button>}
              {l.status === "rejected" && <button className="icon-btn text-blue-700" title="Edit and resubmit" onClick={() => openEditLeave(l)}><Pencil size={15} /></button>}
            </div></td>
          </tr>)}</tbody>
        </table>
        {!filteredLeaves.length && <div className="p-12 text-center text-sm text-slate-400">No leave requests {leaveStatusFilter ? `with status "${leaveStatusFilter}"` : "yet"}. Requests submitted by employees will appear here for approval.</div>}
      </div>
    </>}

    <Modal open={open} title={editing ? "Edit attendance record" : "Mark attendance"} onClose={() => !saving && setOpen(false)}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <FormAlert type="error" message={error} />}
        <SearchableSelect label="Employee" value={form.employeeId} onChange={(v) => updateField("employeeId", v)} options={employees.map((e) => ({ value: e.id, label: e.name, sublabel: e.employeeCode }))} placeholder="Select employee" required error={fieldErrors.employeeId} disabled={Boolean(editing)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Date<span className="text-red-500"> *</span></label>
            <input className={`input ${fieldErrors.date ? "input-error" : ""}`} type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} />
            {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => updateField("status", e.target.value)}>
              <option value="present" className="bg-slate-950 text-white">Present</option>
              <option value="absent" className="bg-slate-950 text-white">Absent</option>
              <option value="half-day" className="bg-slate-950 text-white">Half day</option>
              <option value="leave" className="bg-slate-950 text-white">On leave</option>
            </select>
          </div>
          <div>
            <label className="label">Check in{(form.status === "present" || form.status === "half-day") && <span className="text-red-500"> *</span>}</label>
            <input className={`input ${fieldErrors.checkIn ? "input-error" : ""}`} type="time" value={form.checkIn} onChange={(e) => updateField("checkIn", e.target.value)} />
            {fieldErrors.checkIn && <p className="field-error">{fieldErrors.checkIn}</p>}
          </div>
          <div>
            <label className="label">Check out{(form.status === "present" || form.status === "half-day") && <span className="text-red-500"> *</span>}</label>
            <input className={`input ${fieldErrors.checkOut ? "input-error" : ""}`} type="time" value={form.checkOut} onChange={(e) => updateField("checkOut", e.target.value)} />
            {fieldErrors.checkOut && <p className="field-error">{fieldErrors.checkOut}</p>}
          </div>
          <NumberField key={`wh-${formKey}`} label="Working hours" value={form.workingHours} min={0} max={24} step={0.5} placeholder="e.g. 8" error={fieldErrors.workingHours} onChange={(v) => updateField("workingHours", v)} />
          <NumberField key={`oh-${formKey}`} label="Overtime hours" value={form.overtimeHours} min={0} max={24} step={0.5} placeholder="e.g. 0" error={fieldErrors.overtimeHours} onChange={(v) => updateField("overtimeHours", v)} />
          <div className="sm:col-span-2">
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} placeholder="Optional note, e.g. Worked from client site" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save attendance"}</button>
        </div>
      </form>
    </Modal>

    <Modal open={Boolean(reviewTarget)} title={reviewTarget?.leave.status === "approved" ? "Revoke approved leave" : "Reject leave request"} onClose={() => !reviewing && setReviewTarget(null)}>
      {reviewTarget && <div className="space-y-4">
        {reviewReasonError && <FormAlert type="error" message={reviewReasonError} />}
        <p className="text-sm text-slate-600">
          {reviewTarget.leave.status === "approved" ? "This leave was already approved. Revoking it will move it back to rejected." : "This will reject the pending leave request."} — <span className="font-semibold text-slate-900">{names.get(reviewTarget.leave.employeeId)}</span>, {reviewTarget.leave.startDate} to {reviewTarget.leave.endDate}
        </p>
        <div>
          <label className="label">Reason<span className="text-red-500"> *</span></label>
          <input className={`input ${reviewReasonError ? "input-error" : ""}`} value={reviewReason} onChange={(e) => { setReviewReason(e.target.value); setReviewReasonError(""); }} placeholder="e.g. Insufficient leave balance" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setReviewTarget(null)} disabled={reviewing}>Cancel</button>
          <button type="button" className="btn-danger" onClick={submitReview} disabled={reviewing}>{reviewing ? "Saving..." : reviewTarget.leave.status === "approved" ? "Revoke leave" : "Reject leave"}</button>
        </div>
      </div>}
    </Modal>

    <Modal open={Boolean(editLeaveTarget)} title="Edit and resubmit leave request" onClose={() => !editLeaveSaving && setEditLeaveTarget(null)}>
      {editLeaveTarget && <form onSubmit={submitEditLeave} className="space-y-4" noValidate>
        {editLeaveErrors.form && <FormAlert type="error" message={editLeaveErrors.form} />}
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">Previously rejected: {editLeaveTarget.rejectionReason || "No reason given."}</div>
        <div>
          <label className="label">Leave type</label>
          <select className="input" value={editLeaveForm.leaveType} onChange={(e) => setEditLeaveForm({ ...editLeaveForm, leaveType: e.target.value })}>
            <option className="bg-slate-950 text-white">Casual Leave</option><option className="bg-slate-950 text-white">Sick Leave</option><option className="bg-slate-950 text-white">Earned Leave</option><option className="bg-slate-950 text-white">Unpaid Leave</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Start date<span className="text-red-500"> *</span></label>
            <input className={`input ${editLeaveErrors.startDate ? "input-error" : ""}`} type="date" value={editLeaveForm.startDate} onChange={(e) => { setEditLeaveForm({ ...editLeaveForm, startDate: e.target.value }); setEditLeaveErrors((c) => ({ ...c, startDate: "" })); }} />
            {editLeaveErrors.startDate && <p className="field-error">{editLeaveErrors.startDate}</p>}
          </div>
          <div>
            <label className="label">End date<span className="text-red-500"> *</span></label>
            <input className={`input ${editLeaveErrors.endDate ? "input-error" : ""}`} type="date" value={editLeaveForm.endDate} onChange={(e) => { setEditLeaveForm({ ...editLeaveForm, endDate: e.target.value }); setEditLeaveErrors((c) => ({ ...c, endDate: "" })); }} />
            {editLeaveErrors.endDate && <p className="field-error">{editLeaveErrors.endDate}</p>}
          </div>
        </div>
        <div>
          <label className="label">Reason</label>
          <input className="input" value={editLeaveForm.reason} onChange={(e) => setEditLeaveForm({ ...editLeaveForm, reason: e.target.value })} placeholder="e.g. Family function" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setEditLeaveTarget(null)} disabled={editLeaveSaving}>Cancel</button>
          <button className="btn-primary" disabled={editLeaveSaving}>{editLeaveSaving ? "Submitting..." : "Resubmit for approval"}</button>
        </div>
      </form>}
    </Modal>

    <Modal open={Boolean(historyTarget)} title="Leave request history" onClose={() => setHistoryTarget(null)}>
      {historyTarget && <div>
        <div className="mb-4 rounded-xl bg-orange-50/60 p-4"><p className="font-bold">{names.get(historyTarget.employeeId)}</p><p className="mt-1 text-sm text-slate-500">{historyTarget.leaveType} · {historyTarget.startDate} to {historyTarget.endDate} · {historyTarget.totalDays} day{historyTarget.totalDays > 1 ? "s" : ""}</p></div>
        <div className="space-y-3">
          {(historyTarget.history || []).map((h, index) => <div key={index} className="flex gap-3 border-l-2 border-slate-200 pl-4">
            <div className="flex-1">
              <div className="flex items-center gap-2"><Badge text={h.status} /><span className="text-xs text-slate-400">{new Date(h.at).toLocaleString("en-IN")}</span></div>
              <p className="mt-1 text-sm text-slate-600">{h.note}{h.by ? ` — by ${h.by}` : ""}</p>
            </div>
          </div>)}
          {!historyTarget.history?.length && <p className="text-sm text-slate-400">No history available for this request.</p>}
        </div>
      </div>}
    </Modal>

    <ConfirmDialog
      open={Boolean(cancelLeaveTarget)}
      title="Cancel leave request?"
      description={`This will permanently cancel the pending leave request for ${cancelLeaveTarget ? names.get(cancelLeaveTarget.employeeId) || "this employee" : ""}.`}
      confirmLabel="Cancel request"
      loading={cancellingLeave}
      onCancel={() => setCancelLeaveTarget(null)}
      onConfirm={confirmCancelLeave}
    />

    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title="Delete attendance record?"
      description={`This will permanently remove the attendance record for ${deleteTarget ? names.get(deleteTarget.employeeId) || "this employee" : ""} on ${deleteTarget?.date ?? ""}. This action cannot be undone.`}
      confirmLabel="Delete record"
      loading={deleting}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />
  </div>;
}

function Badge({ text }: { text: string }) {
  const cls = ["approved", "present"].includes(text) ? "bg-emerald-50 text-emerald-700" : ["rejected", "absent"].includes(text) ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${cls}`}>{text}</span>;
}
