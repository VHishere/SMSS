const behaviourModel = require("../models/behaviour.model");
const { computeConduct } = require("./conduct.service");
const {
  MERIT_CATEGORIES,
  VIOLATION_CATEGORIES,
  BASE_CONDUCT_SCORE,
  CONDUCT_BUCKETS,
  WARNING_RULES,
  getConductGrade,
} = require("../config/behaviour.config");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function validCategory(behaviorType, category) {
  if (!category) return true; // category optional
  return behaviorType === "POSITIVE"
    ? MERIT_CATEGORIES.includes(category)
    : VIOLATION_CATEGORIES.includes(category);
}

async function resolveSemesterId(recordDate) {
  const semesters = await behaviourModel.findSemesters();
  const match = semesters.find((s) => s.startDate <= recordDate && s.endDate >= recordDate);
  return match ? match.semesterId : null;
}

function buildRecipientNotifications(recipients, title, content) {
  return recipients.map((receiverId) => ({ receiverId, title, content }));
}

// ── Create merit / demerit ────────────────────────────────────────────────────

async function createRecord({ teacherId, actorUserId, payload }) {
  const { studentId, behaviorType, title, category, description, severityLevel, points, recordDate, evidenceUrl } = payload;

  if (!["POSITIVE", "VIOLATION"].includes(behaviorType)) throw httpError("Loại hành vi không hợp lệ", 400);
  if (!studentId) throw httpError("Thiếu học sinh", 400);
  if (!title || !title.trim()) throw httpError("Tiêu đề là bắt buộc", 400);
  if (!recordDate) throw httpError("Ngày ghi nhận là bắt buộc", 400);

  const pts = Number(points);
  if (!Number.isInteger(pts) || pts <= 0) {
    throw httpError(behaviorType === "POSITIVE" ? "Điểm khen thưởng phải là số dương" : "Điểm trừ phải là số dương", 400);
  }
  if (!validCategory(behaviorType, category)) throw httpError("Danh mục không hợp lệ", 400);

  const allowed = await behaviourModel.isTeacherForStudent(teacherId, parseInt(studentId, 10));
  if (!allowed) throw httpError("Bạn không phụ trách học sinh này", 403);

  const semesterId = await resolveSemesterId(recordDate);

  const recipients = await behaviourModel.findStudentRecipients(parseInt(studentId, 10));
  const notifTitle = behaviorType === "POSITIVE" ? "Được khen thưởng" : "Bị ghi nhận vi phạm";
  const notifContent = behaviorType === "POSITIVE"
    ? `Học sinh được cộng ${pts} điểm khen thưởng: "${title.trim()}".`
    : `Học sinh bị ghi nhận vi phạm (-${pts} điểm): "${title.trim()}".`;

  const behaviorId = await behaviourModel.createRecord({
    studentId: parseInt(studentId, 10),
    behaviorType,
    title: title.trim(),
    category: category ?? null,
    description: description ?? null,
    severityLevel: severityLevel ?? "LOW",
    points: pts,
    recordDate,
    semesterId,
    evidenceUrl: evidenceUrl ?? null,
    createdBy: actorUserId,
    reason: payload.reason ?? null,
    notifications: buildRecipientNotifications(recipients, notifTitle, notifContent),
  });

  return { behaviorId };
}

async function updateRecord({ teacherId, actorUserId, behaviorId, payload }) {
  const existing = await behaviourModel.findRecordById(behaviorId);
  if (!existing) throw httpError("Không tìm thấy bản ghi", 404);
  if (existing.status !== "ACTIVE") throw httpError("Bản ghi đã lưu trữ, không thể sửa", 409);

  const allowed = await behaviourModel.isTeacherForStudent(teacherId, existing.studentId);
  if (!allowed) throw httpError("Bạn không phụ trách học sinh này", 403);

  const pts = Number(payload.points);
  if (!Number.isInteger(pts) || pts <= 0) throw httpError("Điểm phải là số dương", 400);
  if (!payload.title || !payload.title.trim()) throw httpError("Tiêu đề là bắt buộc", 400);
  if (!payload.recordDate) throw httpError("Ngày ghi nhận là bắt buộc", 400);
  if (!validCategory(existing.behaviorType, payload.category)) throw httpError("Danh mục không hợp lệ", 400);

  await behaviourModel.updateRecord({
    behaviorId,
    oldPoints: existing.points,
    reason: payload.reason ?? null,
    changedBy: actorUserId,
    fields: {
      studentId: existing.studentId,
      title: payload.title.trim(),
      category: payload.category ?? null,
      description: payload.description ?? null,
      severityLevel: payload.severityLevel ?? "LOW",
      points: pts,
      recordDate: payload.recordDate,
      evidenceUrl: payload.evidenceUrl ?? null,
    },
  });

  return { behaviorId };
}

