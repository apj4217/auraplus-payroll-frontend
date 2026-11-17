import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FormAlert from "../components/FormAlert";
import { api } from "../services/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    if (!token) { setError("This reset link is invalid or missing."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters long."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try { const data = await api<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: password }) }); setMessage(data.message); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to reset password."); }
    finally { setLoading(false); }
  }
  return <section className="grid min-h-screen place-items-center bg-slate-50 p-5 sm:p-10"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-9">
    <p className="text-sm font-bold uppercase tracking-wider text-brand-rose">Secure password reset</p><h2 className="mt-2 text-3xl font-black tracking-tight">Create a new password</h2>
    {message && <div className="mt-4"><FormAlert type="success" message={message} /></div>}{error && <div className="mt-4"><FormAlert type="error" message={error} /></div>}
    <div className="mt-5 space-y-4"><div><label className="label">New password</label><input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 6 characters" /></div><div><label className="label">Confirm new password</label><input className="input" type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Re-enter password" /></div></div>
    <button className="btn-primary mt-6 w-full py-3" disabled={loading || Boolean(message)}>{loading ? "Updating..." : "Reset password"}</button>
    <div className="mt-5 text-center"><Link to="/login" className="text-sm font-semibold text-brand-rose hover:underline">Back to sign in</Link></div>
  </form></section>;
}
