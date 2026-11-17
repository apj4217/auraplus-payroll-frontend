import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CalendarClock, Check, CircleDollarSign, Info, Trash2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import type { NotificationItem } from "../types";

function iconFor(type: string) {
  if (type === "payroll") return CircleDollarSign;
  if (type === "leave") return CalendarClock;
  if (type === "reminder") return BellRing;
  return Info;
}

export default function NotificationsPage() {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api<{ notifications: NotificationItem[] }>("/notifications");
      setItems(d.notifications);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = useMemo(() => items.filter((n) => n.status === "unread").length, [items]);

  async function markRead(id: string) {
    setMarkingId(id);
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to update notification");
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    const unread = items.filter((n) => n.status === "unread");
    if (!unread.length) return;
    try {
      await Promise.all(unread.map((n) => api(`/notifications/${n.id}/read`, { method: "PATCH" })));
      showSuccess("All notifications marked as read.");
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to mark all notifications as read.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/notifications/${deleteTarget.id}`, { method: "DELETE" });
      showSuccess("Notification removed.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Unable to delete notification.");
    } finally {
      setDeleting(false);
    }
  }

  return <div>
    <PageHeader
      title="Notifications"
      description="Automatic alerts for payroll processing, leave requests and other workforce activity."
      action={unreadCount > 0 ? <button className="btn-secondary" onClick={markAllRead}><Check size={18} />Mark all as read</button> : undefined}
    />

    {!loading && !items.length && <div className="card p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-brand-rose"><Bell size={26} /></div>
      <p className="font-bold">No notifications yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Notifications appear here automatically — for example, whenever payroll is generated for an employee, or when a leave request needs your attention.</p>
    </div>}

    <div className="space-y-3">{items.map((n) => {
      const Icon = iconFor(n.type);
      return <div className={`card flex gap-4 p-5 ${n.status === "unread" ? "border-l-4 border-l-brand-rose" : ""}`} key={n.id}>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${n.status === "unread" ? "bg-orange-50 text-brand-rose" : "bg-slate-100 text-slate-500"}`}><Icon size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold capitalize">{n.type}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${n.status === "unread" ? "bg-brand-rose/10 text-brand-rose" : "bg-slate-100 text-slate-500"}`}>{n.status}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{n.message}</p>
          <p className="mt-2 text-xs text-slate-400">To {n.recipient} · {new Date(n.createdAt).toLocaleString("en-IN")}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {n.status === "unread" && <button className="icon-btn text-emerald-700" onClick={() => markRead(n.id)} disabled={markingId === n.id} title="Mark as read"><Check size={16} /></button>}
          <button className="icon-btn text-red-600" onClick={() => setDeleteTarget(n)} title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>;
    })}</div>

    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title="Delete notification?"
      description="This notification will be permanently removed."
      confirmLabel="Delete"
      loading={deleting}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />
  </div>;
}
