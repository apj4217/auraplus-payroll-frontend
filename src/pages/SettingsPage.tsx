import { useEffect, useState, type FormEvent } from "react";
import { Building2, KeyRound, Moon, Palette, Sun } from "lucide-react";
import FormAlert from "../components/FormAlert";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import type { Company } from "../types";
import { useTheme } from "../context/ThemeContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCompany(form: Company) {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Company name is required";
  if (!form.address.trim()) errors.address = "Address is required";
  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
  if (!form.phone.trim()) errors.phone = "Phone number is required";
  return errors;
}

function validatePassword(form: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  const errors: Record<string, string> = {};
  if (!form.currentPassword) errors.currentPassword = "Enter your current password";
  if (!form.newPassword) errors.newPassword = "Enter a new password";
  else if (form.newPassword.length < 6) errors.newPassword = "New password must be at least 6 characters";
  if (form.newPassword && form.currentPassword && form.newPassword === form.currentPassword) errors.newPassword = "New password must be different from the current password";
  if (form.confirmPassword !== form.newPassword) errors.confirmPassword = "Passwords do not match";
  return errors;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { showSuccess } = useToast();
  const { theme, setTheme } = useTheme();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState<Company>({ name: "", address: "", email: "", phone: "", cin: "" });
  const [companyErrors, setCompanyErrors] = useState<Record<string, string>>({});
  const [companyError, setCompanyError] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    api<{ company: Company }>("/company").then((d) => { setCompany(d.company); setCompanyForm(d.company); }).catch(() => undefined);
  }, []);

  function updateCompanyField(key: keyof Company, value: string) {
    setCompanyForm((current) => ({ ...current, [key]: value }));
    setCompanyErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function submitCompany(e: FormEvent) {
    e.preventDefault();
    setCompanyError("");
    const errors = validateCompany(companyForm);
    setCompanyErrors(errors);
    if (Object.keys(errors).length > 0) { setCompanyError("Please fix the highlighted fields before saving."); return; }
    setSavingCompany(true);
    try {
      const res = await api<{ company: Company }>("/company", { method: "PATCH", body: JSON.stringify(companyForm) });
      setCompany(res.company); setCompanyForm(res.company);
      showSuccess("Company profile was updated. New payslips will use these details.");
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : "Unable to update company profile.");
    } finally {
      setSavingCompany(false);
    }
  }

  function updatePasswordField(key: keyof typeof passwordForm, value: string) {
    setPasswordForm((current) => ({ ...current, [key]: value }));
    setPasswordErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    const errors = validatePassword(passwordForm);
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) { setPasswordError("Please fix the highlighted fields before saving."); return; }
    setSavingPassword(true);
    try {
      await api("/auth/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }) });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showSuccess("Your password was changed successfully.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unable to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return <div>
    <PageHeader title="Settings" description="Manage company profile, appearance and account security." />

    <div className="grid gap-6 lg:grid-cols-2">
      <article className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-brand-rose"><Building2 size={19} /></div>
          <div><h2 className="font-bold">Company profile</h2><p className="text-sm text-slate-500">Shown on every generated payslip.</p></div>
        </div>
        {!company ? <p className="text-sm text-slate-400">Loading...</p> : <form onSubmit={submitCompany} className="space-y-4" noValidate>
          {companyError && <FormAlert type="error" message={companyError} />}
          <div>
            <label className="label">Company name<span className="text-red-500"> *</span></label>
            <input className={`input ${companyErrors.name ? "input-error" : ""}`} value={companyForm.name} onChange={(e) => updateCompanyField("name", e.target.value)} placeholder="e.g. Aura Plus Workforce Solutions Pvt. Ltd." />
            {companyErrors.name && <p className="field-error">{companyErrors.name}</p>}
          </div>
          <div>
            <label className="label">Address<span className="text-red-500"> *</span></label>
            <input className={`input ${companyErrors.address ? "input-error" : ""}`} value={companyForm.address} onChange={(e) => updateCompanyField("address", e.target.value)} placeholder="e.g. Baner Road, Pune, Maharashtra 411045" />
            {companyErrors.address && <p className="field-error">{companyErrors.address}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email<span className="text-red-500"> *</span></label>
              <input className={`input ${companyErrors.email ? "input-error" : ""}`} value={companyForm.email} onChange={(e) => updateCompanyField("email", e.target.value)} placeholder="e.g. payroll@company.com" />
              {companyErrors.email && <p className="field-error">{companyErrors.email}</p>}
            </div>
            <div>
              <label className="label">Phone<span className="text-red-500"> *</span></label>
              <input className={`input ${companyErrors.phone ? "input-error" : ""}`} value={companyForm.phone} onChange={(e) => updateCompanyField("phone", e.target.value)} placeholder="e.g. +91 20 4123 7800" />
              {companyErrors.phone && <p className="field-error">{companyErrors.phone}</p>}
            </div>
          </div>
          <div>
            <label className="label">CIN <span className="font-normal text-slate-400">(optional)</span></label>
            <input className="input" value={companyForm.cin || ""} onChange={(e) => updateCompanyField("cin", e.target.value)} placeholder="e.g. U74999PN2021PTC208001" />
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={savingCompany}>{savingCompany ? "Saving..." : "Save company profile"}</button></div>
        </form>}
      </article>

      <article className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-brand-rose"><KeyRound size={19} /></div>
          <div><h2 className="font-bold">Change password</h2><p className="text-sm text-slate-500">Signed in as {user?.email}</p></div>
        </div>
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          {passwordError && <FormAlert type="error" message={passwordError} />}
          <div>
            <label className="label">Current password<span className="text-red-500"> *</span></label>
            <input className={`input ${passwordErrors.currentPassword ? "input-error" : ""}`} type="password" value={passwordForm.currentPassword} onChange={(e) => updatePasswordField("currentPassword", e.target.value)} placeholder="Enter your current password" />
            {passwordErrors.currentPassword && <p className="field-error">{passwordErrors.currentPassword}</p>}
          </div>
          <div>
            <label className="label">New password<span className="text-red-500"> *</span></label>
            <input className={`input ${passwordErrors.newPassword ? "input-error" : ""}`} type="password" value={passwordForm.newPassword} onChange={(e) => updatePasswordField("newPassword", e.target.value)} placeholder="At least 6 characters" />
            {passwordErrors.newPassword && <p className="field-error">{passwordErrors.newPassword}</p>}
          </div>
          <div>
            <label className="label">Confirm new password<span className="text-red-500"> *</span></label>
            <input className={`input ${passwordErrors.confirmPassword ? "input-error" : ""}`} type="password" value={passwordForm.confirmPassword} onChange={(e) => updatePasswordField("confirmPassword", e.target.value)} placeholder="Re-enter the new password" />
            {passwordErrors.confirmPassword && <p className="field-error">{passwordErrors.confirmPassword}</p>}
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={savingPassword}>{savingPassword ? "Updating..." : "Change password"}</button></div>
        </form>
      </article>

      <article className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-brand-rose"><Palette size={19} /></div>
          <div><h2 className="font-bold">Appearance</h2><p className="text-sm text-slate-500">Choose the colour mode that is comfortable for you.</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setTheme("light")} className={`rounded-2xl border p-4 text-left transition ${theme === "light" ? "border-brand-orange bg-orange-50 ring-2 ring-orange-100" : "border-slate-200 hover:border-brand-orange/50"}`}><Sun className="mb-5 text-brand-orange" size={24} /><p className="font-bold">Light mode</p><p className="mt-1 text-sm text-slate-500">Clean and bright workspace.</p></button>
          <button onClick={() => setTheme("dark")} className={`rounded-2xl border p-4 text-left transition ${theme === "dark" ? "border-brand-purple bg-brand-purple/10 ring-2 ring-brand-purple/20" : "border-slate-200 hover:border-brand-purple/50"}`}><Moon className="mb-5 text-brand-purple" size={24} /><p className="font-bold">Dark mode</p><p className="mt-1 text-sm text-slate-500">Comfortable for low-light work.</p></button>
        </div>
        <p className="mt-4 text-xs text-slate-400">Your preference is saved automatically on this device.</p>
      </article>

    </div>
  </div>;
}
