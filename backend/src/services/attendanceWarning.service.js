const attendanceModel = require("../models/attendance.model");

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getLevel(absentSessions, policy) {
  const warnThreshold = round2(policy.maxAbsentSessions * policy.warnRatio);
  if (absentSessions > policy.maxAbsentSessions) return "OVER";
  if (absentSessions >= policy.maxAbsentSessions) return "LIMIT";
  if (absentSessions >= warnThreshold) return "WARN";
  return "OK";
}

function getNotificationKey(schoolYearId, level) {
  // related_type is VARCHAR(50), so we can use it as a per-year/per-threshold
  // idempotency key without adding columns/tables to the database.
  return `ATT_WARN_${schoolYearId}_${level}`;
}

function buildMessage(student, level, policy) {
  const warnThreshold = round2(policy.maxAbsentSessions * policy.warnRatio);

  if (level === "OVER") {
    return {
      title: "Vượt ngưỡng nghỉ học",
      content: `${student.fullName} đã nghỉ ${student.absentSessions} buổi, vượt ngưỡng tối đa ${policy.maxAbsentSessions} buổi/năm. Học sinh không đủ điều kiện chuyên cần để lên lớp.`,
    };
  }

  if (level === "LIMIT") {
    return {
      title: "Đã chạm ngưỡng nghỉ học",
      content: `${student.fullName} đã nghỉ ${student.absentSessions} buổi, chạm ngưỡng tối đa ${policy.maxAbsentSessions} buổi/năm. Nếu tiếp tục nghỉ, học sinh sẽ không đủ điều kiện chuyên cần để lên lớp.`,
    };
  }

  return {
    title: "Cảnh báo số buổi nghỉ",
    content: `${student.fullName} đã nghỉ ${student.absentSessions} buổi. Hệ thống bắt đầu cảnh báo từ ${warnThreshold} buổi và giới hạn tối đa là ${policy.maxAbsentSessions} buổi/năm.`,
  };
}

async function evaluateStudents({ studentIds, attendanceDate, actorUserId = null }) {
  const uniqueIds = [...new Set((studentIds || []).map(Number).filter(Number.isInteger))];
  if (uniqueIds.length === 0) return [];

  const year = await attendanceModel.findSchoolYearByDate(attendanceDate);
  if (!year) return [];

  const policy = await attendanceModel.findAbsencePolicy(year.schoolYearId);
  const rows = await attendanceModel.findStudentAbsenceSummaries(
    uniqueIds,
    year.startDate,
    year.endDate,
  );

  const results = [];

  for (const row of rows) {
    const absentPeriods =
      row.absentUnexcused + (policy.countExcused ? row.absentExcused : 0);
    const absentSessions = round2(absentPeriods / policy.periodsPerSession);
    const level = getLevel(absentSessions, policy);

    if (level === "OK") {
      await attendanceModel.resolveAbsenceWarning(row.studentId, year.schoolYearId);
      results.push({ ...row, absentPeriods, absentSessions, level, notified: false });
      continue;
    }

    await attendanceModel.upsertAbsenceWarning({
      studentId: row.studentId,
      schoolYearId: year.schoolYearId,
      absentPeriods,
      absentSessions,
      thresholdSessions: policy.maxAbsentSessions,
      note: `Nghỉ ${absentSessions} buổi (quy đổi từ ${absentPeriods} tiết), ngưỡng ${policy.maxAbsentSessions} buổi/năm.`,
      createdBy: actorUserId,
    });

    const parents = await attendanceModel.findStudentParentUserIds([row.studentId]);
    let notified = false;

    for (const parent of parents) {
      const relatedType = getNotificationKey(year.schoolYearId, level);
      const alreadySent = await attendanceModel.hasAttendanceThresholdNotification({
        receiverId: parent.parentUserId,
        studentId: row.studentId,
        relatedType,
      });

      if (alreadySent) continue;

      const message = buildMessage({ ...row, absentSessions }, level, policy);
      await attendanceModel.createAbsenceNotifications([
        {
          receiverId: parent.parentUserId,
          relatedId: row.studentId,
          relatedType,
          title: message.title,
          content: message.content,
        },
      ]);
      notified = true;
    }

    results.push({ ...row, absentPeriods, absentSessions, level, notified });
  }

  return results;
}

module.exports = {
  evaluateStudents,
  getLevel,
};
