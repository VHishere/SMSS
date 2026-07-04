export function formatGender(value) {
  const map = {
    MALE: "Nam",
    FEMALE: "Nữ",
    OTHER: "Khác",
  };

  return map[value] || value || "—";
}

export function formatRelationship(value) {
  const map = {
    Father: "Cha",
    Mother: "Mẹ",
    Guardian: "Người giám hộ",
  };

  return map[value] || value || "—";
}

export function formatScoreType(value) {
  const map = {
    MIDTERM: "Giữa kỳ",
    FINAL: "Cuối kỳ",
    ORAL: "Miệng",
    WRITTEN: "Viết",
    QUIZ: "Kiểm tra",
  };

  return map[value] || value || "—";
}

export function formatStatus(value) {
  const map = {
    ACTIVE: "Đang học",
    INACTIVE: "Ngưng học",
    GRADUATED: "Đã tốt nghiệp",
  };

  return map[value] || value || "—";
}

export function getCurrentSchoolYearLabel(students = []) {
  const primary = students.find((s) => s.isPrimary === 1) || students[0];
  return primary?.schoolYearName || "Chưa cập nhật";
}
