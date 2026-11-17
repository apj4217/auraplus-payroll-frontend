import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import FormAlert from "../components/FormAlert";
import { api } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    if (!email.trim()) { setError("Enter your email address."); return; }
    setLoading(true);
    try { const data = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setMessage(data.message); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to process password recovery."); }
    finally { setLoading(false); }
  }
  return <section className="grid min-h-screen place-items-center bg-slate-50 p-5 sm:p-10"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-9">
    <p className="text-sm font-bold uppercase tracking-wider text-brand-rose">Password recovery</p><h2 className="mt-2 text-3xl font-black tracking-tight">Forgot password?</h2><p className="mt-2 text-sm text-slate-500">Enter your Aura Plus email. Recovery instructions will be sent through the secure recovery flow for your account.</p>
    {message && <div className="mt-4"><FormAlert type="success" message={message} /></div>}{error && <div className="mt-4"><FormAlert type="error" message={error} /></div>}
    <div className="mt-5"><label className="label">Email address</label><input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" /></div>
    <button className="btn-primary mt-6 w-full py-3" disabled={loading}>{loading ? "Sending..." : "Send recovery instructions"}</button>
    <div className="mt-5 text-center"><Link to="/login" className="text-sm font-semibold text-brand-rose hover:underline">Back to sign in</Link></div>
  </form></section>;
}
