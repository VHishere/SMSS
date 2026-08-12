const academicModel = require("../models/academic.model");
const gpa = require("./gpa.service");
const {
  SCORE_TYPES,
  GRADE_BUCKETS,
  WARNING_RULES,
  getStanding,
} = require("../config/academic.config");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Thang điểm do client gửi lên và được dùng làm mẫu số khi quy đổi về hệ 10
// (gpa.service.normalize), nên phải có trần — nếu không một thang 100000 sẽ
// làm mọi điểm quy đổi về gần 0.
const MAX_SCORE_LIMIT = 100;

// ── Score input / bulk ────────────────────────────────────────────────────────

async function submitScores({ teacherId, actorUserId, payload }) {
  const { classId, subjectId, semesterId, scoreType, maxScore, records } = payload;

  if (!classId || !subjectId || !semesterId) {
    throw httpError("Thiếu thông tin lớp / môn / học kỳ", 400);
  }
  if (!SCORE_TYPES.includes(scoreType)) {
    throw httpError("Loại điểm không hợp lệ", 400);
  }
  const max = Number(maxScore);
  if (!Number.isFinite(max) || max <= 0) {
    throw httpError("Điểm tối đa phải lớn hơn 0", 400);
  }
  if (max > MAX_SCORE_LIMIT) {
    throw httpError(`Điểm tối đa không được vượt quá ${MAX_SCORE_LIMIT}`, 400);
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw httpError("Không có điểm nào để lưu", 400);
  }

  const ok = await academicModel.isTeacherAssigned(teacherId, parseInt(classId, 10), parseInt(subjectId, 10));
  if (!ok) throw httpError("Bạn không được phân công dạy lớp/môn này", 403);

  // Validate + collect only rows that actually carry a score
  const clean = [];
  for (const r of records) {
    if (r.scoreValue === null || r.scoreValue === "" || r.scoreValue === undefined) continue;
    const v = Number(r.scoreValue);
    if (!Number.isFinite(v) || v < 0) throw httpError("Điểm không được âm", 400);
    if (v > max) throw httpError(`Điểm không được vượt quá điểm tối đa (${max})`, 400);
    clean.push({
      studentId: parseInt(r.studentId, 10),
      scoreValue: v,
      comment: r.comment ?? null,
      reason: r.reason ?? null,
    });
  }

  if (clean.length === 0) throw httpError("Không có điểm hợp lệ để lưu", 400);

  // Notifications to each scored student + their parents — batched (2 query thay vì N).
  const notifications = [];
  const recipientsMap = await academicModel.findRecipientsForStudents(clean.map((r) => r.studentId));
  for (const r of clean) {
    for (const receiverId of recipientsMap.get(r.studentId) || []) {
      notifications.push({
        receiverId,
        title:   "Điểm mới được cập nhật",
        content: `Có điểm ${scoreType} mới được công bố. Vui lòng kiểm tra kết quả học tập.`,
        relatedId: r.studentId,
      });
    }
  }

  await academicModel.bulkUpsertScores({
    classId: parseInt(classId, 10),
    subjectId: parseInt(subjectId, 10),
    semesterId: parseInt(semesterId, 10),
    scoreType,
    maxScore: max,
    records: clean,
    actorUserId,
    notifications,
  });

  return { saved: clean.length };
}

async function updateScore({ teacherId, actorUserId, resultId, payload }) {
  const prev = await academicModel.findResultById(resultId);
  if (!prev) throw httpError("Không tìm thấy điểm", 404);

  const ok = await academicModel.isTeacherForStudentSubject(teacherId, prev.studentId, prev.subjectId);
  if (!ok) throw httpError("Bạn không có quyền sửa điểm này", 403);

  const newScore = Number(payload.scoreValue);
  const max = payload.maxScore !== undefined ? Number(payload.maxScore) : prev.maxScore;

  if (!Number.isFinite(newScore) || newScore < 0) throw httpError("Điểm không được âm", 400);
  // Number.isFinite bắt cả NaN: `NaN <= 0` là false nên bản cũ ghi thẳng NaN vào DB.
  if (!Number.isFinite(max) || max <= 0) throw httpError("Điểm tối đa phải lớn hơn 0", 400);
  if (max > MAX_SCORE_LIMIT) throw httpError(`Điểm tối đa không được vượt quá ${MAX_SCORE_LIMIT}`, 400);
  if (newScore > max) throw httpError(`Điểm không được vượt quá điểm tối đa (${max})`, 400);

  await academicModel.updateSingleScore({
    resultId,
    newScore,
    maxScore: max,
    comment: payload.comment,
    reason: payload.reason,
    actorUserId,
    prev,
  });

  // Notify student + parents of the change
  try {
    const recipients = await academicModel.findStudentRecipients(prev.studentId);
    if (recipients.length) {
      const notifications = recipients.map((receiverId) => ({
        receiverId,
        title:   "Điểm đã được cập nhật",
        content: `Điểm ${prev.scoreType} của bạn đã được điều chỉnh thành ${newScore}.`,
        relatedId: prev.studentId,
      }));
      // reuse the bulk notification helper via a no-op score path is overkill;
      // insert directly through the model's notification table helper.
      await insertNotifications(notifications);
    }
  } catch (e) {
    console.error("updateScore notifications (non-critical):", e);
  }

  return { resultId, scoreValue: newScore };
}

