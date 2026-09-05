import React, { useState } from "react";
import { Lock, User, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await login(username, password);
      if (!res.success) {
        setErrorMsg(res.error || "Tên đăng nhập hoặc mật khẩu không chính xác.");
      }
    } catch (err: any) {
      setErrorMsg("Lỗi khi kết nối hệ thống. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none">
      {/* Dynamic Background Geometry Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
            linear-gradient(to right, rgba(51, 65, 85, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(51, 65, 85, 0.25) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        }}
      />

      {/* Glow orb */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Top Branding Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-full text-xs font-mono text-emerald-400 mb-3 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            HỆ THỐNG TOÁN HỌC HVT // BẢO VỆ ĐĂNG NHẬP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl font-sans">
            CÔNG CỤ TOÁN HỌC HVT
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-mono">
            Mô phỏng 3D & Khảo sát chuyên sâu GDPT 2018
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xs shadow-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-200">Xác thực quyền truy cập</h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Đăng nhập với vai trò ADMIN hoặc THÀNH VIÊN
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              FIREBASE SECURE
            </span>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xs bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2 animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-mono leading-relaxed">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                TÊN ĐĂNG NHẬP:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập (VD: admin hoặc tên thành viên)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-2xs text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                MẬT KHẨU:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu truy cập"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-2xs text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono text-xs rounded-2xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>ĐANG XÁC THỰC BẢN QUYỀN...</span>
                </>
              ) : (
                <>
                  <span>ĐĂNG NHẬP HỆ THỐNG</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security watermark footer */}
        <div className="text-center mt-6 text-[10px] font-mono text-slate-600 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
          <span>HỆ THỐNG BẢO VỆ PHÂN QUYỀN TOÁN HỌC // GDPT 2018</span>
        </div>
      </div>
    </div>
  );
};
