export type UserRole = "admin" | "member";
export type UserStatus = "active" | "locked";

export interface MemberAccount {
  id: string;
  username: string;
  password: string;
  fullName: string;
  email: string; // Gmail do thành viên cung cấp
  phone: string; // Số điện thoại do thành viên cung cấp
  role: "member";
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface AuthUser {
  username: string;
  role: UserRole;
  fullName: string;
  email?: string;
  phone?: string;
  id?: string;
}
