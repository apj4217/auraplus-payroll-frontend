const configuredApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");
const API_URL = configuredApiUrl.replace(/(?:\/api)+\/?$/i, "").replace(/\/$/, "") + "/api";

function endpoint(path: string) {
  if (!import.meta.env.DEV && !import.meta.env.VITE_API_URL) throw new Error("Payroll API URL is not configured.");
  return `${API_URL}/${path.replace(/^\/+/, "").replace(/^(?:api\/)+/i, "")}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("payrollToken");
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(endpoint(path), { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("payrollToken"); localStorage.removeItem("payrollUser");
    }
    throw new Error(typeof data === "object" && data?.message ? data.message : "Request failed");
  }
  return data as T;
}

export async function fetchFile(path: string, fallbackName: string) {
  const token = localStorage.getItem("payrollToken");
  const response = await fetch(endpoint(path), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Download failed");
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The server returned an empty payslip PDF. Try again or contact the administrator.");
  if (blob.type && !blob.type.toLowerCase().includes("application/pdf")) {
    throw new Error("The server response is not a PDF. The payslip service may need a redeploy.");
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const name = match?.[1] || fallbackName;
  return { blob, name };
}

export async function downloadFile(path: string, fallbackName: string) {
  const { blob, name } = await fetchFile(path, fallbackName);
  downloadBlob(blob, name);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  // Let the browser start consuming the blob before releasing its object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
export const monthName = (month: number) => new Date(2026, month - 1, 1).toLocaleString("en-IN", { month: "long" });
