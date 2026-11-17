import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Building2, MapPin, Pencil, Plus, Tag, Trash2, Users, X } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import FormAlert from "../components/FormAlert";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import type { Department, Designation } from "../types";

const empty = { name: "", code: "", manager: "", location: "Pune", description: "", status: "active" };

type FieldErrors = Record<string, string>;

function validate(form: typeof empty): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Department name is required";
  if (!form.code.trim()) errors.code = "Department code is required";
  else if (!/^[A-Z0-9]{2,8}$/.test(form.code.trim().toUpperCase())) errors.code = "Code should be 2-8 letters or numbers, e.g. ENG";
  return errors;
}

export default function DepartmentsPage() {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState(empty);
  const [formKey, setFormKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [desigTarget, setDesigTarget] = useState<Department | null>(null);
  const [newDesig, setNewDesig] = useState("");
  const [desigSaving, setDesigSaving] = useState(false);
  const [desigError, setDesigError] = useState("");

  async function load() { const d = await api<{ departments: Department[] }>("/departments"); setItems(d.departments); }
  useEffect(() => { load().catch((err) => showError(err instanceof Error ? err.message : "Unable to load departments")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function show(item?: Department) {
    setError(""); setFieldErrors({});
    setEditing(item || null);
    setForm(item ? { name: item.name, code: item.code, manager: item.manager, location: item.location, description: item.description, status: item.status } : empty);
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  function updateField<K extends keyof typeof empty>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setError("Please fix the highlighted fields before saving."); return; }
    setSaving(true);
    try {
      await api(editing ? `/departments/${editing.id}` : "/departments", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...form, code: form.code.toUpperCase() }) });
      setOpen(false);
      showSuccess(editing ? `${form.name} department was updated successfully.` : `${form.name} department was created successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save department. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openDesignations(item: Department) {
    setDesigTarget(item); setNewDesig(""); setDesigError("");
  }

  async function addDesignation(e: FormEvent) {
    e.preventDefault();
    if (!desigTarget) return;
    const title = newDesig.trim();
    if (!title) { setDesigError("Designation title is required"); return; }
    setDesigSaving(true); setDesigError("");
    try {
      const res = await api<{ department: Department }>(`/departments/${desigTarget.id}/designations`, { method: "POST", body: JSON.stringify({ title }) });
      setDesigTarget(res.department);
      setNewDesig("");
      await load();
      showSuccess(`"${title}" was added to ${desigTarget.name}.`);
    } catch (err) {
      setDesigError(err instanceof Error ? err.message : "Unable to add designation.");
    } finally {
      setDesigSaving(false);
    }
  }

  async function toggleDesignationStatus(designation: Designation) {
    if (!desigTarget) return;
    try {
      const res = await api<{ department: Department }>(`/departments/${desigTarget.id}/designations/${designation.id}`, { method: "PATCH", body: JSON.stringify({ status: designation.status === "active" ? "inactive" : "active" }) });
      setDesigTarget(res.department);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to update designation.");
    }
  }

  async function removeDesignation(designation: Designation) {
    if (!desigTarget) return;
    try {
      const res = await api<{ department: Department }>(`/departments/${desigTarget.id}/designations/${designation.id}`, { method: "DELETE" });
      setDesigTarget(res.department);
      await load();
      showSuccess(`"${designation.title}" was removed.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to remove designation.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/departments/${deleteTarget.id}`, { method: "DELETE" });
      showSuccess(`${deleteTarget.name} department was deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to delete department.");
    } finally {
      setDeleting(false);
    }
  }

  return <div>
    <PageHeader title="Departments" description="Maintain business units, managers and employee allocation." action={<button className="btn-primary" onClick={() => show()}><Plus size={18} />Add department</button>} />
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => (
      <article className="card p-5" key={item.id}>
        <div className="flex items-start justify-between">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-brand-rose"><Building2 size={21} /></div>
          <div className="flex gap-1"><button className="icon-btn" onClick={() => show(item)} aria-label="Edit department"><Pencil size={16} /></button><button className="icon-btn text-red-600" onClick={() => setDeleteTarget(item)} aria-label="Delete department"><Trash2 size={16} /></button></div>
        </div>
        <div className="mt-5"><div className="flex items-center gap-2"><h2 className="text-lg font-black">{item.name}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{item.code}</span></div><p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{item.description}</p></div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
          <div><p className="text-xs text-slate-400">Manager</p><p className="mt-1 font-semibold">{item.manager || "Not assigned"}</p></div>
          <div><p className="text-xs text-slate-400">Employees</p><p className="mt-1 flex items-center gap-1 font-semibold"><Users size={15} />{item.employeeCount}</p></div>
          <div className="col-span-2"><p className="text-xs text-slate-400">Location</p><p className="mt-1 flex items-center gap-1 font-semibold"><MapPin size={15} />{item.location || "-"}</p></div>
        </div>
        <button className="btn-secondary mt-4 w-full justify-center" onClick={() => openDesignations(item)}><Tag size={16} />Manage designations{item.designations?.length ? ` (${item.designations.length})` : ""}</button>
      </article>
    ))}</div>
    {!items.length && <div className="card p-12 text-center text-sm text-slate-400">No departments have been added yet.</div>}

    <Modal open={open} title={editing ? "Edit department" : "Add department"} onClose={() => !saving && setOpen(false)}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <FormAlert type="error" message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department name" required error={fieldErrors.name}>
            <input key={`name-${formKey}`} className={`input ${fieldErrors.name ? "input-error" : ""}`} value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. Engineering" />
          </Field>
          <Field label="Code" required error={fieldErrors.code}>
            <input key={`code-${formKey}`} className={`input uppercase ${fieldErrors.code ? "input-error" : ""}`} value={form.code} onChange={(e) => updateField("code", e.target.value.toUpperCase())} maxLength={8} placeholder="e.g. ENG" />
          </Field>
          <Field label="Manager"><input key={`mgr-${formKey}`} className="input" value={form.manager} onChange={(e) => updateField("manager", e.target.value)} placeholder="e.g. Aditya Jadhav" /></Field>
          <Field label="Location"><input key={`loc-${formKey}`} className="input" value={form.location} onChange={(e) => updateField("location", e.target.value)} placeholder="e.g. Pune, Maharashtra" /></Field>
          <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input min-h-24" value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="What does this department handle?" /></div>
          <Field label="Status"><select className="input" value={form.status} onChange={(e) => updateField("status", e.target.value)}><option value="active" className="bg-slate-950 text-white">Active</option><option value="inactive" className="bg-slate-950 text-white">Inactive</option></select></Field>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save department"}</button>
        </div>
      </form>
    </Modal>

    <Modal open={Boolean(desigTarget)} title={`Designations · ${desigTarget?.name ?? ""}`} onClose={() => !desigSaving && setDesigTarget(null)}>
      <div className="space-y-4">
        {desigError && <FormAlert type="error" message={desigError} />}
        <form onSubmit={addDesignation} className="flex gap-2">
          <input className="input flex-1" value={newDesig} onChange={(e) => setNewDesig(e.target.value)} placeholder="e.g. Backend Developer" />
          <button className="btn-primary" disabled={desigSaving}>{desigSaving ? "Adding..." : "Add"}</button>
        </form>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {(desigTarget?.designations ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <div className="flex items-center gap-2"><span className="font-semibold">{d.title}</span>{d.status === "inactive" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Inactive</span>}</div>
              <div className="flex items-center gap-2">
                <button type="button" className="text-xs font-bold text-brand-rose hover:underline" onClick={() => toggleDesignationStatus(d)}>{d.status === "active" ? "Deactivate" : "Activate"}</button>
                <button type="button" className="icon-btn text-red-600" aria-label="Remove designation" onClick={() => removeDesignation(d)}><X size={15} /></button>
              </div>
            </div>
          ))}
          {!(desigTarget?.designations ?? []).length && <p className="py-6 text-center text-sm text-slate-400">No designations added yet — employees in this department can use any title until you add some.</p>}
        </div>
      </div>
    </Modal>

    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title="Delete department?"
      description={`This will remove ${deleteTarget?.name ?? "this department"} from the organisation. Employees already assigned to it will keep their historical records.`}
      confirmLabel="Delete department"
      loading={deleting}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />
  </div>;
}

function Field({ label, children, required = false, error }: { label: string; children: ReactNode; required?: boolean; error?: string }) {
  return <div><label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>{children}{error && <p className="field-error">{error}</p>}</div>;
}
