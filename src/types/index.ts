export type User = { id: string; name: string; email: string; role: "admin" | "hr" | "employee"; status?: string };

export type Designation = { id: string; title: string; status: "active" | "inactive" };

export type Department = {
  id: string; code: string; name: string; manager: string; location: string;
  description: string; status: "active" | "inactive"; employeeCount: number; createdAt: string;
  designations?: Designation[];
};

export type SalaryLineItem = { label: string; amount: number };

export type SalaryStructure = {
  basicSalary: number; pfPercentage: number;
  earnings: SalaryLineItem[]; deductions: SalaryLineItem[];
};

export type Employee = {
  id: string; employeeCode: string; firstName: string; lastName: string; name: string;
  email: string; phone: string; gender: string; dateOfBirth: string; departmentId: string;
  departmentName: string; departmentCode?: string; designation: string; employmentType: string;
  joiningDate: string; status: "active" | "inactive"; address: { line1?: string; city?: string; state?: string; postalCode?: string };
  bankDetails: { bankName?: string; accountNumber?: string; ifscCode?: string };
  statutory: { pan?: string; uan?: string; pfNumber?: string }; salaryStructure: SalaryStructure;
  createdAt: string; updatedAt: string;
};

export type AttendanceRecord = {
  id: string; employeeId: string; date: string; status: "present" | "absent" | "half-day" | "leave";
  workingHours: number; overtimeHours: number; checkIn: string; checkOut: string; remarks?: string;
};

export type LeaveHistoryEntry = { status: string; at: string; by?: string; note: string };

export type Leave = {
  id: string; employeeId: string; leaveType: string; startDate: string; endDate: string;
  totalDays: number; reason: string; status: "pending" | "approved" | "rejected";
  reviewedBy?: string | null; reviewedAt?: string | null; rejectionReason?: string;
  appliedAt?: string; updatedAt?: string; createdAt: string; history?: LeaveHistoryEntry[];
};

export type Payroll = {
  id: string; payslipNumber: string; employeeId: string; employeeCode: string; employeeName: string;
  employeeEmail?: string; departmentId: string; departmentName: string; designation: string;
  month: number; year: number; workingDays: number; paidDays: number; lossOfPayDays: number;
  earnings: SalaryLineItem[]; deductions: SalaryLineItem[];
  grossSalary: number; totalDeduction: number; netSalary: number;
  paymentStatus: "pending" | "processed" | "paid"; paymentReference?: string;
  generatedAt: string; paidAt?: string;
};

export type Company = { name: string; address: string; email: string; phone: string; cin?: string };

export type NotificationItem = {
  id: string; type: string; recipient: string; message: string; status: "read" | "unread"; createdAt: string;
};