async function deleteScore({ teacherId, actorUserId, resultId, reason }) {
  const prev = await academicModel.findResultById(resultId);
  if (!prev) throw httpError("Không tìm thấy điểm", 404);

  const ok = await academicModel.isTeacherForStudentSubject(teacherId, prev.studentId, prev.subjectId);
  if (!ok) throw httpError("Bạn không có quyền xóa điểm này", 403);

  if (!reason || !reason.trim()) throw httpError("Vui lòng nhập lý do xóa điểm", 400);

  await academicModel.deleteScore({ resultId, reason: reason.trim(), actorUserId, prev });
  return { resultId };
}

// Lightweight notification insert (used by single-score update path)
const { pool } = require("../config/db");
async function insertNotifications(notifications) {
  if (!notifications.length) return;
  await pool.query(
    `INSERT INTO notification
       (receiver_id, title, content, type, related_type, related_id, is_read)
     VALUES ?`,
    [notifications.map((n) => [n.receiverId, n.title, n.content, "ACADEMIC", "ACADEMIC_RESULT", n.relatedId ?? null, false])],
  );
}

// ── Student academic profile (GPA, standing, ranking, all semesters) ──────────

async function getStudentAcademic({ studentId, semesterId }) {
  const profile = await academicModel.findStudentProfile(studentId);
  if (!profile) throw httpError("Không tìm thấy học sinh", 404);

  const semesters = await academicModel.findSemesters();
  const targetSemesterId = semesterId
    ? parseInt(semesterId, 10)
    : (semesters[0]?.semesterId ?? null);

  // Per-semester summaries
  const semesterSummaries = [];
  for (const sem of semesters) {
    const rows = await academicModel.findStudentScores(studentId, sem.semesterId);
    if (rows.length === 0) continue;
    const summary = gpa.buildStudentSemesterSummary(rows);
    semesterSummaries.push({
      semesterId:     sem.semesterId,
      semesterName:   sem.semesterName,
      schoolYearName: sem.schoolYearName,
      ...summary,
    });
  }

  // Current semester detail
  const current = semesterSummaries.find((s) => s.semesterId === targetSemesterId) ?? null;

  // Ranking within class for the target semester
  let ranking = null;
  if (profile.classId && targetSemesterId) {
    ranking = await computeRanking(profile.classId, targetSemesterId, studentId);
  }

  // Yearly GPA = mean of that year's semester GPAs
  const yearly = {};
  for (const s of semesterSummaries) {
    if (s.gpa === null) continue;
    if (!yearly[s.schoolYearName]) yearly[s.schoolYearName] = [];
    yearly[s.schoolYearName].push(s.gpa);
  }
  const yearlyResults = Object.entries(yearly).map(([year, gpas]) => {
    const avg = gpa.round2(gpas.reduce((a, b) => a + b, 0) / gpas.length);
    return { schoolYearName: year, gpa: avg, standing: getStanding(avg) };
  });

  return {
    profile,
    semesters,
    targetSemesterId,
    current,
    semesterSummaries,
    yearlyResults,
    ranking,
  };
}

