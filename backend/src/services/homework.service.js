const { pool } = require("../config/db");
const homeworkModel = require("../models/homework.model");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Normalize 'YYYY-MM-DDTHH:mm' (datetime-local) → 'YYYY-MM-DD HH:mm:ss' for MySQL.
function toMysqlDateTime(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

function validatePayload({ title, dueDate, maxScore }) {
  if (!title || !title.trim()) {
    throw httpError("Tiêu đề bài tập là bắt buộc", 400);
  }
  if (!dueDate) {
    throw httpError("Hạn nộp là bắt buộc", 400);
  }
  if (isNaN(Date.parse(dueDate))) {
    throw httpError("Hạn nộp không hợp lệ", 400);
  }
  const score = Number(maxScore);
  if (!Number.isFinite(score) || score <= 0) {
    throw httpError("Điểm tối đa phải lớn hơn 0", 400);
  }
  if (score > 100) {
    throw httpError("Điểm tối đa không được vượt quá 100", 400);
  }
}

/**
 * Create homework for one or more classes.
 * Each (classId + subjectId) must be a real teaching assignment of the teacher.
 * One homework row is created per class (schema is one-homework-per-class),
 * all within a single transaction.
 */
async function createHomework({ teacherId, payload }) {
  const { title, description, instructions, dueDate, maxScore, assignments, attachmentIds = [] } = payload;

  validatePayload({ title, dueDate, maxScore });

  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw httpError("Phải chọn ít nhất một lớp để giao bài", 400);
  }

  // Validate every assignment belongs to the teacher and class is active
  for (const a of assignments) {
    const ok = await homeworkModel.isAssignmentValid(
      teacherId,
      parseInt(a.classId, 10),
      parseInt(a.subjectId, 10),
    );
    if (!ok) {
      throw httpError(
        "Bạn không được phân công dạy một trong các lớp/môn đã chọn, hoặc lớp không còn hoạt động",
        403,
      );
    }
  }

  const conn = await pool.getConnection();
  const createdIds = [];
  try {
    await conn.beginTransaction();

    for (const a of assignments) {
      const homeworkId = await homeworkModel.insertHomework(conn, {
        classId:      parseInt(a.classId, 10),
        subjectId:    parseInt(a.subjectId, 10),
        teacherId,
        title:        title.trim(),
        description,
        instructions,
        maxScore:     Number(maxScore),
        dueDate:      toMysqlDateTime(dueDate),
      });

      // Attachments are linked only to the first class to avoid duplicate
      // ownership; multi-class share the same uploaded files by reference.
      if (attachmentIds.length && createdIds.length === 0) {
        await homeworkModel.linkAttachments(conn, homeworkId, attachmentIds.map((id) => parseInt(id, 10)));
      }

      createdIds.push({ homeworkId, classId: parseInt(a.classId, 10) });
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Notify students + parents of each class (non-critical, outside tx)
  try {
    for (const { homeworkId, classId } of createdIds) {
      const recipients = await homeworkModel.findClassNotificationRecipients(classId);
      await homeworkModel.insertNotifications(
        recipients,
        "Bài tập mới được giao",
        `Bạn có bài tập mới: "${title.trim()}". Hạn nộp: ${formatDueDate(dueDate)}.`,
        homeworkId,
      );
    }
  } catch (notifErr) {
    console.error("createHomework notifications (non-critical):", notifErr);
  }

  return { created: createdIds };
}

async function updateHomework({ teacherId, homeworkId, payload }) {
  const detail = await homeworkModel.findDetailById(homeworkId);

  if (!detail) throw httpError("Không tìm thấy bài tập", 404);
  if (detail.teacherId !== teacherId) {
    throw httpError("Bạn không có quyền chỉnh sửa bài tập này", 403);
  }
  if (detail.status === "CLOSED") {
    throw httpError("Bài tập đã đóng, không thể chỉnh sửa", 409);
  }

  const { title, description, instructions, dueDate, maxScore, status } = payload;
  validatePayload({ title, dueDate, maxScore });

  const nextStatus = status === "CLOSED" ? "CLOSED" : "OPEN";

  const affected = await homeworkModel.updateHomework(homeworkId, {
    title:        title.trim(),
    description,
    instructions,
    maxScore:     Number(maxScore),
    dueDate:      toMysqlDateTime(dueDate),
    status:       nextStatus,
  });

  if (affected === 0) {
    throw httpError("Không thể cập nhật. Bài tập có thể đã bị đóng.", 409);
  }

  // Notify class of the update (non-critical)
  try {
    const recipients = await homeworkModel.findClassNotificationRecipients(detail.classId);
    await homeworkModel.insertNotifications(
      recipients,
      "Bài tập đã được cập nhật",
      `Bài tập "${title.trim()}" vừa được cập nhật. Hạn nộp: ${formatDueDate(dueDate)}.`,
      homeworkId,
    );
  } catch (notifErr) {
    console.error("updateHomework notifications (non-critical):", notifErr);
  }

  return { homeworkId, status: nextStatus };
}

async function gradeSubmission({ graderUserId, teacherId, submissionId, score, feedback }) {
  const submission = await homeworkModel.findSubmissionById(submissionId);

  if (!submission) throw httpError("Không tìm thấy bài nộp", 404);
  if (submission.teacherId !== teacherId) {
    throw httpError("Bạn không có quyền chấm bài nộp này", 403);
  }

  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore < 0) {
    throw httpError("Điểm không hợp lệ", 400);
  }
  if (numScore > submission.maxScore) {
    throw httpError(`Điểm không được vượt quá điểm tối đa (${submission.maxScore})`, 400);
  }

  const isRegrade = submission.status === "GRADED";

  const notification = {
    receivers: [submission.studentUserId],
    title:     "Bài tập đã được chấm điểm",
    content:   `Bài tập "${submission.homeworkTitle}" của bạn đã được chấm: ${numScore}/${submission.maxScore} điểm.`,
    relatedId: submission.homeworkId,
  };

  await homeworkModel.applyGrade({
    submissionId,
    graderUserId,
    oldScore: submission.score,
    newScore: numScore,
    feedback,
    action:   isRegrade ? "REGRADE" : "GRADE",
    notification,
  });

  return { submissionId, score: numScore, regraded: isRegrade };
}

function formatDueDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

module.exports = {
  createHomework,
  updateHomework,
  gradeSubmission,
};
