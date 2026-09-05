import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { MemberAccount, AuthUser } from "../types/auth";

const ADMIN_DOC_PATH = "system_config";
const ADMIN_DOC_ID = "admin";
const MEMBERS_COLLECTION = "members";

// Mật khẩu Admin mặc định ban đầu nếu chưa từng thiết lập
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin";

/**
 * Lấy hoặc khởi tạo cấu hình Admin trong Firestore
 */
export async function getAdminConfig(): Promise<{ username: string; password: string }> {
  try {
    const adminRef = doc(db, ADMIN_DOC_PATH, ADMIN_DOC_ID);
    const snap = await getDoc(adminRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        username: data.username || DEFAULT_ADMIN_USERNAME,
        password: data.password || DEFAULT_ADMIN_PASSWORD,
      };
    } else {
      // Khởi tạo tài khoản Admin tối cao ban đầu
      const initialConfig = {
        username: DEFAULT_ADMIN_USERNAME,
        password: DEFAULT_ADMIN_PASSWORD,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: "admin",
      };
      await setDoc(adminRef, initialConfig);
      return {
        username: DEFAULT_ADMIN_USERNAME,
        password: DEFAULT_ADMIN_PASSWORD,
      };
    }
  } catch (err) {
    console.warn("Không thể kết nối Firestore để lấy cấu hình admin, dùng dự phòng bộ nhớ:", err);
    const cached = localStorage.getItem("hvt_admin_pwd");
    return {
      username: DEFAULT_ADMIN_USERNAME,
      password: cached || DEFAULT_ADMIN_PASSWORD,
    };
  }
}

/**
 * Thay đổi mật khẩu ADMIN tối cao
 */
export async function updateAdminPassword(newPassword: string): Promise<boolean> {
  try {
    const adminRef = doc(db, ADMIN_DOC_PATH, ADMIN_DOC_ID);
    await setDoc(
      adminRef,
      {
        username: DEFAULT_ADMIN_USERNAME,
        password: newPassword,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    localStorage.setItem("hvt_admin_pwd", newPassword);
    return true;
  } catch (err) {
    console.error("Lỗi khi đổi mật khẩu Admin:", err);
    localStorage.setItem("hvt_admin_pwd", newPassword);
    return true;
  }
}

/**
 * Xác thực đăng nhập hệ thống: Kiểm tra Admin hoặc Thành viên
 */
export async function authenticate(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." };
  }

  // 1. Kiểm tra tài khoản Quản trị viên (ADMIN)
  try {
    const adminConfig = await getAdminConfig();
    if (
      cleanUsername.toLowerCase() === adminConfig.username.toLowerCase() &&
      cleanPassword === adminConfig.password
    ) {
      return {
        success: true,
        user: {
          username: adminConfig.username,
          role: "admin",
          fullName: "QUẢN TRỊ VIÊN TỐI CAO",
        },
      };
    }
  } catch (err) {
    console.error("Lỗi khi kiểm tra admin:", err);
  }

  // 2. Kiểm tra tài khoản Thành viên trong Firestore
  try {
    const membersRef = collection(db, MEMBERS_COLLECTION);
    const q = query(membersRef, where("username", "==", cleanUsername));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const member = docSnap.data() as MemberAccount;

      // So khớp mật khẩu
      if (member.password === cleanPassword) {
        if (member.status === "locked") {
          return {
            success: false,
            error: "Tài khoản của bạn đã bị KHÓA bởi Quản trị viên. Vui lòng liên hệ Admin để được mở lại.",
          };
        }

        return {
          success: true,
          user: {
            id: docSnap.id,
            username: member.username,
            role: "member",
            fullName: member.fullName || member.username,
            email: member.email,
            phone: member.phone,
          },
        };
      } else {
        return { success: false, error: "Mật khẩu không chính xác. Vui lòng kiểm tra lại." };
      }
    }
  } catch (err) {
    console.error("Lỗi khi tìm kiếm tài khoản thành viên trong Firestore:", err);
  }

  return { success: false, error: "Tên đăng nhập hoặc mật khẩu không đúng." };
}

/**
 * Lấy toàn bộ danh sách thành viên (CHỈ ADMIN MỚI ĐƯỢC PHÉP GỌI)
 */
export async function getAllMembers(): Promise<MemberAccount[]> {
  try {
    const membersRef = collection(db, MEMBERS_COLLECTION);
    const snap = await getDocs(membersRef);
    const list: MemberAccount[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<MemberAccount, "id">) });
    });
    // Sắp xếp theo ngày tạo mới nhất lên đầu
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.error("Lỗi khi lấy danh sách thành viên:", err);
    throw err;
  }
}

/**
 * Thêm thành viên mới (ADMIN tạo tên đăng nhập, mật khẩu, họ tên, gmail, sđt)
 */
export async function createMember(data: {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const cleanUsername = data.username.trim();
    if (!cleanUsername) return { success: false, error: "Tên đăng nhập không được để trống." };
    if (!data.password.trim()) return { success: false, error: "Mật khẩu không được để trống." };
    if (!data.email.trim()) return { success: false, error: "Gmail không được để trống." };
    if (!data.phone.trim()) return { success: false, error: "Số điện thoại không được để trống." };

    // Kiểm tra trùng username
    const membersRef = collection(db, MEMBERS_COLLECTION);
    const q = query(membersRef, where("username", "==", cleanUsername));
    const existSnap = await getDocs(q);
    if (!existSnap.empty) {
      return { success: false, error: `Tên đăng nhập "${cleanUsername}" đã tồn tại. Vui lòng chọn tên khác.` };
    }

    const newMember: Omit<MemberAccount, "id"> = {
      username: cleanUsername,
      password: data.password.trim(),
      fullName: data.fullName.trim() || cleanUsername,
      email: data.email.trim(),
      phone: data.phone.trim(),
      role: "member",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: data.notes?.trim() || "",
    };

    const docRef = await addDoc(membersRef, newMember);
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error("Lỗi khi tạo thành viên:", err);
    return { success: false, error: err?.message || "Không thể tạo tài khoản thành viên." };
  }
}

/**
 * Chỉnh sửa thông tin thành viên (ADMIN)
 */
export async function updateMember(
  id: string,
  data: Partial<Omit<MemberAccount, "id" | "createdAt">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const memberDocRef = doc(db, MEMBERS_COLLECTION, id);
    await updateDoc(memberDocRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    console.error("Lỗi khi cập nhật thành viên:", err);
    return { success: false, error: err?.message || "Không thể cập nhật tài khoản." };
  }
}

/**
 * Xóa tài khoản thành viên (ADMIN)
 */
export async function deleteMember(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const memberDocRef = doc(db, MEMBERS_COLLECTION, id);
    await deleteDoc(memberDocRef);
    return { success: true };
  } catch (err: any) {
    console.error("Lỗi khi xóa thành viên:", err);
    return { success: false, error: err?.message || "Không thể xóa tài khoản." };
  }
}
