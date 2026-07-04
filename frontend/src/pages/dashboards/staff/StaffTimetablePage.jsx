import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit3,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffFormCard, {
  StaffField,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const WEEK_DAYS = [
  { value: 2, label: "Thứ 2", offset: 0 },
  { value: 3, label: "Thứ 3", offset: 1 },
  { value: 4, label: "Thứ 4", offset: 2 },
  { value: 5, label: "Thứ 5", offset: 3 },
  { value: 6, label: "Thứ 6", offset: 4 },
  { value: 7, label: "Thứ 7", offset: 5 },
];

const PERIODS = [
  { periodNo: 1, session: "MORNING", startTime: "07:30", endTime: "08:15" },
  { periodNo: 2, session: "MORNING", startTime: "08:20", endTime: "09:05" },
  { periodNo: 3, session: "MORNING", startTime: "09:25", endTime: "10:10" },
  { periodNo: 4, session: "MORNING", startTime: "10:20", endTime: "11:05" },
  { periodNo: 5, session: "AFTERNOON", startTime: "13:30", endTime: "14:15" },
  { periodNo: 6, session: "AFTERNOON", startTime: "14:20", endTime: "15:05" },
  { periodNo: 7, session: "AFTERNOON", startTime: "15:25", endTime: "16:10" },
  { periodNo: 8, session: "AFTERNOON", startTime: "16:15", endTime: "17:00" },
];

const emptyLessonForm = {
  timetableId: null,
  dayOfWeek: "2",
  periodNo: "1",
  subjectId: "",
  teacherId: "",
  roomName: "",
};

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getMonday(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function buildSlotKey(dayOfWeek, periodNo) {
  return `${dayOfWeek}-${periodNo}`;
}

function StaffTimetablePage() {
  const [lookups, setLookups] = useState({
    schoolYears: [],
    grades: [],
    subjects: [],
  });
  const [classes, setClasses] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [filters, setFilters] = useState({
    schoolYearId: "",
    gradeId: "",
    classId: "",
  });
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);
  const [weekStart, setWeekStart] = useState(getMonday());
  const [savingLesson, setSavingLesson] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        setLookups(res.data);
        const activeYear =
          res.data.schoolYears?.find((year) => year.isActive) ||
          res.data.schoolYears?.[0];

        if (activeYear) {
          setFilters((prev) => ({
            ...prev,
            schoolYearId: String(activeYear.schoolYearId),
          }));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!filters.schoolYearId) return;

    staffApi
      .getClasses({
        schoolYearId: filters.schoolYearId,
        gradeId: filters.gradeId || undefined,
      })
      .then((res) => {
        const items = res.data || [];
        setClasses(items);
        setFilters((prev) => {
          const stillExists = items.some(
            (item) => String(item.classId) === prev.classId,
          );
          return {
            ...prev,
            classId: stillExists ? prev.classId : String(items[0]?.classId || ""),
          };
        });
      })
      .catch((err) => setError(err.message));
  }, [filters.schoolYearId, filters.gradeId]);

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.classId) === filters.classId),
    [classes, filters.classId],
  );

  const selectedYear = useMemo(
    () =>
      lookups.schoolYears.find(
        (year) => String(year.schoolYearId) === filters.schoolYearId,
      ),
    [filters.schoolYearId, lookups.schoolYears],
  );

  const weekDays = useMemo(
    () =>
      WEEK_DAYS.map((day) => ({
        ...day,
        date: addDays(weekStart, day.offset),
      })),
    [weekStart],
  );

  const slotMap = useMemo(() => {
    const map = new Map();
    timetable.forEach((lesson) => {
      map.set(buildSlotKey(lesson.dayOfWeek, lesson.periodNo), lesson);
    });
    return map;
  }, [timetable]);

  const assignedSubjects = useMemo(() => {
    const subjectIds = new Set(
      (classInfo?.teachers || [])
        .map((teacher) => teacher.subjectId)
        .filter(Boolean)
        .map(String),
    );
    const fromAssignments = lookups.subjects.filter((subject) =>
      subjectIds.has(String(subject.subjectId)),
    );
    return fromAssignments.length ? fromAssignments : lookups.subjects;
  }, [classInfo?.teachers, lookups.subjects]);

  const loadClassTimetable = useCallback(() => {
    if (!filters.classId) return;

    Promise.all([
      staffApi.getClass(filters.classId),
      staffApi.getClassTimetable(filters.classId),
    ])
      .then(([classRes, timetableRes]) => {
        setClassInfo(classRes.data);
        setTimetable(timetableRes.data || []);
        setLessonForm((prev) => ({
          ...prev,
          roomName: prev.roomName || classRes.data?.roomName || "",
        }));
      })
      .catch((err) => setError(err.message));
  }, [filters.classId]);

  useEffect(() => {
    loadClassTimetable();
  }, [loadClassTimetable]);

  const resetLessonForm = () => {
    setLessonForm({
      ...emptyLessonForm,
      roomName: classInfo?.roomName || selectedClass?.roomName || "",
    });
  };

  const updateFilter = (key, value) => {
    if (key === "schoolYearId" || key === "gradeId" || key === "classId") {
      setClassInfo(null);
      setTimetable([]);
      setLessonForm(emptyLessonForm);
    }

    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "schoolYearId" ? { gradeId: "", classId: "" } : {}),
      ...(key === "gradeId" ? { classId: "" } : {}),
    }));
    setError("");
    setSuccess("");
  };

  const selectEmptySlot = (dayOfWeek, periodNo) => {
    setLessonForm({
      ...emptyLessonForm,
      dayOfWeek: String(dayOfWeek),
      periodNo: String(periodNo),
      roomName: classInfo?.roomName || selectedClass?.roomName || "",
    });
    setSuccess("");
    setError("");
  };

  const handleEditLesson = (lesson) => {
    setLessonForm({
      timetableId: lesson.timetableId,
      dayOfWeek: String(lesson.dayOfWeek),
      periodNo: String(lesson.periodNo),
      subjectId: String(lesson.subjectId),
      teacherId: String(lesson.teacherId),
      roomName: lesson.roomName || "",
    });
    setSuccess("");
    setError("");
  };

  const handleSaveLesson = (event) => {
    event.preventDefault();
    if (!filters.classId) return;

    setSavingLesson(true);
    setError("");
    setSuccess("");

    const payload = {
      dayOfWeek: Number(lessonForm.dayOfWeek),
      periodNo: Number(lessonForm.periodNo),
      subjectId: Number(lessonForm.subjectId),
      teacherId: Number(lessonForm.teacherId),
      roomName: lessonForm.roomName,
    };

    const request = lessonForm.timetableId
      ? staffApi.updateClassTimetableLesson(
          filters.classId,
          lessonForm.timetableId,
          payload,
        )
      : staffApi.createClassTimetableLesson(filters.classId, payload);

    request
      .then((res) => {
        setTimetable(res.data || []);
        setSuccess(
          lessonForm.timetableId
            ? "Đã cập nhật tiết học"
            : "Đã thêm tiết học vào thời khóa biểu",
        );
        resetLessonForm();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSavingLesson(false));
  };

  const handleDeleteLesson = (lesson) => {
    if (!window.confirm("Xóa tiết học này khỏi thời khóa biểu?")) return;

    staffApi
      .deleteClassTimetableLesson(filters.classId, lesson.timetableId)
      .then((res) => {
        setTimetable(res.data || []);
        resetLessonForm();
      })
      .catch((err) => setError(err.message));
  };

  return (
    <>
      <StaffPageHeader
        title="Thêm lịch học"
        action={
          <button
            type="button"
            onClick={loadClassTimetable}
            className="inline-flex items-center gap-2 rounded-xl border border-[#08509F] bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:bg-blue-50"
          >
            <FiRefreshCw />
            Tải lại
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(360px,auto)]">
          <StaffField label="Năm học">
            <select
              className={inputClass}
              value={filters.schoolYearId}
              onChange={(event) => updateFilter("schoolYearId", event.target.value)}
            >
              {lookups.schoolYears.map((year) => (
                <option key={year.schoolYearId} value={year.schoolYearId}>
                  {year.yearName}
                </option>
              ))}
            </select>
          </StaffField>
          <StaffField label="Khối">
            <select
              className={inputClass}
              value={filters.gradeId}
              onChange={(event) => updateFilter("gradeId", event.target.value)}
            >
              <option value="">Tất cả khối</option>
              {lookups.grades.map((grade) => (
                <option key={grade.gradeId} value={grade.gradeId}>
                  {grade.gradeName}
                </option>
              ))}
            </select>
          </StaffField>
          <StaffField label="Lớp">
            <select
              className={inputClass}
              value={filters.classId}
              onChange={(event) => updateFilter("classId", event.target.value)}
            >
              {classes.length === 0 && <option value="">Chưa có lớp</option>}
              {classes.map((item) => (
                <option key={item.classId} value={item.classId}>
                  {item.className}
                </option>
              ))}
            </select>
          </StaffField>
          <div className="grid grid-cols-[auto_1fr_auto] items-end gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#08509F] transition hover:bg-blue-50"
              title="Tuần trước"
            >
              <FiChevronLeft />
            </button>
            <StaffField label="Tuần học">
              <input
                type="date"
                className={inputClass}
                value={toDateInputValue(weekStart)}
                onChange={(event) => setWeekStart(getMonday(event.target.value))}
              />
            </StaffField>
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#08509F] transition hover:bg-blue-50"
              title="Tuần sau"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[#FFF7F2] px-3 py-1 font-semibold text-[#F27123]">
            {selectedYear?.yearName || "Chưa chọn năm học"}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-[#08509F]">
            {classInfo?.className || selectedClass?.className || "Chưa chọn lớp"}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
            {timetable.length} tiết học
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          <div className="border-b border-orange-100 px-5 py-4">
            <h2 className="mb-1 text-lg font-bold text-[#0F2747]">
              Thời khóa biểu tuần
            </h2>
            <p className="mb-0 text-sm text-slate-500">
              Bấm vào ô trống để thêm tiết học, hoặc bấm nút sửa trong ô đã có lịch.
            </p>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[1120px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-slate-200">
              <thead>
                <tr className="bg-[#0F2747] text-white">
                  <th className="sticky left-0 z-30 w-24 border-r border-white/10 bg-[#0F2747] px-4 py-4 text-center text-sm font-bold">
                    Tiết
                  </th>
                  <th className="sticky left-24 z-30 w-40 border-r border-white/10 bg-[#0F2747] px-4 py-4 text-left text-sm font-bold">
                    Thời gian
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.value}
                      className="min-w-40 border-r border-white/10 px-4 py-4 text-center text-sm font-bold last:border-r-0"
                    >
                      <span className="block">{day.label}</span>
                      <span className="block text-xs font-semibold text-white/70">
                        {formatDate(day.date)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr
                    key={period.periodNo}
                    className={period.session === "MORNING" ? "bg-[#FFF7F2]/45" : "bg-blue-50/30"}
                  >
                    <th className="sticky left-0 z-20 border-r border-b border-slate-200 bg-white px-4 py-3 text-center align-middle">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-[#F27123]">
                        {period.periodNo}
                      </span>
                    </th>
                    <th className="sticky left-24 z-20 border-r border-b border-slate-200 bg-white px-4 py-3 text-left align-middle">
                      <p className="mb-0 text-sm font-semibold text-[#0F2747]">
                        {period.startTime} - {period.endTime}
                      </p>
                    </th>
                    {weekDays.map((day) => {
                      const lesson = slotMap.get(
                        buildSlotKey(day.value, period.periodNo),
                      );

                      return (
                        <td
                          key={`${day.value}-${period.periodNo}`}
                          className="border-r border-b border-slate-200 bg-white/70 p-2 align-top last:border-r-0"
                        >
                          {lesson ? (
                            <article className="min-h-28 rounded-xl border border-orange-100 bg-white p-3 shadow-sm">
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                                    {lesson.subjectName}
                                  </h3>
                                  <p className="mb-1 text-xs text-slate-600">
                                    {lesson.teacherName || "Chưa phân công giáo viên"}
                                  </p>
                                  <p className="mb-0 text-xs font-semibold text-[#08509F]">
                                    {lesson.roomName || classInfo?.roomName || "Chưa có phòng"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditLesson(lesson)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#08509F] transition hover:bg-blue-50"
                                    title="Sửa tiết học"
                                  >
                                    <FiEdit3 />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLesson(lesson)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:bg-red-50"
                                    title="Xóa tiết học"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </div>
                            </article>
                          ) : (
                            <button
                              type="button"
                              onClick={() => selectEmptySlot(day.value, period.periodNo)}
                              className="flex min-h-28 w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/75 text-sm font-semibold text-slate-400 transition hover:border-[#F27123] hover:bg-[#FFF7F2] hover:text-[#F27123]"
                            >
                              <span className="inline-flex items-center gap-2">
                                <FiPlus />
                                Thêm tiết
                              </span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside>
          <StaffFormCard
            title={lessonForm.timetableId ? "Sửa tiết học" : "Thêm tiết học"}
            onSubmit={handleSaveLesson}
            submitLabel={lessonForm.timetableId ? "Cập nhật" : "Thêm tiết"}
            loading={savingLesson}
          >
            <StaffField label="Thứ">
              <select
                className={inputClass}
                value={lessonForm.dayOfWeek}
                onChange={(event) =>
                  setLessonForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))
                }
              >
                {WEEK_DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Tiết">
              <select
                className={inputClass}
                value={lessonForm.periodNo}
                onChange={(event) =>
                  setLessonForm((prev) => ({ ...prev, periodNo: event.target.value }))
                }
              >
                {PERIODS.map((period) => (
                  <option key={period.periodNo} value={period.periodNo}>
                    Tiết {period.periodNo} ({period.startTime}-{period.endTime})
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Môn học">
              <select
                className={inputClass}
                value={lessonForm.subjectId}
                onChange={(event) =>
                  setLessonForm((prev) => ({ ...prev, subjectId: event.target.value }))
                }
                required
              >
                <option value="">Chọn môn</option>
                {assignedSubjects.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Giáo viên">
              <select
                className={inputClass}
                value={lessonForm.teacherId}
                onChange={(event) =>
                  setLessonForm((prev) => ({ ...prev, teacherId: event.target.value }))
                }
                required
              >
                <option value="">Chọn giáo viên</option>
                {(classInfo?.teachers || []).map((teacher) => (
                  <option key={teacher.teacherId} value={teacher.teacherId}>
                    {teacher.fullName}
                    {teacher.subjectName ? ` - ${teacher.subjectName}` : ""}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Phòng" className="md:col-span-2">
              <input
                className={inputClass}
                value={lessonForm.roomName}
                onChange={(event) =>
                  setLessonForm((prev) => ({ ...prev, roomName: event.target.value }))
                }
                placeholder={classInfo?.roomName || "Phòng học"}
              />
            </StaffField>
            {lessonForm.timetableId && (
              <button
                type="button"
                onClick={resetLessonForm}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 md:col-span-2"
              >
                Hủy sửa
              </button>
            )}
          </StaffFormCard>
        </aside>
      </div>
    </>
  );
}

export default StaffTimetablePage;
