import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Bell, Building2, CalendarDays, CircleDollarSign, Gauge, LogOut, Menu, Moon, Settings, Sun, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const links = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/attendance", label: "Attendance & Leave", icon: CalendarDays },
  { to: "/payroll", label: "Payroll & Payslips", icon: CircleDollarSign },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const [open, setOpen] = useState(false); const { user, logout } = useAuth(); const { theme, toggleTheme } = useTheme();
  return <div className="app-shell min-h-screen bg-[#faf7f8]">
    {open && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Aura Plus" className="h-10 w-10 rounded-xl shadow-sm" />
          <div><p className="font-black tracking-tight text-slate-900">Aura Plus</p><p className="text-xs text-slate-400">Payroll & Workforce</p></div>
        </div>
        <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
      </div>
      <nav className="flex-1 space-y-1 p-4">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? "bg-orange-50 text-brand-rose shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={19} />{label}</NavLink>)}</nav>
      <div className="border-t border-slate-100 p-4"><div className="mb-3 rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-900">{user?.name}</p><p className="text-xs capitalize text-slate-400">{user?.role}</p></div><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900"><LogOut size={18} />Logout</button></div>
    </aside>
    <div className="lg:pl-72"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-8"><button className="rounded-xl border border-slate-200 p-2.5 lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button><div className="hidden sm:block"><p className="font-bold text-slate-900">Aura Plus Payroll</p><p className="text-xs text-slate-400">Aura Plus Workforce Solutions</p></div><div className="flex items-center gap-3"><button className="icon-btn border border-slate-200 bg-white" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><p className="hidden text-sm font-semibold text-slate-700 sm:block">{user?.name}</p><div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-purple via-brand-rose to-brand-orange text-sm font-bold text-white shadow-sm">{user?.name?.slice(0, 1).toUpperCase()}</div></div></header><main className="p-4 sm:p-8"><Outlet /></main></div>
  </div>;
}
