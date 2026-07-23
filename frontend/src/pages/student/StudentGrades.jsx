import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import LessonFeedbackCard from "../../components/organisms/LessonFeedbackCard";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useStudentGrades } from "../../hooks/useStudentGrades";
import { studentApi } from "../../api/client";

const EXTRA_SUBJECTS = [
  {
    subjectId: "extra-self-management",
    subjectName: "Quản lý bản thân",
    subjectCode: "QLBT",
  },
  {
    subjectId: "extra-self-education",
    subjectName: "Giáo dục bản thân",
    subjectCode: "GDBT",
  },
  {
    subjectId: "extra-stem",
    subjectName: "STEM",
    subjectCode: "STEM",
  },
  {
    subjectId: "extra-vovinam",
    subjectName: "Vovinam",
    subjectCode: "VOVINAM",
  },
];

const SCORE_SLOTS = [
  { key: "tx1", label: "Miệng", weight: 1 },
  { key: "tx2", label: "15 phút", weight: 1 },
  { key: "tx3", label: "15 phút", weight: 1 },
  { key: "onePeriod", label: "Giữa kỳ", weight: 2 },
  { key: "final", label: "Cuối kỳ", weight: 3 },
];

const SUBJECT_ORDER = [
  "toan",
  "ngu van",
  "tieng anh",
  "tin hoc",
  "vat ly",
  "hoa hoc",
  "sinh hoc",
  "lich su",
  "dia ly",
  "giao duc cong dan",
  "cong nghe",
  "quan ly ban than",
  "giao duc ban than",
  "stem",
  "vovinam",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeCode(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getYearKey(item) {
  if (item?.schoolYearId) {
    return `year-${item.schoolYearId}`;
  }

  return `year-${normalizeCode(item?.schoolYearName)}`;
}

function getSemesterKey(item) {
  if (item?.semesterId) {
    return `semester-${item.semesterId}`;
  }

  return `semester-${normalizeCode(item?.semesterName)}`;
}

function getSubjectKey(item) {
  if (item?.subjectId) {
    return `subject-${item.subjectId}`;
  }

  return `subject-${normalizeCode(item?.subjectName || item?.subjectCode)}`;
}

function dateValue(value) {
  const result = new Date(value || "").getTime();

  return Number.isNaN(result) ? 0 : result;
}

function isExtraSubject(subjectName) {
  const normalizedName = normalizeText(subjectName);

  return EXTRA_SUBJECTS.some(
    (subject) => normalizeText(subject.subjectName) === normalizedName,
  );
}

function subjectSortIndex(subjectName) {
  const normalizedName = normalizeText(subjectName);
  const index = SUBJECT_ORDER.indexOf(normalizedName);

  return index === -1 ? 999 : index;
}

function sortSubjects(subjects) {
  return [...subjects].sort((first, second) => {
    const firstExtra = first.isExtra ? 1 : 0;
    const secondExtra = second.isExtra ? 1 : 0;

    if (firstExtra !== secondExtra) {
      return firstExtra - secondExtra;
    }

    const firstIndex = subjectSortIndex(first.subjectName);
    const secondIndex = subjectSortIndex(second.subjectName);

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return first.subjectName.localeCompare(second.subjectName);
  });
}

function mergeSubjectCatalog(subjects = []) {
  const subjectMap = new Map();

  subjects.forEach((subject) => {
    const key = normalizeText(subject.subjectName);

    if (key && !subjectMap.has(key)) {
      subjectMap.set(key, subject);
    }
  });

  EXTRA_SUBJECTS.forEach((subject) => {
    const key = normalizeText(subject.subjectName);

    if (!subjectMap.has(key)) {
      subjectMap.set(key, subject);
    }
  });

  return Array.from(subjectMap.values());
}

function formatScore(score) {
  if (score === null || score === undefined || score === "") {
    return "--";
  }

  const numberValue = Number(score);

  if (Number.isNaN(numberValue)) {
    return score;
  }

  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(1);
}

function scoreColor(score) {
  const value = Number(score);

  if (Number.isNaN(value)) {
    return "bg-slate-100 text-slate-500";
  }

  if (value >= 8) {
    return "bg-green-50 text-green-700";
  }

  if (value >= 6.5) {
    return "bg-blue-50 text-[#08509F]";
  }

  if (value >= 5) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-600";
}

function detectScoreSlot(scoreType) {
  const type = normalizeCode(scoreType).toUpperCase();

  if (["TX1", "REGULAR_1", "FREQUENT_1", "THUONG_XUYEN_1"].includes(type)) {
    return "tx1";
  }

  if (["TX2", "REGULAR_2", "FREQUENT_2", "THUONG_XUYEN_2"].includes(type)) {
    return "tx2";
  }

  if (["TX3", "REGULAR_3", "FREQUENT_3", "THUONG_XUYEN_3"].includes(type)) {
    return "tx3";
  }

  if (
    [
      "ONE_PERIOD",
      "ONE_PERIOD_TEST",
      "MOT_TIET",
      "PERIOD_TEST",
      "MIDTERM",
      "MID_TERM",
    ].includes(type)
  ) {
    return "onePeriod";
  }

  if (["FINAL", "FINAL_EXAM", "CUOI_KY", "END_TERM"].includes(type)) {
    return "final";
  }

  return "regular";
}

function getNextRegularSlot(scores) {
  if (!scores.tx1) return "tx1";
  if (!scores.tx2) return "tx2";
  if (!scores.tx3) return "tx3";

  return null;
}

function createEmptyScores() {
  return {
    tx1: null,
    tx2: null,
    tx3: null,
    onePeriod: null,
    final: null,
  };
}

function createSubjectRow(subject) {
  return {
    subjectKey: getSubjectKey(subject),
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
    subjectCode: subject.subjectCode,
    isExtra: isExtraSubject(subject.subjectName),
    scores: createEmptyScores(),
    comments: [],
  };
}

function putGradeIntoSubjectRow(row, grade) {
  const detectedSlot = detectScoreSlot(grade.scoreType);

  let targetSlot = detectedSlot;

  if (detectedSlot === "regular") {
    targetSlot = getNextRegularSlot(row.scores);
  }

  if (!targetSlot) return;

  row.scores[targetSlot] = grade;

  if (grade.comment) {
    row.comments.push(grade.comment);
  }
}

function calculateSubjectAverage(scores) {
  // ĐTB = (ĐĐGtx×1 + Giữa kỳ×2 + Cuối kỳ×3)/6. ĐĐGtx = TRUNG BÌNH các đầu điểm
  // thường xuyên (miệng + 15 phút); mẫu số = tổng hệ số nhóm CÓ điểm.
  const val = (key) => {
    const grade = scores[key];
    if (!grade || grade.scoreValue === null || grade.scoreValue === undefined) {
      return null;
    }
    const scoreValue = Number(grade.scoreValue);
    return Number.isNaN(scoreValue) ? null : scoreValue;
  };

  const groups = [
    { vals: ["tx1", "tx2", "tx3"].map(val).filter((v) => v !== null), weight: 1 },
    { vals: [val("onePeriod")].filter((v) => v !== null), weight: 2 },
    { vals: [val("final")].filter((v) => v !== null), weight: 3 },
  ];

  let total = 0;
  let totalWeight = 0;

  for (const grp of groups) {
    if (!grp.vals.length) continue;
    const avg = grp.vals.reduce((a, b) => a + b, 0) / grp.vals.length;
    total += avg * grp.weight;
    totalWeight += grp.weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return (total / totalWeight).toFixed(2);
}

function ensureYear(yearMap, item) {
  const yearKey = getYearKey(item);

  if (!yearMap.has(yearKey)) {
    yearMap.set(yearKey, {
      key: yearKey,
      label: item.schoolYearName || item.yearName || "Năm học",
      startDate: item.schoolYearStartDate || item.startDate || "",
      endDate: item.schoolYearEndDate || item.endDate || "",
      isActive: item.isActive || item.schoolYearIsActive || false,
      semesters: new Map(),
    });
  }

  return yearMap.get(yearKey);
}

function ensureSemester(year, item) {
  const semesterKey = getSemesterKey(item);

  if (!year.semesters.has(semesterKey)) {
    year.semesters.set(semesterKey, {
      key: semesterKey,
      label: item.semesterName || "Học kỳ",
      startDate: item.semesterStartDate || "",
      endDate: item.semesterEndDate || "",
      subjects: new Map(),
    });
  }

  return year.semesters.get(semesterKey);
}

function buildGradeHistory(data) {
  const yearMap = new Map();
  const subjectCatalog = mergeSubjectCatalog(data?.subjects || []);

  (data?.schoolYears || []).forEach((item) => {
    const year = ensureYear(yearMap, item);
    ensureSemester(year, item);
  });

  (data?.grades || []).forEach((grade) => {
    const year = ensureYear(yearMap, grade);
    const semester = ensureSemester(year, grade);
    const subjectKey = getSubjectKey(grade);

    if (!semester.subjects.has(subjectKey)) {
      semester.subjects.set(
        subjectKey,
        createSubjectRow({
          subjectId: grade.subjectId,
          subjectName: grade.subjectName,
          subjectCode: grade.subjectCode,
        }),
      );
    }

    putGradeIntoSubjectRow(semester.subjects.get(subjectKey), grade);
  });

  yearMap.forEach((year) => {
    year.semesters.forEach((semester) => {
      subjectCatalog.forEach((subject) => {
        const subjectKey = getSubjectKey(subject);

        if (!semester.subjects.has(subjectKey)) {
          semester.subjects.set(subjectKey, createSubjectRow(subject));
        }
      });
    });
  });

  return Array.from(yearMap.values())
    .sort((first, second) => {
      const dateDiff = dateValue(second.startDate) - dateValue(first.startDate);

      if (dateDiff !== 0) return dateDiff;

      return second.label.localeCompare(first.label);
    })
    .map((year) => ({
      ...year,
      semesters: Array.from(year.semesters.values())
        .sort((first, second) => {
          const dateDiff = dateValue(first.startDate) - dateValue(second.startDate);

          if (dateDiff !== 0) return dateDiff;

          return first.label.localeCompare(second.label);
        })
        .map((semester) => ({
          ...semester,
          subjects: sortSubjects(Array.from(semester.subjects.values())),
        })),
    }));
}

function ScoreCell({ grade }) {
  if (!grade) {
    return (
      <span className="inline-flex min-w-14 items-center justify-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-400">
        --
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-w-14 items-center justify-center rounded-full px-3 py-1.5 text-sm font-bold ${scoreColor(
        grade.scoreValue,
      )}`}
    >
      {formatScore(grade.scoreValue)}
    </span>
  );
}

function SubjectBadge({ isExtra }) {
  if (isExtra) {
    return (
      <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
        Môn bổ sung
      </span>
    );
  }

  return (
    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#08509F]">
      Môn học chính
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <label className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      <span className="whitespace-nowrap text-sm font-semibold text-slate-500">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="
          h-10 w-full rounded-xl sm:min-w-36
          border border-orange-100 bg-white
          px-3 text-sm font-semibold
          text-[#0F2747] shadow-sm
          outline-none transition
          focus:border-[#F27123]
          focus:ring-2 focus:ring-orange-100
        "
      >
        {options.map((option) => (
          <option
            key={option.key}
            value={option.key}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GradeSubjectMobileCard({ semester, subject }) {
  const average = calculateSubjectAverage(subject.scores);
  const comment =
    subject.comments.length > 0
      ? subject.comments[0]
      : "Chưa có nhận xét";

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SubjectBadge isExtra={subject.isExtra} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              {subject.subjectCode || "Chưa có mã môn"}
            </span>
          </div>

          <h4 className="mb-0 break-words text-base font-bold text-[#0F2747]">
            {subject.subjectName}
          </h4>
        </div>

        <div className="shrink-0 text-right">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            TB môn
          </p>
          <span
            className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1.5 text-sm font-bold ${
              average ? scoreColor(average) : "bg-slate-100 text-slate-400"
            }`}
          >
            {average || "--"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCORE_SLOTS.map((slot) => (
          <div
            key={`${semester.key}-${subject.subjectKey}-${slot.key}`}
            className="rounded-2xl bg-slate-50 px-3 py-3"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {slot.label} · Hệ số {slot.weight}
            </p>
            <ScoreCell grade={subject.scores[slot.key]} />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl bg-[#FFF7F2] px-4 py-3 text-sm leading-6 text-slate-600">
        <span className="font-bold text-[#0F2747]">Nhận xét: </span>
        {comment}
      </div>
    </article>
  );
}

function GradeSemesterTable({ semester }) {
  const mainSubjects = semester.subjects.filter(
    (subject) => !subject.isExtra,
  );

  const extraSubjects = semester.subjects.filter(
    (subject) => subject.isExtra,
  );

  const sections = [
    {
      key: "main",
      title: "Môn học chính",
      subjects: mainSubjects,
    },
    {
      key: "extra",
      title: "Môn bổ sung",
      subjects: extraSubjects,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
      <div className="flex flex-col items-start justify-between gap-3 border-b border-orange-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div>
          <h3 className="mb-1 text-base font-bold text-[#0F2747]">
            {semester.label}
          </h3>
        </div>

        <span className="rounded-full bg-[#FFF7F2] px-4 py-2 text-xs font-bold text-[#F27123]">
          {semester.startDate || "?"} - {semester.endDate || "?"}
        </span>
      </div>

      <div className="space-y-4 bg-slate-50/40 p-3 md:hidden">
        {sections.map((section) => {
          if (section.subjects.length === 0) return null;

          return (
            <div key={`${semester.key}-${section.key}`} className="space-y-3">
              <div className="rounded-full bg-[#FFF7F2] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#F27123]">
                {section.title}
              </div>

              {section.subjects.map((subject) => (
                <GradeSubjectMobileCard
                  key={`${semester.key}-${subject.subjectKey}`}
                  semester={semester}
                  subject={subject}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px]">
          <thead className="bg-[#0F2747] text-white">
            <tr>
              <th className="w-[260px] px-5 py-4 text-left text-sm font-bold">
                Môn học
              </th>

              {SCORE_SLOTS.map((slot) => (
                <th
                  key={slot.key}
                  className="px-4 py-4 text-center text-sm font-bold"
                >
                  <div>{slot.label}</div>
                  <div className="mt-1 text-[11px] font-medium text-white/70">
                    Hệ số {slot.weight}
                  </div>
                </th>
              ))}

              <th className="px-4 py-4 text-center text-sm font-bold">
                TB môn
              </th>

              <th className="w-[240px] px-5 py-4 text-left text-sm font-bold">
                Nhận xét
              </th>
            </tr>
          </thead>

          <tbody>
            {sections.map((section) => {
              if (section.subjects.length === 0) return null;

              return (
                <Fragment key={section.key}>
                  <tr>
                    <td
                      colSpan={8}
                      className="bg-[#FFF7F2] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#F27123]"
                    >
                      {section.title}
                    </td>
                  </tr>

                  {section.subjects.map((subject) => {
                    const average = calculateSubjectAverage(subject.scores);

                    const comment =
                      subject.comments.length > 0
                        ? subject.comments[0]
                        : "Chưa có nhận xét";

                    return (
                      <tr
                        key={`${semester.key}-${subject.subjectKey}`}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <SubjectBadge isExtra={subject.isExtra} />
                          </div>

                          <p className="mb-1 text-sm font-bold text-[#0F2747]">
                            {subject.subjectName}
                          </p>

                          <p className="mb-0 text-xs text-slate-500">
                            {subject.subjectCode || "Chưa có mã môn"}
                          </p>
                        </td>

                        {SCORE_SLOTS.map((slot) => (
                          <td
                            key={`${subject.subjectKey}-${slot.key}`}
                            className="px-4 py-4 text-center"
                          >
                            <ScoreCell grade={subject.scores[slot.key]} />
                          </td>
                        ))}

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1.5 text-sm font-bold ${
                              average
                                ? scoreColor(average)
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {average || "--"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {comment}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentGrades() {
  const { user } = useAuth();

  const {
    data,
    loading,
    error,
  } = useStudentGrades();

  const [selectedYearKey, setSelectedYearKey] =
    useState("");

  const [selectedSemesterKey, setSelectedSemesterKey] =
    useState("ALL");

  const headerUser = useMemo(() => {
    const studentRole = user?.roles?.find(
      (role) => role.roleName === "STUDENT",
    );

    return {
      name:
        data?.context?.fullName ||
        user?.fullName ||
        user?.username ||
        "Học sinh",
      role: studentRole?.description || "Học sinh",
      avatar: data?.context?.avatar || user?.avatar || "",
    };
  }, [data, user]);

  const history = useMemo(
    () => buildGradeHistory(data),
    [data],
  );

  const yearOptions = useMemo(
    () =>
      history.map((year) => ({
        key: year.key,
        label: year.isActive
          ? `${year.label} - hiện tại`
          : year.label,
      })),
    [history],
  );

  const activeYearKey =
    selectedYearKey || yearOptions[0]?.key || "";

  const selectedYear = useMemo(
    () =>
      history.find(
        (year) => year.key === activeYearKey,
      ),
    [history, activeYearKey],
  );

  const semesterOptions = useMemo(() => {
    const semesters = selectedYear?.semesters || [];

    return [
      {
        key: "ALL",
        label: "Tất cả học kỳ",
      },
      ...semesters.map((semester) => ({
        key: semester.key,
        label: semester.label,
      })),
    ];
  }, [selectedYear]);

  const visibleSemesters = useMemo(() => {
    if (!selectedYear) {
      return [];
    }

    if (selectedSemesterKey === "ALL") {
      return selectedYear.semesters;
    }

    return selectedYear.semesters.filter(
      (semester) => semester.key === selectedSemesterKey,
    );
  }, [selectedYear, selectedSemesterKey]);

  useEffect(() => {
    if (yearOptions.length === 0) {
      return;
    }

    const exists = yearOptions.some(
      (year) => year.key === selectedYearKey,
    );

    if (!selectedYearKey || !exists) {
      setSelectedYearKey(yearOptions[0].key);
    }
  }, [yearOptions, selectedYearKey]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        data?.context?.schoolYearName || "Chưa cập nhật"
      }
    >
      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải bảng điểm...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được bảng điểm: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-5 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <FilterSelect
              label="Năm học"
              value={activeYearKey}
              options={yearOptions}
              onChange={(value) => {
                setSelectedYearKey(value);
                setSelectedSemesterKey("ALL");
              }}
            />

            <FilterSelect
              label="Học kỳ"
              value={selectedSemesterKey}
              options={semesterOptions}
              onChange={setSelectedSemesterKey}
            />
          </section>

          <section className="mb-5">
            <LessonFeedbackCard fetcher={studentApi.getMyLessonFeedback} />
          </section>

          <section className="space-y-5">
            {visibleSemesters.length > 0 ? (
              visibleSemesters.map((semester) => (
                <GradeSemesterTable
                  key={semester.key}
                  semester={semester}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                Hiện chưa có dữ liệu điểm cho năm học này.
              </div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}

export default StudentGrades;