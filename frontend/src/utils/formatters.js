export function formatGender(value) {
  const map = {
    MALE: "Nam",
    FEMALE: "Nữ",
    OTHER: "Khác",
  };

  return map[value] || value || "-";
}

export function formatRelationship(value) {
  const map = {
    Father: "Cha",
    Mother: "Mẹ",
    Guardian: "Người giám hộ",
  };

  return map[value] || value || "-";
}

export function formatScoreType(value) {
  const map = {
    MIDTERM: "Giữa kỳ",
    FINAL: "Cuối kỳ",
    ORAL: "Miệng",
    WRITTEN: "Viết",
    QUIZ: "Kiểm tra",
  };

  return map[value] || value || "-";
}

export function formatStatus(value) {
  const map = {
    ACTIVE: "Đang học",
    INACTIVE: "Ngưng học",
    GRADUATED: "Đã tốt nghiệp",
  };

  return map[value] || value || "-";
}

export function getCurrentSchoolYearLabel(students = []) {
  const primary = students.find((student) => student.isPrimary === 1) || students[0];
  return primary?.schoolYearName || "Chưa cập nhật";
}

export const ROLE_LABELS = {
  ADMIN: "Admin",
  STAFF: "Staff",
  HOMEROOM_TEACHER: "Giáo viên chủ nhiệm",
  SUBJECT_TEACHER: "Giáo viên bộ môn",
  DORM_SUPERVISOR: "Quản nhiệm",
  PARENT: "Phụ huynh",
  STUDENT: "Học sinh",
};

export function formatRoleLabel(roleNames = []) {
  const list = Array.isArray(roleNames) ? roleNames : [roleNames].filter(Boolean);
  if (list.length === 0) return "Chưa có vai trò";
  return list.map((name) => ROLE_LABELS[name] || name).join(", ");
}

export function getAccountStatusInfo(status) {
  const map = {
    ACTIVE: { label: "Hoạt động", tone: "success" },
    LOCKED: { label: "Đã khóa", tone: "danger" },
    INACTIVE: { label: "Ngưng hoạt động", tone: "warning" },
  };

  return map[status] || { label: status || "-", tone: "neutral" };
}

export function formatAccountStatus(value) {
  const map = {
    ACTIVE: "Hoạt động",
    INACTIVE: "Ngưng hoạt động",
    LOCKED: "Đã khóa",
  };

  return map[value] || value || "-";
}

export function formatTeacherType(isHomeroom) {
  return isHomeroom ? "Giáo viên chủ nhiệm" : "Giáo viên bộ môn";
}
