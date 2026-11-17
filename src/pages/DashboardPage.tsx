import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, CalendarCheck, CircleDollarSign, Clock3, IndianRupee, TrendingDown, Users, Wallet } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { api, currency, monthName } from "../services/api";
import type { AttendanceRecord, Department, Employee, Payroll } from "../types";

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ employees: Employee[] }>("/employees"),
      api<{ departments: Department[] }>("/departments"),
      api<{ records: AttendanceRecord[] }>("/attendance?month=7&year=2026"),
      api<{ payrolls: Payroll[] }>("/payroll"),
    ]).then(([e, d, a, p]) => {
      setEmployees(e.employees); setDepartments(d.departments); setAttendance(a.records); setPayrolls(p.payrolls);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const latestPeriod = useMemo(() => payrolls.length ? payrolls.reduce((latest, item) => (item.year * 100 + item.month > latest.year * 100 + latest.month ? item : latest), payrolls[0]) : null, [payrolls]);
  const periodPayrolls = latestPeriod ? payrolls.filter((item) => item.month === latestPeriod.month && item.year === latestPeriod.year) : [];
  const netPayroll = periodPayrolls.reduce((sum, item) => sum + item.netSalary, 0);
  const active = employees.filter((item) => item.status === "active").length;
  const presentRecords = attendance.filter((item) => item.status === "present").length;

  const totalPayrollAllTime = useMemo(() => payrolls.reduce((sum, p) => sum + p.netSalary, 0), [payrolls]);
  const pendingPayments = useMemo(() => payrolls.filter((p) => p.paymentStatus !== "paid").length, [payrolls]);
  const averageSalary = useMemo(() => (payrolls.length ? payrolls.reduce((sum, p) => sum + p.netSalary, 0) / payrolls.length : 0), [payrolls]);
  const totalDeductions = useMemo(() => payrolls.reduce((sum, p) => sum + p.totalDeduction, 0), [payrolls]);

  // Last up to 6 distinct pay periods, oldest to newest, for the trend chart.
  const monthlyTrend = useMemo(() => {
    const byPeriod = new Map<string, { period: string; gross: number; net: number; sortKey: number }>();
    payrolls.forEach((p) => {
      const key = `${p.year}-${p.month}`;
      const entry = byPeriod.get(key) || { period: `${monthName(p.month).slice(0, 3)} ${p.year}`, gross: 0, net: 0, sortKey: p.year * 100 + p.month };
      entry.gross += p.grossSalary; entry.net += p.netSalary;
      byPeriod.set(key, entry);
    });
    return Array.from(byPeriod.values()).sort((a, b) => a.sortKey - b.sortKey).slice(-6);
  }, [payrolls]);

  const departmentPayroll = useMemo(() => {
    const byDept = new Map<string, number>();
    payrolls.forEach((p) => { byDept.set(p.departmentName, (byDept.get(p.departmentName) || 0) + p.netSalary); });
    return Array.from(byDept.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [payrolls]);

  const stats = [
    { label: "Active employees", value: String(active), icon: Users, note: `${employees.length} total records`, color: "from-indigo-500 to-indigo-600" },
    { label: "Departments", value: String(departments.length), icon: Building2, note: "Active business units", color: "from-sky-500 to-sky-600" },
    { label: "Attendance entries", value: String(presentRecords), icon: CalendarCheck, note: "Present records in July", color: "from-brand-amber to-brand-orange" },
    { label: "Latest net payroll", value: currency(netPayroll), icon: IndianRupee, note: latestPeriod ? `${monthName(latestPeriod.month)} ${latestPeriod.year}` : "No payroll", color: "from-brand-purple to-brand-rose" },
    { label: "Total payroll (all time)", value: currency(totalPayrollAllTime), icon: Wallet, note: `${payrolls.length} payslips generated`, color: "from-emerald-500 to-emerald-600" },
    { label: "Pending payments", value: String(pendingPayments), icon: Clock3, note: "Not yet marked paid", color: "from-amber-500 to-orange-600" },
    { label: "Average net salary", value: currency(averageSalary), icon: CircleDollarSign, note: "Across all payslips", color: "from-cyan-500 to-blue-600" },
    { label: "Total deductions", value: currency(totalDeductions), icon: TrendingDown, note: "Tax, PF and other cuts", color: "from-rose-500 to-red-600" },
  ];

  return <div>
    <PageHeader title="Dashboard" description="Current workforce, attendance and payroll summary." />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, note, color }) => (
        <div className="card p-5" key={label}>
          <div className="flex items-start justify-between">
            <div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-slate-950">{value}</p></div>
            <div className={`rounded-2xl bg-gradient-to-br ${color} p-3 text-white shadow-md shadow-slate-900/10`}><Icon size={22} /></div>
          </div>
          <p className="mt-4 text-xs text-slate-400">{note}</p>
        </div>
      ))}
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="card p-5">
        <h2 className="font-bold">Monthly payroll trend</h2>
        <p className="mt-1 text-sm text-slate-500">Gross vs net salary across recent pay periods</p>
        <div className="mt-4 h-72">
          {!loading && monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => currency(value)} cursor={{ fill: "#fff7ed" }} contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gross" name="Gross" fill="#ea7317" radius={[6, 6, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="#7f1657" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">{loading ? "Loading chart..." : "No payroll data available yet."}</div>
          )}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-bold">Department-wise payroll</h2>
        <p className="mt-1 text-sm text-slate-500">Total net salary paid, by department</p>
        <div className="mt-4 h-72">
          {!loading && departmentPayroll.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentPayroll} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => currency(value)} cursor={{ fill: "#fff7ed" }} contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9" }} />
                <Bar dataKey="total" name="Net payroll" fill="#c23b53" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">{loading ? "Loading chart..." : "No payroll data available yet."}</div>
          )}
        </div>
      </section>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="font-bold">Recent payroll records</h2><p className="text-sm text-slate-500">Latest salary processing activity</p></div>
          <div className="rounded-xl bg-orange-50 p-2.5 text-brand-rose"><CircleDollarSign size={20} /></div>
        </div>
        <div className="space-y-3">
          {payrolls.slice(0, 5).map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-orange-200 hover:bg-orange-50/30 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{p.employeeName}</p><p className="text-xs text-slate-500">{p.employeeCode} · {monthName(p.month)} {p.year} · {p.departmentName}</p></div>
              <div className="sm:text-right"><p className="font-black">{currency(p.netSalary)}</p><p className={`text-xs font-semibold capitalize ${p.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{p.paymentStatus}</p></div>
            </div>
          ))}
          {!payrolls.length && <p className="py-8 text-center text-sm text-slate-400">No payroll records yet.</p>}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-bold">Department headcount</h2>
        <p className="mt-1 text-sm text-slate-500">Active employees by department</p>
        <div className="mt-5 space-y-4">
          {departments.map((d) => (
            <div key={d.id}>
              <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold">{d.name}</span><span className="text-slate-500">{d.employeeCount}</span></div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-brand-purple via-brand-rose to-brand-orange" style={{ width: `${Math.max(8, (d.employeeCount / Math.max(1, active)) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>;
}
