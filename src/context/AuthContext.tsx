import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthUser } from "../types/auth";
import { authenticate } from "../services/authService";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "hvt_auth_session_v1";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Khôi phục phiên đăng nhập khi khởi động
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        if (parsed && parsed.username && parsed.role) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.error("Lỗi khi khôi phục phiên đăng nhập:", e);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authenticate(username, password);
    if (res.success && res.user) {
      setUser(res.user);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
      } catch (e) {
        console.warn("Không thể lưu session vào localStorage:", e);
      }
      return { success: true };
    } else {
      return { success: false, error: res.error || "Đăng nhập không thành công." };
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Không thể xóa session:", e);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isMember: user?.role === "member",
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong AuthProvider");
  }
  return context;
}
