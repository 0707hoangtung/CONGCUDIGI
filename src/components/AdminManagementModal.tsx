import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  UserPlus,
  Key,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  Search,
  X,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  Download,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { MemberAccount } from "../types/auth";
import {
  getAllMembers,
  createMember,
  updateMember,
  deleteMember,
  updateAdminPassword,
} from "../services/authService";

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"members" | "add" | "admin_pwd">("members");
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Thêm thành viên mới
  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newFullName, setNewFullName] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");
  const [addError, setAddError] = useState<string>("");
  const [addSuccess, setAddSuccess] = useState<string>("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  // Chỉnh sửa thành viên (Modal edit)
  const [editingMember, setEditingMember] = useState<MemberAccount | null>(null);
  const [editPassword, setEditPassword] = useState<string>("");
  const [editFullName, setEditFullName] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"active" | "locked">("active");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Đổi mật khẩu ADMIN
  const [adminNewPwd, setAdminNewPwd] = useState<string>("");
  const [adminConfirmPwd, setAdminConfirmPwd] = useState<string>("");
  const [adminPwdSuccess, setAdminPwdSuccess] = useState<string>("");
  const [adminPwdError, setAdminPwdError] = useState<string>("");
  const [isSubmittingAdminPwd, setIsSubmittingAdminPwd] = useState<boolean>(false);

  // Tải danh sách thành viên từ Firestore
  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const data = await getAllMembers();
      setMembers(data);
    } catch (err) {
      console.error("Lỗi khi tải danh sách thành viên:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Lọc tìm kiếm thành viên
  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.username.toLowerCase().includes(q) ||
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  });

  // Tạo mật khẩu ngẫu nhiên dễ nhớ nhưng an toàn cho thành viên
  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  // Thêm thành viên
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");

    if (!newUsername.trim() || !newPassword.trim() || !newEmail.trim() || !newPhone.trim()) {
      setAddError("Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu, Gmail và Số điện thoại.");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await createMember({
        username: newUsername,
        password: newPassword,
        fullName: newFullName || newUsername,
        email: newEmail,
        phone: newPhone,
        notes: newNotes,
      });

      if (res.success) {
        setAddSuccess(`Đã tạo thành công tài khoản thành viên "${newUsername}"!`);
        setNewUsername("");
        setNewPassword("");
        setNewFullName("");
        setNewEmail("");
        setNewPhone("");
        setNewNotes("");
        await loadMembers();
        setTimeout(() => {
          setActiveTab("members");
          setAddSuccess("");
        }, 1200);
      } else {
        setAddError(res.error || "Không thể tạo tài khoản.");
      }
    } catch (err: any) {
      setAddError(err?.message || "Lỗi khi lưu vào cơ sở dữ liệu.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Mở modal sửa thành viên
  const handleOpenEdit = (m: MemberAccount) => {
    setEditingMember(m);
    setEditPassword(m.password);
    setEditFullName(m.fullName);
    setEditEmail(m.email);
    setEditPhone(m.phone);
    setEditStatus(m.status);
    setEditNotes(m.notes || "");
    setEditError("");
  };

  // Lưu chỉnh sửa thành viên
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditError("");
    setIsSubmittingEdit(true);

    try {
      const res = await updateMember(editingMember.id, {
        password: editPassword.trim(),
        fullName: editFullName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        status: editStatus,
        notes: editNotes.trim(),
      });

      if (res.success) {
        setEditingMember(null);
        await loadMembers();
      } else {
        setEditError(res.error || "Lỗi khi cập nhật.");
      }
    } catch (err: any) {
      setEditError(err?.message || "Lỗi cập nhật Firestore.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Khóa / Mở khóa nhanh
  const handleToggleStatus = async (m: MemberAccount) => {
    const nextStatus = m.status === "active" ? "locked" : "active";
    try {
      await updateMember(m.id, { status: nextStatus });
      await loadMembers();
    } catch (err) {
      console.error("Lỗi khi đổi trạng thái tài khoản:", err);
    }
  };

  // Xóa thành viên
  const handleDeleteMember = async (m: MemberAccount) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn XÓA tài khoản thành viên "${m.username}" (${m.fullName})? Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    try {
      await deleteMember(m.id);
      await loadMembers();
    } catch (err) {
      console.error("Lỗi khi xóa thành viên:", err);
    }
  };

  // Đổi mật khẩu ADMIN
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPwdError("");
    setAdminPwdSuccess("");

    if (!adminNewPwd.trim()) {
      setAdminPwdError("Mật khẩu mới không được để trống.");
      return;
    }
    if (adminNewPwd !== adminConfirmPwd) {
      setAdminPwdError("Xác nhận mật khẩu mới không trùng khớp.");
      return;
    }

    setIsSubmittingAdminPwd(true);
    try {
      const ok = await updateAdminPassword(adminNewPwd.trim());
      if (ok) {
        setAdminPwdSuccess("Mật khẩu ADMIN tối cao đã được cập nhật thành công!");
        setAdminNewPwd("");
        setAdminConfirmPwd("");
      } else {
        setAdminPwdError("Không thể cập nhật mật khẩu.");
      }
    } catch (err) {
      setAdminPwdError("Lỗi hệ thống khi cập nhật.");
    } finally {
      setIsSubmittingAdminPwd(false);
    }
  };

  // Sao chép thông tin tài khoản để gửi cho thành viên
  const handleCopyAccountInfo = (m: MemberAccount) => {
    const info = `TÀI KHOẢN HỆ THỐNG TOÁN HỌC HVT:\n- Họ tên: ${m.fullName}\n- Tên đăng nhập: ${m.username}\n- Mật khẩu: ${m.password}\n- Gmail: ${m.email}\n- SĐT: ${m.phone}`;
    navigator.clipboard.writeText(info);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Xuất danh sách thành viên ra tệp văn bản
  const handleExportMembers = () => {
    const dataStr = JSON.stringify(members, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `danh_sach_thanh_vien_hvt_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCount = members.filter((m) => m.status === "active").length;
  const lockedCount = members.filter((m) => m.status === "locked").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xs shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight font-mono">
                  BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN // ADMIN
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono px-2 py-0.2 rounded font-bold">
                  QUYỀN CAO NHẤT
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Quản lý thành viên, cấp phát tài khoản, chỉnh sửa, xóa và bảo mật hệ thống
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 flex items-center gap-2 shrink-0 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`py-2.5 px-3 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === "members"
                ? "border-amber-500 text-amber-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>DANH SÁCH THÀNH VIÊN ({members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className={`py-2.5 px-3 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === "add"
                ? "border-emerald-500 text-emerald-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ CẤP TÀI KHOẢN MỚI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("admin_pwd")}
            className={`py-2.5 px-3 border-b-2 font-bold flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === "admin_pwd"
                ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>ĐỔI MẬT KHẨU ADMIN</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 1: DANH SÁCH THÀNH VIÊN */}
          {activeTab === "members" && (
            <div className="space-y-4">
              {/* Stat cards & search bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xs border border-slate-800">
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-slate-300">
                    Tổng cộng: <strong className="text-slate-100">{members.length}</strong>
                  </span>
                  <span className="text-emerald-400">
                    Hoạt động: <strong>{activeCount}</strong>
                  </span>
                  <span className="text-rose-400">
                    Bị khóa: <strong>{lockedCount}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm theo tên, gmail, SĐT..."
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadMembers}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition-colors"
                    title="Làm mới danh sách từ Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMembers}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition-colors"
                    title="Xuất file JSON sao lưu"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Members Table */}
              {isLoading ? (
                <div className="py-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang tải danh sách thành viên từ cơ sở dữ liệu...</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-12 text-center bg-slate-950/40 rounded border border-slate-800/80 p-6">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-medium">Chưa có thành viên nào phù hợp</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Nhấn vào tab <strong>"+ CẤP TÀI KHOẢN MỚI"</strong> để thêm thành viên khi có người cung cấp Gmail và Số điện thoại.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5">Thành viên</th>
                        <th className="px-3 py-2.5">Tên đăng nhập</th>
                        <th className="px-3 py-2.5">Mật khẩu cấp</th>
                        <th className="px-3 py-2.5">Gmail & SĐT</th>
                        <th className="px-3 py-2.5">Trạng thái</th>
                        <th className="px-3 py-2.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                      {filteredMembers.map((m) => {
                        const isPwdVisible = !!visiblePasswords[m.id];
                        return (
                          <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-100 font-sans">{m.fullName}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{new Date(m.createdAt).toLocaleDateString("vi-VN")}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-bold">
                                {m.username}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                  {isPwdVisible ? m.password : "••••••"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisiblePasswords((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                                  }
                                  className="text-slate-400 hover:text-slate-200"
                                  title={isPwdVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                >
                                  {isPwdVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyAccountInfo(m)}
                                  className="text-slate-400 hover:text-amber-300"
                                  title="Sao chép thông tin tài khoản gửi cho thành viên"
                                >
                                  {copiedId === m.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-slate-300 flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span className="truncate max-w-[160px]">{m.email}</span>
                              </div>
                              <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{m.phone}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(m)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                                  m.status === "active"
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                                    : "bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25"
                                }`}
                                title="Nhấp để chuyển trạng thái Khóa / Mở khóa"
                              >
                                {m.status === "active" ? (
                                  <>
                                    <Check className="w-2.5 h-2.5" />
                                    <span>HOẠT ĐỘNG</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>ĐÃ KHÓA</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(m)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded transition-colors"
                                  title="Chỉnh sửa thông tin thành viên"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m)}
                                  className="p-1 bg-slate-800 hover:bg-rose-900/60 text-rose-400 border border-slate-700 hover:border-rose-700 rounded transition-colors"
                                  title="Xóa tài khoản thành viên"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CẤP TÀI KHOẢN MỚI */}
          {activeTab === "add" && (
            <div className="max-w-xl mx-auto bg-slate-950/60 p-5 rounded-xs border border-slate-800">
              <div className="mb-4 pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>CẤP TÀI KHOẢN THÀNH VIÊN MỚI</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Nhập thông tin Gmail và Số điện thoại do người đó cung cấp để tạo tên đăng nhập và mật khẩu
                </p>
              </div>

              {addError && (
                <div className="mb-4 p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{addError}</span>
                </div>
              )}

              {addSuccess && (
                <div className="mb-4 p-3 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 font-mono">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{addSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateMember} className="space-y-3.5 text-xs font-mono">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    HỌ VÀ TÊN THÀNH VIÊN: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      GMAIL (EMAIL): <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="nguyenvana@gmail.com"
                        className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      SỐ ĐIỆN THOẠI: <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="0987654321"
                        className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      TÊN ĐĂNG NHẬP CẤP: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="VD: nguyenvana hoặc hocsinh01"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-semibold">
                        MẬT KHẨU CẤP: <span className="text-rose-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[10px] text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Tạo ngẫu nhiên</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập hoặc tạo mật khẩu"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">GHI CHÚ THÊM:</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Lớp 12A1, học sinh ôn thi, giáo viên, v.v."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmittingAdd}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingAdd ? (
                      <span>ĐANG TẠO VÀ LƯU VÀO CƠ SỞ DỮ LIỆU...</span>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>LƯU & CẤP TÀI KHOẢN CHO THÀNH VIÊN</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: ĐỔI MẬT KHẨU ADMIN */}
          {activeTab === "admin_pwd" && (
            <div className="max-w-md mx-auto bg-slate-950/60 p-5 rounded-xs border border-slate-800">
              <div className="mb-4 pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>THAY ĐỔI MẬT KHẨU ADMIN TỐI CAO</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Đổi mật khẩu bảo vệ quyền quản trị trang web. Mật khẩu mới sẽ được cập nhật đồng bộ lên Firestore.
                </p>
              </div>

              {adminPwdError && (
                <div className="mb-4 p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
                  {adminPwdError}
                </div>
              )}

              {adminPwdSuccess && (
                <div className="mb-4 p-3 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono">
                  {adminPwdSuccess}
                </div>
              )}

              <form onSubmit={handleChangeAdminPassword} className="space-y-3.5 text-xs font-mono">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">MẬT KHẨU ADMIN MỚI:</label>
                  <input
                    type="password"
                    value={adminNewPwd}
                    onChange={(e) => setAdminNewPwd(e.target.value)}
                    placeholder="Nhập mật khẩu admin mới"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    XÁC NHẬN LẠI MẬT KHẨU ADMIN MỚI:
                  </label>
                  <input
                    type="password"
                    value={adminConfirmPwd}
                    onChange={(e) => setAdminConfirmPwd(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingAdminPwd}
                    className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs transition-colors cursor-pointer"
                  >
                    {isSubmittingAdminPwd ? "ĐANG LƯU MẬT KHẨU..." : "CẬP NHẬT MẬT KHẨU ADMIN"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* MODAL CON: CHỈNH SỬA THÔNG TIN THÀNH VIÊN */}
        {editingMember && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs font-mono">
            <div className="bg-slate-900 border border-slate-700 rounded-xs shadow-2xl w-full max-w-lg p-5">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    CHỈNH SỬA THÀNH VIÊN: {editingMember.username}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="text-slate-400 hover:text-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="mb-3 p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                  {editError}
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Họ và tên:</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Gmail:</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Số điện thoại:</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Mật khẩu đăng nhập:</label>
                    <input
                      type="text"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-emerald-400 font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Trạng thái tài khoản:</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as "active" | "locked")}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold"
                    >
                      <option value="active">Hoạt động (Active)</option>
                      <option value="locked">Bị khóa (Locked)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Ghi chú:</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-300"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                  >
                    HỦY
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs"
                  >
                    {isSubmittingEdit ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
