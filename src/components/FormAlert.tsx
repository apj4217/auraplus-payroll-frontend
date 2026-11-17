import { AlertTriangle, CheckCircle2 } from "lucide-react";

type FormAlertProps = {
  type: "error" | "success";
  message: string;
};

export default function FormAlert({ type, message }: FormAlertProps) {
  if (!message) {
    return null;
  }

  const isError = type === "error";

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm font-medium ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      role={isError ? "alert" : "status"}
    >
      {isError ? (
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      )}
      <span className="leading-5">{message}</span>
    </div>
  );
}