async function computeRanking(classId, semesterId, targetStudentId) {
  const rows = await academicModel.findClassScores(classId, semesterId);

  const byStudent = {};
  for (const r of rows) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = { studentId: r.studentId, rows: [] };
    if (r.scoreValue !== null) byStudent[r.studentId].rows.push(r);
  }

  const ranked = Object.values(byStudent)
    .map((s) => ({ studentId: s.studentId, gpa: gpa.computeGpa(gpa.subjectAverages(s.rows)) }))
    .filter((s) => s.gpa !== null)
    .sort((a, b) => b.gpa - a.gpa);

  const totalRanked = ranked.length;
  const idx = ranked.findIndex((s) => s.studentId === targetStudentId);

  if (idx === -1) return { rank: null, totalRanked };
  return { rank: idx + 1, totalRanked, gpa: ranked[idx].gpa };
}

// ── Class analytics ───────────────────────────────────────────────────────────

async function getClassAnalytics({ teacherId, classId, semesterId }) {
  if (!classId || !semesterId) throw httpError("Thiếu lớp hoặc học kỳ", 400);

  const rows = await academicModel.findClassScores(parseInt(classId, 10), parseInt(semesterId, 10));

  // Group by student
  const byStudent = {};
  for (const r of rows) {
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = { studentId: r.studentId, studentName: r.studentName, studentCode: r.studentCode, rows: [] };
    }
    if (r.scoreValue !== null) byStudent[r.studentId].rows.push(r);
  }

  const studentGpas = Object.values(byStudent).map((s) => ({
    studentId:   s.studentId,
    studentName: s.studentName,
    studentCode: s.studentCode,
    gpa:         gpa.computeGpa(gpa.subjectAverages(s.rows)),
  }));

  const withScore = studentGpas.filter((s) => s.gpa !== null);
  const totalStudents = studentGpas.length;
  const scored = withScore.length;

  const classAverage = scored > 0
    ? gpa.round2(withScore.reduce((a, s) => a + s.gpa, 0) / scored)
    : null;

  const sortedDesc = [...withScore].sort((a, b) => b.gpa - a.gpa);
  const highest = sortedDesc[0] ?? null;
  const lowest  = sortedDesc[sortedDesc.length - 1] ?? null;

  const passCount = withScore.filter((s) => s.gpa >= 5.0).length;
  const failCount = scored - passCount;

  // Grade distribution (by student GPA)
  const distribution = GRADE_BUCKETS.map((b) => ({
    key:   b.key,
    label: b.label,
    count: withScore.filter((s) => s.gpa >= b.min && s.gpa < b.max).length,
  }));

  // Subject performance: per-student subject averages → class mean per subject
  const subjectMap = {};
  for (const s of Object.values(byStudent)) {
    const subjAvgs = gpa.subjectAverages(s.rows);
    for (const sa of subjAvgs) {
      if (sa.average === null) continue;
      if (!subjectMap[sa.subjectId]) subjectMap[sa.subjectId] = { subjectName: sa.subjectName, values: [] };
      subjectMap[sa.subjectId].values.push(sa.average);
    }
  }
  const subjectPerformance = Object.values(subjectMap).map((s) => {
    const avg = gpa.round2(s.values.reduce((a, b) => a + b, 0) / s.values.length);
    return {
      subjectName: s.subjectName,
      average:     avg,
      highest:     gpa.round2(Math.max(...s.values)),
      lowest:      gpa.round2(Math.min(...s.values)),
    };
  });

  return {
    summary: {
      totalStudents,
      scored,
      classAverage,
      highest: highest ? { name: highest.studentName, gpa: highest.gpa } : null,
      lowest:  lowest  ? { name: lowest.studentName,  gpa: lowest.gpa  } : null,
      passCount,
      failCount,
      passRate: scored > 0 ? Math.round((passCount / scored) * 1000) / 10 : 0,
      failRate: scored > 0 ? Math.round((failCount / scored) * 1000) / 10 : 0,
    },
    distribution,
    subjectPerformance,
    students: sortedDesc.map((s, i) => ({ ...s, rank: i + 1, standing: getStanding(s.gpa) })),
  };
}

// Trend analysis: class average GPA across all semesters that have data.
async function getClassTrend({ classId }) {
  const semesters = await academicModel.findSemesters();
  const trend = [];
  for (const sem of semesters) {
    const rows = await academicModel.findClassScores(classId, sem.semesterId);
    const byStudent = {};
    for (const r of rows) {
      if (r.scoreValue === null) continue;
      if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
      byStudent[r.studentId].push(r);
    }
    const gpas = Object.values(byStudent)
      .map((rs) => gpa.computeGpa(gpa.subjectAverages(rs)))
      .filter((g) => g !== null);
    if (gpas.length === 0) continue;
    trend.push({
      semesterName: `${sem.semesterName} (${sem.schoolYearName})`,
      classAverage: gpa.round2(gpas.reduce((a, b) => a + b, 0) / gpas.length),
    });
  }
  return trend.reverse(); // chronological
}