async function archiveRecord({ teacherId, actorUserId, behaviorId, reason }) {
  const existing = await behaviourModel.findRecordById(behaviorId);
  if (!existing) throw httpError("Không tìm thấy bản ghi", 404);

  const allowed = await behaviourModel.isTeacherForStudent(teacherId, existing.studentId);
  if (!allowed) throw httpError("Bạn không phụ trách học sinh này", 403);
  if (!reason || !reason.trim()) throw httpError("Vui lòng nhập lý do lưu trữ", 400);
  if (existing.status === "ARCHIVED") throw httpError("Bản ghi đã được lưu trữ", 409);

  await behaviourModel.archiveRecord({
    behaviorId, studentId: existing.studentId, oldPoints: existing.points,
    reason: reason.trim(), changedBy: actorUserId,
  });
  return { behaviorId };
}

// ── Conduct evaluation ────────────────────────────────────────────────────────

async function getConductPreview({ studentId, semesterId }) {
  const semester = await behaviourModel.findSemesterById(semesterId);
  if (!semester) throw httpError("Không tìm thấy học kỳ", 404);

  const agg = await behaviourModel.aggregateConduct(studentId, semester.startDate, semester.endDate);
  const existing = await behaviourModel.findConductEvaluation(studentId, semesterId);
  const adjustment = existing ? existing.adjustment : 0;

  const computed = computeConduct({
    meritPoints: agg.meritPoints,
    demeritPoints: agg.demeritPoints,
    adjustment,
    base: existing ? existing.baseScore : BASE_CONDUCT_SCORE,
  });

  return { aggregate: agg, computed, existing };
}

async function evaluateConduct({ teacherId, actorUserId, payload }) {
  const { studentId, semesterId, adjustment = 0, comment, status = "DRAFT" } = payload;

  if (!studentId || !semesterId) throw httpError("Thiếu học sinh hoặc học kỳ", 400);
  if (!comment || !comment.trim()) throw httpError("Đánh giá hạnh kiểm phải có nhận xét", 400);

  const allowed = await behaviourModel.isTeacherForStudent(teacherId, parseInt(studentId, 10));
  if (!allowed) throw httpError("Bạn không phụ trách học sinh này", 403);

  const semester = await behaviourModel.findSemesterById(semesterId);
  if (!semester) throw httpError("Không tìm thấy học kỳ", 404);

  const agg = await behaviourModel.aggregateConduct(parseInt(studentId, 10), semester.startDate, semester.endDate);
  const computed = computeConduct({
    meritPoints: agg.meritPoints,
    demeritPoints: agg.demeritPoints,
    adjustment: Number(adjustment) || 0,
    base: BASE_CONDUCT_SCORE,
  });

  await behaviourModel.upsertConductEvaluation({
    studentId: parseInt(studentId, 10),
    semesterId: parseInt(semesterId, 10),
    meritPoints: agg.meritPoints,
    demeritPoints: agg.demeritPoints,
    baseScore: BASE_CONDUCT_SCORE,
    adjustment: Number(adjustment) || 0,
    finalScore: computed.finalScore,
    conductGrade: computed.grade.label,
    comment: comment.trim(),
    status: status === "APPROVED" ? "APPROVED" : "DRAFT",
    evaluatedBy: actorUserId,
  });

  // Notify on approval
  if (status === "APPROVED") {
    try {
      const recipients = await behaviourModel.findStudentRecipients(parseInt(studentId, 10));
      await behaviourModel.insertNotifications(
        recipients.map((receiverId) => ({
          receiverId,
          title: "Kết quả hạnh kiểm",
          content: `Hạnh kiểm học kỳ đã được đánh giá: ${computed.finalScore}/100 (${computed.grade.label}).`,
          relatedId: parseInt(studentId, 10),
        })),
      );
    } catch (e) {
      console.error("evaluateConduct notifications (non-critical):", e);
    }
  }

  return { studentId, semesterId, finalScore: computed.finalScore, grade: computed.grade };
}

// ── Student behaviour profile ─────────────────────────────────────────────────

async function getStudentBehaviour({ studentId, semesterId }) {
  const profile = await behaviourModel.findStudentProfile(studentId);
  if (!profile) throw httpError("Không tìm thấy học sinh", 404);

  const semesters = await behaviourModel.findSemesters();
  const targetSemesterId = semesterId ? parseInt(semesterId, 10) : (semesters[0]?.semesterId ?? null);

  const records = await behaviourModel.findStudentRecords(studentId);
  const merits = records.filter((r) => r.behaviorType === "POSITIVE");
  const demerits = records.filter((r) => r.behaviorType === "VIOLATION");

  const conductHistory = await behaviourModel.findStudentConductHistory(studentId);

  let currentConduct = null;
  if (targetSemesterId) {
    const preview = await getConductPreview({ studentId, semesterId: targetSemesterId });
    currentConduct = {
      ...preview.computed,
      evaluation: preview.existing,
      violationCount: preview.aggregate.violationCount,
      meritCount: preview.aggregate.meritCount,
    };
  }

  return {
    profile, semesters, targetSemesterId,
    merits, demerits, conductHistory, currentConduct,
  };
}

// ── Class analytics ───────────────────────────────────────────────────────────

