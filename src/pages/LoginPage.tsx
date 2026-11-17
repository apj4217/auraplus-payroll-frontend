import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import FormAlert from "../components/FormAlert";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login, loading } = useAuth(); const [email, setEmail] = useState("admin@payroll.com"); const [password, setPassword] = useState("Admin@123"); const [error, setError] = useState("");
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter both your email address and password."); return; }
    try { await login(email, password); } catch (err) { setError(err instanceof Error ? err.message : "Login failed. Please check your credentials and try again."); }
  }
  return <div className="grid min-h-screen bg-[#3a2430] lg:grid-cols-[1.05fr_.95fr]">
    <section className="hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#4a2c38] via-[#3a2430] to-[#2d1c26] p-12 text-white lg:flex">
      <div className="inline-flex w-fit items-center rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg shadow-black/20"><img src="/logo-wordmark.png" alt="Aura Plus" className="h-8 w-auto" /></div>
      <div className="max-w-xl"><div className="mb-7 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-purple via-brand-rose to-brand-orange"><Building2 size={30} /></div><h1 className="text-5xl font-black leading-tight">Manage employees, attendance and salary operations from one place.</h1><div className="mt-8 space-y-4 text-slate-300">{["Maintain complete employee and department records","Process monthly salary with attendance-based deductions","Generate professional PDF payslips for every payroll record"].map((item)=><div key={item} className="flex items-center gap-3"><CheckCircle2 className="shrink-0 text-brand-amber" size={20}/><span>{item}</span></div>)}</div></div>
      <p className="text-xs text-slate-500">Aura Plus Workforce Solutions</p>
    </section>
    <section className="grid place-items-center bg-slate-50 p-5 sm:p-10"><form onSubmit={submit} noValidate className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-9"><div className="mb-8"><p className="text-sm font-bold uppercase tracking-wider text-brand-rose">Secure access</p><h2 className="mt-2 text-3xl font-black tracking-tight">Sign in</h2><p className="mt-2 text-sm text-slate-500">Enter your payroll administration credentials.</p></div>{error && <div className="mb-4"><FormAlert type="error" message={error} /></div>}<div className="space-y-4"><div><label className="label">Email address</label><input className="input" value={email} onChange={(e)=>setEmail(e.target.value)} type="email" placeholder="you@company.com" /></div><div><label className="label">Password</label><input className="input" value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="Enter your password" /></div></div><button className="btn-primary mt-6 w-full py-3" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={18}/></>}</button><div className="mt-4 text-center"><Link to="/forgot-password" className="text-sm font-semibold text-brand-rose hover:underline">Forgot password?</Link></div><div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p><b>Demo email:</b> admin@payroll.com</p><p className="mt-1"><b>Password:</b> Admin@123</p></div></form></section>
  </div>;
}