// ── Academic warnings (auto-generate from thresholds) ─────────────────────────

async function generateWarnings({ teacherId, actorUserId, classId, semesterId }) {
  if (!classId || !semesterId) throw httpError("Thiếu lớp hoặc học kỳ", 400);

  const semesters = await academicModel.findSemesters();
  const targetIdx = semesters.findIndex((s) => s.semesterId === parseInt(semesterId, 10));
  // semesters are ordered active-first/newest-first; "previous" is the next one
  const prevSemester = targetIdx >= 0 ? semesters[targetIdx + 1] : null;

  const rows = await academicModel.findClassScores(parseInt(classId, 10), parseInt(semesterId, 10));

  const byStudent = {};
  for (const r of rows) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
    if (r.scoreValue !== null) byStudent[r.studentId].push(r);
  }

  const created = [];
  const notifications = [];

  for (const [studentIdStr, studentRows] of Object.entries(byStudent)) {
    const studentId = parseInt(studentIdStr, 10);
    if (studentRows.length === 0) continue;

    const subjects = gpa.subjectAverages(studentRows);
    const studentGpa = gpa.computeGpa(subjects);
    if (studentGpa === null) continue;

    const failedSubjects = subjects.filter((s) => s.passed === false).length;

    const warnings = [];
    if (studentGpa < WARNING_RULES.AT_RISK_BELOW) {
      warnings.push({ type: "AT_RISK", note: `GPA ${studentGpa} dưới ngưỡng nguy cơ (${WARNING_RULES.AT_RISK_BELOW}).` });
    } else if (studentGpa < WARNING_RULES.LOW_GPA_BELOW) {
      warnings.push({ type: "LOW_GPA", note: `GPA ${studentGpa} dưới mức đạt (${WARNING_RULES.LOW_GPA_BELOW}).` });
    }
    if (failedSubjects >= WARNING_RULES.MULTIPLE_FAIL_COUNT) {
      warnings.push({ type: "MULTIPLE_FAIL", note: `Trượt ${failedSubjects} môn trong học kỳ.` });
    }

    // Declining: compare to previous semester GPA
    if (prevSemester) {
      const prevRows = await academicModel.findStudentScores(studentId, prevSemester.semesterId);
      const prevGpa = gpa.computeGpa(gpa.subjectAverages(prevRows));
      if (prevGpa !== null && prevGpa - studentGpa >= WARNING_RULES.DECLINING_DROP) {
        warnings.push({ type: "DECLINING", note: `GPA giảm từ ${prevGpa} xuống ${studentGpa} so với kỳ trước.` });
      }
    }

    for (const w of warnings) {
      await academicModel.upsertWarning(null, {
        studentId,
        semesterId: parseInt(semesterId, 10),
        warningType: w.type,
        gpaSnapshot: studentGpa,
        failedSubjects,
        note: w.note,
        createdBy: actorUserId,
      });
      created.push({ studentId, type: w.type });

      const recipients = await academicModel.findStudentRecipients(studentId);
      for (const receiverId of recipients) {
        notifications.push({
          receiverId,
          title:   "Cảnh báo học tập",
          content: w.note,
          relatedId: studentId,
        });
      }
    }
  }

  if (notifications.length) {
    try {
      await insertNotifications(notifications);
    } catch (e) {
      console.error("generateWarnings notifications (non-critical):", e);
    }
  }

  return { generated: created.length };
}

async function updateWarning({ warningId, payload }) {
  const warning = await academicModel.findWarningById(warningId);
  if (!warning) throw httpError("Không tìm thấy cảnh báo", 404);

  const status = ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(payload.status)
    ? payload.status
    : warning.status;

  const affected = await academicModel.updateWarningIntervention(warningId, {
    note: payload.note,
    intervention: payload.intervention,
    status,
  });

  if (affected === 0) throw httpError("Không thể cập nhật cảnh báo", 409);
  return { warningId, status };
}

module.exports = {
  submitScores,
  updateScore,
  deleteScore,
  getStudentAcademic,
  getClassAnalytics,
  getClassTrend,
  generateWarnings,
  updateWarning,
};