async function getClassAnalytics({ classId, semesterId }) {
  if (!classId || !semesterId) throw httpError("Thiếu lớp hoặc học kỳ", 400);

  const semester = await behaviourModel.findSemesterById(semesterId);
  if (!semester) throw httpError("Không tìm thấy học kỳ", 404);

  const rows = await behaviourModel.aggregateClassConduct(parseInt(classId, 10), semester.startDate, semester.endDate);

  const withConduct = rows.map((r) => {
    const computed = computeConduct({ meritPoints: r.meritPoints, demeritPoints: r.demeritPoints, adjustment: 0 });
    return { ...r, finalScore: computed.finalScore, grade: computed.grade };
  });

  const totalStudents = withConduct.length;
  const avgConduct = totalStudents > 0
    ? Math.round(withConduct.reduce((a, s) => a + s.finalScore, 0) / totalStudents)
    : null;

  const topPositive = [...withConduct]
    .filter((s) => s.meritPoints > 0)
    .sort((a, b) => b.meritPoints - a.meritPoints)
    .slice(0, 5);

  const mostViolations = [...withConduct]
    .filter((s) => s.violationCount > 0)
    .sort((a, b) => b.demeritPoints - a.demeritPoints)
    .slice(0, 5);

  const distribution = CONDUCT_BUCKETS.map((b) => ({
    key: b.key, label: b.label,
    count: withConduct.filter((s) => s.finalScore >= b.min && s.finalScore < b.max).length,
  }));

  const totalMerit = withConduct.reduce((a, s) => a + s.meritPoints, 0);
  const totalDemerit = withConduct.reduce((a, s) => a + s.demeritPoints, 0);

  const trend = await behaviourModel.monthlyTrend(parseInt(classId, 10), semester.startDate, semester.endDate);

  return {
    summary: { totalStudents, avgConduct, totalMerit, totalDemerit },
    topPositive, mostViolations, distribution, trend,
    students: withConduct.sort((a, b) => b.finalScore - a.finalScore),
  };
}

// ── Behaviour warnings ────────────────────────────────────────────────────────

async function generateWarnings({ teacherId, actorUserId, classId, semesterId }) {
  if (!classId || !semesterId) throw httpError("Thiếu lớp hoặc học kỳ", 400);

  const semester = await behaviourModel.findSemesterById(semesterId);
  if (!semester) throw httpError("Không tìm thấy học kỳ", 404);

  const rows = await behaviourModel.aggregateClassConduct(parseInt(classId, 10), semester.startDate, semester.endDate);

  let generated = 0;
  const notifications = [];

  for (const r of rows) {
    const computed = computeConduct({ meritPoints: r.meritPoints, demeritPoints: r.demeritPoints, adjustment: 0 });

    const warnings = [];
    if (computed.finalScore < WARNING_RULES.LOW_CONDUCT_BELOW) {
      warnings.push({ type: "LOW_CONDUCT", note: `Điểm hạnh kiểm ${computed.finalScore} dưới ngưỡng (${WARNING_RULES.LOW_CONDUCT_BELOW}).` });
    }
    if (r.violationCount >= WARNING_RULES.EXCESSIVE_VIOLATION_COUNT || r.demeritPoints >= WARNING_RULES.EXCESSIVE_DEMERIT_POINTS) {
      warnings.push({ type: "EXCESSIVE_VIOLATION", note: `Vi phạm nhiều: ${r.violationCount} lần, -${r.demeritPoints} điểm.` });
    }

    for (const w of warnings) {
      await behaviourModel.upsertWarning({
        studentId: r.studentId,
        semesterId: parseInt(semesterId, 10),
        warningType: w.type,
        conductScore: computed.finalScore,
        violationCount: r.violationCount,
        note: w.note,
        createdBy: actorUserId,
      });
      generated++;

      const recipients = await behaviourModel.findStudentRecipients(r.studentId);
      for (const receiverId of recipients) {
        notifications.push({ receiverId, title: "Cảnh báo hạnh kiểm", content: w.note, relatedId: r.studentId });
      }
    }
  }

  if (notifications.length) {
    try { await behaviourModel.insertNotifications(notifications); }
    catch (e) { console.error("generateWarnings notifications (non-critical):", e); }
  }

  return { generated };
}

async function updateWarning({ warningId, payload }) {
  const warning = await behaviourModel.findWarningById(warningId);
  if (!warning) throw httpError("Không tìm thấy cảnh báo", 404);

  const status = ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(payload.status) ? payload.status : warning.status;
  const affected = await behaviourModel.updateWarningIntervention(warningId, {
    note: payload.note, intervention: payload.intervention, status,
  });
  if (affected === 0) throw httpError("Không thể cập nhật cảnh báo", 409);
  return { warningId, status };
}

module.exports = {
  createRecord,
  updateRecord,
  archiveRecord,
  getConductPreview,
  evaluateConduct,
  getStudentBehaviour,
  getClassAnalytics,
  generateWarnings,
  updateWarning,
};
