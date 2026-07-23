import { useMemo } from "react";
import { useTeacherClasses } from "./useTeacherClasses";

// Nguồn chân lý cho vai trò giáo viên là teacher_class.role_in_class (đã map sẵn
// vào profile.classes[].roleInClass ở backend), KHÔNG dùng user.roles toàn cục —
// vì một GV có thể vừa chủ nhiệm lớp này vừa dạy bộ môn lớp khác.
export function deriveTeacherRole(profile) {
  const classes = profile?.classes ?? [];
  const homeroomClasses = classes.filter((c) => c.roleInClass === "HOMEROOM_TEACHER");
  const subjectClasses = classes.filter((c) => c.roleInClass !== "HOMEROOM_TEACHER");
  const isHomeroom = homeroomClasses.length > 0;

  return {
    homeroomClasses,
    subjectClasses,
    isHomeroom,
    // Lớp chủ nhiệm đầu tiên (đa số GV chỉ chủ nhiệm 1 lớp)
    primaryHomeroomClass: homeroomClasses[0] ?? null,
    roleLabel: isHomeroom ? "Giáo viên chủ nhiệm" : "Giáo viên bộ môn",
  };
}

// Hook tiện dụng: fetch /teachers/me rồi suy ra vai trò theo lớp.
export function useTeacherRole() {
  const { profile, loading, error } = useTeacherClasses();
  const role = useMemo(() => deriveTeacherRole(profile), [profile]);
  return { profile, loading, error, ...role };
}
