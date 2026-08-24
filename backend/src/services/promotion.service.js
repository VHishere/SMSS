const promotionModel = require("../models/promotion.model");
const gpa = require("./gpa.service");
const { SCORE_GROUP, SCORE_TYPES } = require("../config/academic.config");

// Không lưu policy vào DB để giữ nguyên schema hiện tại.
// Nếu trường đổi quy định, chỉ cần sửa các giá trị ở đây.
const PROMOTION_POLICY = Object.freeze({
  minYearAverage: 5.0,
  subjectPassThreshold: 5.0,
  maxFailedSubjects: 1,
  firstSemesterWeight: 1,
  secondSemesterWeight: 2,
  requireCompleteScoreGroups: true,
});

function httpError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  return error;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function extractGradeNumber(text) {
  const match = String(text || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function findNextGrade(currentGrade, grades) {
  const currentNumber = extractGradeNumber(currentGrade.gradeName);
  if (currentNumber === null) return null;

  return (
    grades
      .map((grade) => ({ ...grade, gradeNumber: extractGradeNumber(grade.gradeName) }))
      .filter((grade) => grade.gradeNumber !== null && grade.gradeNumber > currentNumber)
      .sort((a, b) => a.gradeNumber - b.gradeNumber)[0] || null
  );
}

function classNameForNextGrade(fromClassName, fromGradeName, toGradeName) {
  const fromNo = extractGradeNumber(fromGradeName);
  const toNo = extractGradeNumber(toGradeName);
  const className = String(fromClassName || "").trim().toUpperCase();

  if (!fromNo || !toNo || !className.startsWith(String(fromNo))) return null;
  return `${toNo}${className.slice(String(fromNo).length)}`;
}

function semesterWeight(index) {
  if (index === 0) return PROMOTION_POLICY.firstSemesterWeight;
  if (index === 1) return PROMOTION_POLICY.secondSemesterWeight;
  return 1;
}

function buildAnnualAcademicSummary({ rows, semesters, curriculum }) {
  const scoreMap = new Map();
  for (const row of rows) {
    const key = `${row.semesterId}:${row.subjectId}`;
    if (!scoreMap.has(key)) scoreMap.set(key, []);
    scoreMap.get(key).push(row);
  }

  const curriculumMap = new Map();
  for (const item of curriculum) {
    const key = `${item.semesterId}:${item.subjectId}`;
    curriculumMap.set(key, item);
  }

  const incomplete = [];
  if (semesters.length < 2) {
    incomplete.push("Năm học chưa có đủ 2 học kỳ");
  }
  if (curriculumMap.size === 0) {
    incomplete.push("Chưa cấu hình chương trình môn học để xét cuối năm");
  }

  const subjectAnnual = new Map();

  semesters.forEach((semester, semesterIndex) => {
    const expected = [...curriculumMap.values()].filter(
      (item) => Number(item.semesterId) === Number(semester.semesterId),
    );

    if (expected.length === 0) {
      incomplete.push(`${semester.semesterName}: chưa có chương trình môn học`);
      return;
    }

    for (const subject of expected) {
      const scoreRows = scoreMap.get(`${semester.semesterId}:${subject.subjectId}`) || [];

      if (scoreRows.length === 0) {
        incomplete.push(`${subject.subjectName} - ${semester.semesterName}: chưa có điểm`);
        continue;
      }

      if (PROMOTION_POLICY.requireCompleteScoreGroups) {
        // Xét lên lớp là nghiệp vụ cuối năm nên phải chặt hơn màn hình tính ĐTB:
        // mỗi môn ở mỗi học kỳ bắt buộc đủ đúng 5 đầu điểm chính thức.
        // Không chỉ kiểm tra đủ 3 nhóm TX/GK/CK vì TX1 đơn lẻ không thể thay cho
        // toàn bộ TX1 + TX2 + TX3.
        const existingScoreTypes = new Set(
          scoreRows
            .map((row) => String(row.scoreType || "").trim().toUpperCase())
            .filter(Boolean),
        );
        const missingScoreTypes = SCORE_TYPES.filter(
          (scoreType) => !existingScoreTypes.has(scoreType),
        );

        if (missingScoreTypes.length > 0) {
          incomplete.push(
            `${subject.subjectName} - ${semester.semesterName}: thiếu đầu điểm ${missingScoreTypes.join(", ")}`,
          );
          continue;
        }

        // Giữ thêm kiểm tra nhóm để tránh cấu hình SCORE_TYPES/SCORE_GROUP bị lệch
        // trong tương lai.
        const groups = new Set(
          scoreRows.map((row) => SCORE_GROUP[row.scoreType]).filter(Boolean),
        );
        const missingGroups = ["TX", "GK", "CK"].filter((group) => !groups.has(group));
        if (missingGroups.length > 0) {
          incomplete.push(
            `${subject.subjectName} - ${semester.semesterName}: thiếu nhóm điểm ${missingGroups.join(", ")}`,
          );
          continue;
        }
      }

      const average = gpa.subjectAverage(scoreRows);
      if (average === null) {
        incomplete.push(`${subject.subjectName} - ${semester.semesterName}: chưa tính được ĐTB`);
        continue;
      }

      if (!subjectAnnual.has(subject.subjectId)) {
        subjectAnnual.set(subject.subjectId, {
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          semesterValues: [],
        });
      }

      subjectAnnual.get(subject.subjectId).semesterValues.push({
        semesterId: semester.semesterId,
        semesterName: semester.semesterName,
        average,
        weight: semesterWeight(semesterIndex),
      });
    }
  });

  const subjects = [];
  for (const subject of subjectAnnual.values()) {
    const expectedSemesterCount = semesters.filter((semester) =>
      curriculumMap.has(`${semester.semesterId}:${subject.subjectId}`),
    ).length;

    if (subject.semesterValues.length !== expectedSemesterCount) continue;

    const totalWeight = subject.semesterValues.reduce((sum, item) => sum + item.weight, 0);
    const annualAverage = round2(
      subject.semesterValues.reduce(
        (sum, item) => sum + item.average * item.weight,
        0,
      ) / totalWeight,
    );

    subjects.push({
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      annualAverage,
      passed: annualAverage >= PROMOTION_POLICY.subjectPassThreshold,
      semesters: subject.semesterValues,
    });
  }

  const academicComplete =
    incomplete.length === 0 &&
    subjects.length > 0 &&
    subjects.length === new Set(curriculum.map((item) => item.subjectId)).size;

  const yearAverage = academicComplete
    ? round2(subjects.reduce((sum, subject) => sum + subject.annualAverage, 0) / subjects.length)
    : null;

  const failedSubjects = academicComplete
    ? subjects.filter((subject) => !subject.passed)
    : [];

  return {
    academicComplete,
    incomplete,
    subjects,
    yearAverage,
    failedCount: failedSubjects.length,
    failedSubjects: failedSubjects.map((subject) => subject.subjectName),
  };
}

async function resolveTargetClass(student, targetYear, grades) {
  const nextGrade = findNextGrade(
    { gradeId: student.gradeId, gradeName: student.gradeName },
    grades,
  );
  if (!nextGrade) {
    return { isFinalGrade: true, nextGrade: null, targetClass: null };
  }

  const targetClassName = classNameForNextGrade(
    student.fromClassName,
    student.gradeName,
    nextGrade.gradeName,
  );

  if (!targetClassName) {
    return { isFinalGrade: false, nextGrade, targetClass: null };
  }

  const targetClass = await promotionModel.findClassByNameAndGrade(
    targetYear.schoolYearId,
    nextGrade.gradeId,
    targetClassName,
  );

  return { isFinalGrade: false, nextGrade, targetClass };
}

async function evaluateStudent({ student, sourceYear, targetYear, semesters, grades, attendancePolicy }) {
  const [curriculum, scoreRows, absence, existingTarget] = await Promise.all([
    promotionModel.findExpectedCurriculum(sourceYear.schoolYearId, student.gradeId),
    promotionModel.findStudentYearScores(student.studentId, sourceYear.schoolYearId),
    promotionModel.findStudentAbsence(student.studentId, sourceYear.startDate, sourceYear.endDate),
    promotionModel.findExistingTargetEnrollment(student.studentId, targetYear.schoolYearId),
  ]);

  const academic = buildAnnualAcademicSummary({
    rows: scoreRows,
    semesters,
    curriculum,
  });

  const absentPeriods =
    absence.absentUnexcused +
    (attendancePolicy.countExcused ? absence.absentExcused : 0);
  const absentSessions = round2(absentPeriods / attendancePolicy.periodsPerSession);

  let result = "ELIGIBLE";
  let reason = "";
  let toClassId = null;
  let toClassName = null;
  let requiresStaffAssignment = false;
  let invalidTargetAssignment = false;
  const existingTargetClassId = existingTarget?.classId || null;
  const existingTargetClassName = existingTarget?.className || null;
  const existingTargetGradeId = existingTarget?.gradeId || null;

  const { isFinalGrade, nextGrade, targetClass } = await resolveTargetClass(
    student,
    targetYear,
    grades,
  );

  if (!academic.academicComplete) {
    result = "PENDING_DATA";
    reason = `Chưa đủ dữ liệu điểm để xét cuối năm: ${academic.incomplete.slice(0, 3).join("; ")}${academic.incomplete.length > 3 ? "..." : ""}`;
  } else if (absentSessions > attendancePolicy.maxAbsentSessions) {
    result = "NOT_ELIGIBLE";
    reason = `Nghỉ ${absentSessions} buổi, vượt ngưỡng tối đa ${attendancePolicy.maxAbsentSessions} buổi.`;
  } else if (academic.yearAverage < PROMOTION_POLICY.minYearAverage) {
    result = "NOT_ELIGIBLE";
    reason = `Điểm trung bình năm ${academic.yearAverage} dưới ${PROMOTION_POLICY.minYearAverage}.`;
  } else if (academic.failedCount > PROMOTION_POLICY.maxFailedSubjects) {
    result = "NOT_ELIGIBLE";
    reason = `Có ${academic.failedCount} môn dưới ${PROMOTION_POLICY.subjectPassThreshold} điểm, vượt mức cho phép ${PROMOTION_POLICY.maxFailedSubjects} môn.`;
  } else if (isFinalGrade) {
    result = "GRADUATION_ELIGIBLE";
    reason = `Đủ điều kiện hoàn thành khối cuối: ĐTB ${academic.yearAverage}, nghỉ ${absentSessions}/${attendancePolicy.maxAbsentSessions} buổi.`;
  } else if (existingTarget) {
    // Học sinh đủ điều kiện chỉ được coi là "đã có lớp năm mới" khi lớp đó
    // thuộc ĐÚNG khối kế tiếp. Ví dụ khối 10 chỉ hợp lệ nếu enrollment hiện có
    // thuộc khối 11; enrollment khối 10 hoặc khối 12 đều là dữ liệu cần sửa.
    if (nextGrade && Number(existingTarget.gradeId) === Number(nextGrade.gradeId)) {
      result = "ALREADY_ENROLLED";
      toClassId = existingTarget.classId;
      toClassName = existingTarget.className;
      reason = `Đủ điều kiện và đã có lớp ${existingTarget.className} đúng khối ${nextGrade.gradeName} trong năm học ${targetYear.yearName}.`;
    } else {
      result = "INVALID_TARGET_ASSIGNMENT";
      invalidTargetAssignment = true;
      reason = `Học sinh đủ điều kiện lên ${nextGrade?.gradeName || "khối kế tiếp"} nhưng enrollment năm mới hiện tại là ${existingTarget.className}. Staff cần gỡ/xếp lại học sinh vào một lớp thuộc ${nextGrade?.gradeName || "khối kế tiếp"} trước khi chốt năm học.`;
    }
  } else if (!targetClass) {
    result = "MAPPING_MISSING";
    reason = `Đủ điều kiện học tập/chuyên cần nhưng chưa tìm thấy lớp kế tiếp tương ứng với ${student.fromClassName} trong ${targetYear.yearName}.`;
  } else {
    toClassId = targetClass.toClassId;
    toClassName = targetClass.toClassName;
    reason = `Đủ điều kiện: ĐTB năm ${academic.yearAverage}, ${academic.failedCount} môn dưới ${PROMOTION_POLICY.subjectPassThreshold}, nghỉ ${absentSessions}/${attendancePolicy.maxAbsentSessions} buổi.`;
  }

  // Với học sinh không đủ điều kiện lên khối trên, Staff sẽ là người
  // xếp lại lớp trong năm mới (thường là lớp cùng khối/lưu ban). Nếu Staff
  // đã xếp đúng cùng khối trước khi năm mới được kích hoạt thì giữ lại.
  if (result === "NOT_ELIGIBLE") {
    if (existingTarget && Number(existingTarget.gradeId) === Number(student.gradeId)) {
      toClassId = existingTarget.classId;
      toClassName = existingTarget.className;
      reason += ` Giáo vụ đã xếp lại lớp ${existingTarget.className} cùng khối ${student.gradeName} cho năm học ${targetYear.yearName}.`;
    } else {
      requiresStaffAssignment = true;

      if (existingTarget) {
        invalidTargetAssignment = true;
        reason += ` Enrollment năm mới hiện tại (${existingTarget.className}) không cùng khối ${student.gradeName} và sẽ được gỡ khi kích hoạt năm học mới; Staff cần xếp lại lớp phù hợp.`;
      } else {
        reason += ` Staff cần xếp học sinh vào một lớp phù hợp cùng khối ${student.gradeName} trong năm học ${targetYear.yearName}.`;
      }
    }
  }

  return {
    studentId: student.studentId,
    studentCode: student.studentCode,
    fullName: student.fullName,
    fromClassId: student.fromClassId,
    fromClassName: student.fromClassName,
    gradeId: student.gradeId,
    gradeName: student.gradeName,
    toClassId,
    toClassName,
    existingTargetClassId,
    existingTargetClassName,
    existingTargetGradeId,
    requiresStaffAssignment,
    invalidTargetAssignment,
    result,
    reason,
    yearAverage: academic.yearAverage,
    failedSubjects: academic.failedCount,
    failedSubjectNames: academic.failedSubjects,
    absentPeriods,
    absentSessions,
    academicComplete: academic.academicComplete,
    incompleteAcademic: academic.incomplete,
  };
}

function summarize(items) {
  const count = (status) => items.filter((item) => item.result === status).length;
  return {
    total: items.length,
    eligible: count("ELIGIBLE"),
    notEligible: count("NOT_ELIGIBLE"),
    needsStaffAssignment: items.filter(
      (item) => item.result === "NOT_ELIGIBLE" && item.requiresStaffAssignment,
    ).length,
    notEligibleAssigned: items.filter(
      (item) => item.result === "NOT_ELIGIBLE" && !item.requiresStaffAssignment,
    ).length,
    pendingData: count("PENDING_DATA"),
    mappingMissing: count("MAPPING_MISSING"),
    invalidTargetAssignments: count("INVALID_TARGET_ASSIGNMENT"),
    alreadyEnrolled: count("ALREADY_ENROLLED"),
    graduationEligible: count("GRADUATION_ELIGIBLE"),
  };
}

async function assertSchoolYearCanClose({ schoolYearId }) {
  const sourceYear = await promotionModel.findSchoolYearById(schoolYearId);
  if (!sourceYear) throw httpError("Không tìm thấy năm học", 404);

  if (sourceYear.status === "PLANNED") {
    throw httpError("Năm học ở trạng thái dự kiến nên chưa thể kết thúc.", 409);
  }

  if (sourceYear.status !== "CLOSED" && !sourceYear.hasEnded) {
    throw httpError(
      `Chỉ có thể “Kết thúc & xét” năm học ${sourceYear.yearName} sau ngày kết thúc ${sourceYear.endDate}.`,
      409,
    );
  }

  return sourceYear;
}

async function evaluateSchoolYear({ schoolYearId, targetSchoolYearId = null }) {
  const sourceYear = await promotionModel.findSchoolYearById(schoolYearId);
  if (!sourceYear) throw httpError("Không tìm thấy năm học nguồn", 404);

  const targetYear = targetSchoolYearId
    ? await promotionModel.findSchoolYearById(targetSchoolYearId)
    : await promotionModel.findNextSchoolYear(sourceYear.schoolYearId);

  if (!targetYear) {
    throw httpError(
      `Chưa có năm học kế tiếp sau ${sourceYear.yearName}. Hãy tạo năm học mới trước khi xét lên lớp.`,
      409,
    );
  }

  const [students, semesters, grades, attendancePolicy] = await Promise.all([
    promotionModel.findStudentsForSchoolYear(sourceYear.schoolYearId),
    promotionModel.findSemesters(sourceYear.schoolYearId),
    promotionModel.findGrades(),
    promotionModel.findAttendancePolicy(sourceYear.schoolYearId),
  ]);

  const items = [];
  for (const student of students) {
    // Cố ý chạy tuần tự để không bắn hàng trăm truy vấn đồng thời vào MySQL.
    // eslint-disable-next-line no-await-in-loop
    items.push(
      await evaluateStudent({
        student,
        sourceYear,
        targetYear,
        semesters,
        grades,
        attendancePolicy,
      }),
    );
  }

  return {
    sourceYear,
    targetYear,
    policy: PROMOTION_POLICY,
    attendancePolicy,
    summary: summarize(items),
    items,
  };
}

function notificationForEvaluation(item, sourceYear, targetYear) {
  if (item.result === "NOT_ELIGIBLE") {
    return {
      title: "Không đủ điều kiện lên lớp",
      content: `${item.fullName} không đủ điều kiện lên lớp sau năm học ${sourceYear.yearName}. ${item.reason}`,
    };
  }
  if (item.result === "GRADUATION_ELIGIBLE") {
    return {
      title: "Kết quả xét cuối năm",
      content: `${item.fullName} đủ điều kiện hoàn thành khối cuối sau năm học ${sourceYear.yearName}.`,
    };
  }
  return {
    title: "Đủ điều kiện lên lớp",
    content: `${item.fullName} đủ điều kiện lên lớp cho năm học ${targetYear.yearName}. ${item.toClassName ? `Lớp dự kiến: ${item.toClassName}.` : ""}`,
  };
}

async function sendEvaluationNotifications(evaluation) {
  const relatedType = `PROMO_EVAL_${evaluation.sourceYear.schoolYearId}`;
  const notifications = [];

  for (const item of evaluation.items) {
    if (!["ELIGIBLE", "NOT_ELIGIBLE", "ALREADY_ENROLLED", "GRADUATION_ELIGIBLE"].includes(item.result)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const recipients = await promotionModel.findStudentRecipients(item.studentId);
    const message = notificationForEvaluation(
      item,
      evaluation.sourceYear,
      evaluation.targetYear,
    );

    for (const receiverId of recipients) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await promotionModel.hasNotification({
        receiverId,
        studentId: item.studentId,
        relatedType,
      });
      if (!exists) {
        notifications.push({
          receiverId,
          studentId: item.studentId,
          relatedType,
          ...message,
        });
      }
    }
  }

  // Đồng thời báo cho toàn bộ Staff về các học sinh KHÔNG đủ điều kiện.
  // Đây là thông báo chuẩn bị nghiệp vụ: sau khi năm mới được kích hoạt, Staff
  // cần xếp lại các em vào lớp phù hợp cùng khối (lưu ban/học lại).
  const staffRecipients = await promotionModel.findStaffRecipients();
  const staffRelatedType = `PROMO_STAFF_REVIEW_${evaluation.sourceYear.schoolYearId}`;

  for (const item of evaluation.items) {
    if (item.result !== "NOT_ELIGIBLE") continue;

    for (const receiverId of staffRecipients) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await promotionModel.hasNotification({
        receiverId,
        studentId: item.studentId,
        relatedType: staffRelatedType,
      });
      if (!exists) {
        notifications.push({
          receiverId,
          studentId: item.studentId,
          relatedType: staffRelatedType,
          title: "Học sinh cần xếp lại lớp",
          content: `${item.fullName} (${item.studentCode}, lớp cũ ${item.fromClassName}) không đủ điều kiện lên lớp sau năm học ${evaluation.sourceYear.yearName}. ${item.reason} Sau khi kích hoạt ${evaluation.targetYear.yearName}, vui lòng xếp học sinh vào lớp phù hợp cùng khối ${item.gradeName}.`,
        });
      }
    }
  }

  await promotionModel.createNotifications(notifications);
}

async function closeSchoolYear({ schoolYearId }) {
  const sourceYear = await assertSchoolYearCanClose({ schoolYearId });

  if (sourceYear.status === "CLOSED") {
    const evaluation = await evaluateSchoolYear({ schoolYearId });
    return {
      ...evaluation,
      closed: true,
      alreadyClosed: true,
      message: `Năm học ${sourceYear.yearName} đã được đóng trước đó.`,
    };
  }

  const evaluation = await evaluateSchoolYear({ schoolYearId });
  const blockers =
    evaluation.summary.pendingData +
    evaluation.summary.mappingMissing +
    evaluation.summary.invalidTargetAssignments;

  if (blockers > 0) {
    throw httpError(
      `Chưa thể kết thúc năm học: còn ${evaluation.summary.pendingData} học sinh thiếu dữ liệu điểm, ${evaluation.summary.mappingMissing} học sinh chưa xác định được lớp kế tiếp và ${evaluation.summary.invalidTargetAssignments} học sinh đang được xếp sai khối ở năm học mới.`,
      409,
      evaluation,
    );
  }

  await promotionModel.markSchoolYearClosed(sourceYear.schoolYearId);

  try {
    await sendEvaluationNotifications(evaluation);
  } catch (error) {
    console.error("promotion evaluation notifications (non-critical):", error);
  }

  return {
    ...evaluation,
    sourceYear: await promotionModel.findSchoolYearById(sourceYear.schoolYearId),
    closed: true,
    message: `Đã kết thúc ${sourceYear.yearName}: ${evaluation.summary.eligible + evaluation.summary.alreadyEnrolled} học sinh đủ điều kiện lên lớp, ${evaluation.summary.notEligible} không đủ điều kiện, ${evaluation.summary.graduationEligible} học sinh hoàn thành khối cuối.`,
  };
}

async function applyTransitionToTarget({ targetSchoolYearId }) {
  const targetYear = await promotionModel.findSchoolYearById(targetSchoolYearId);
  if (!targetYear) throw httpError("Không tìm thấy năm học cần kích hoạt", 404);

  const sourceYear = await promotionModel.findPreviousSchoolYear(targetYear.schoolYearId);
  if (!sourceYear) {
    return {
      sourceYear: null,
      targetYear,
      processed: false,
      stats: {
        promoted: 0,
        alreadyEnrolled: 0,
        notEligible: 0,
        notEligibleAssigned: 0,
        notEligibleNeedsAssignment: 0,
        graduated: 0,
      },
      message: "Không có năm học trước để chuyển lớp.",
    };
  }

  if (sourceYear.status !== "CLOSED") {
    throw httpError(
      `Phải bấm “Kết thúc & xét” cho năm học ${sourceYear.yearName} trước khi kích hoạt ${targetYear.yearName}.`,
      409,
    );
  }

  const evaluation = await evaluateSchoolYear({
    schoolYearId: sourceYear.schoolYearId,
    targetSchoolYearId: targetYear.schoolYearId,
  });

  const blockers =
    evaluation.summary.pendingData +
    evaluation.summary.mappingMissing +
    evaluation.summary.invalidTargetAssignments;
  if (blockers > 0) {
    throw httpError(
      `Không thể kích hoạt năm học mới vì kết quả xét ${sourceYear.yearName} đang có ${blockers} trường hợp chưa hoàn tất (thiếu điểm, thiếu lớp kế tiếp hoặc enrollment sai khối).`,
      409,
      evaluation,
    );
  }

  const stats = await promotionModel.applyTransitionBatch({
    items: evaluation.items,
    sourceYear,
    targetYear,
  });

  const relatedType = `PROMOTION_${targetYear.schoolYearId}`;
  const notifications = [];
  for (const item of evaluation.items) {
    if (!["ELIGIBLE", "ALREADY_ENROLLED"].includes(item.result)) continue;
    // eslint-disable-next-line no-await-in-loop
    const recipients = await promotionModel.findStudentRecipients(item.studentId);
    for (const receiverId of recipients) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await promotionModel.hasNotification({
        receiverId,
        studentId: item.studentId,
        relatedType,
      });
      if (!exists) {
        notifications.push({
          receiverId,
          studentId: item.studentId,
          relatedType,
          title: "Đã xếp lớp năm học mới",
          content: `${item.fullName} đã được xếp vào ${item.toClassName} cho năm học ${targetYear.yearName}.`,
        });
      }
    }
  }

  // Sau khi năm mới được kích hoạt, nhắc Staff chính xác các học sinh vẫn
  // chưa có lớp mới. Nếu Staff đã xếp một lớp cùng khối từ trước thì không gửi
  // yêu cầu này nữa.
  const staffRecipients = await promotionModel.findStaffRecipients();
  const staffRelatedType = `PROMO_STAFF_ASSIGN_${targetYear.schoolYearId}`;
  for (const item of evaluation.items) {
    if (item.result !== "NOT_ELIGIBLE" || !item.requiresStaffAssignment) continue;

    for (const receiverId of staffRecipients) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await promotionModel.hasNotification({
        receiverId,
        studentId: item.studentId,
        relatedType: staffRelatedType,
      });
      if (!exists) {
        notifications.push({
          receiverId,
          studentId: item.studentId,
          relatedType: staffRelatedType,
          title: "Cần xếp lớp năm học mới",
          content: `${item.fullName} (${item.studentCode}) không đủ điều kiện lên khối trên và hiện chưa có lớp phù hợp trong ${targetYear.yearName}. Vui lòng xếp học sinh vào một lớp cùng khối ${item.gradeName}.`,
        });
      }
    }
  }

  try {
    await promotionModel.createNotifications(notifications);
  } catch (error) {
    console.error("promotion notifications (non-critical):", error);
  }

  return {
    ...evaluation,
    processed: true,
    stats,
    message: `Đã áp dụng kết quả ${sourceYear.yearName}: ${stats.promoted} học sinh được tự động xếp lớp mới, ${stats.alreadyEnrolled} học sinh đã có lớp, ${stats.notEligible} học sinh không đủ điều kiện (${stats.notEligibleNeedsAssignment} học sinh cần Staff xếp lại lớp), ${stats.graduated} học sinh hoàn thành khối cuối.`,
  };
}

module.exports = {
  PROMOTION_POLICY,
  applyTransitionToTarget,
  assertSchoolYearCanClose,
  closeSchoolYear,
  evaluateSchoolYear,
};
