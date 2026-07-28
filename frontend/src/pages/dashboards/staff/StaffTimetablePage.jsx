import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";

import { staffApi } from "../../../api/client";
import { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";

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

function toDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function slotKey(dayOfWeek, periodNo) {
  return `${dayOfWeek}-${periodNo}`;
}

function StaffTimetablePage() {
  const [searchParams] = useSearchParams();
  const [lookups, setLookups] = useState({
    schoolYears: [],
    grades: [],
  });
  const [classes, setClasses] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [filters, setFilters] = useState({
    schoolYearId: searchParams.get("schoolYearId") || "",
    gradeId: searchParams.get("gradeId") || "",
    classId: searchParams.get("classId") || "",
  });
  const [weekStart, setWeekStart] = useState(getMonday());
  const [error, setError] = useState("");

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        setLookups(res.data);
        if (!filters.schoolYearId) {
          const activeYear =
            res.data.schoolYears?.find((year) => year.isActive) ||
            res.data.schoolYears?.[0];
          if (activeYear) {
            setFilters((prev) => ({
              ...prev,
              schoolYearId: String(activeYear.schoolYearId),
            }));
          }
        }
      })
      .catch((err) => setError(err.message));
  }, [filters.schoolYearId]);

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
          const selected = items.some(
            (item) => String(item.classId) === prev.classId,
          );
          return {
            ...prev,
            classId: selected ? prev.classId : String(items[0]?.classId || ""),
          };
        });
      })
      .catch((err) => setError(err.message));
  }, [filters.schoolYearId, filters.gradeId]);

  const loadClassTimetable = useCallback(() => {
    if (!filters.classId) {
      setClassInfo(null);
      setTimetable([]);
      return;
    }

    Promise.all([
      staffApi.getClass(filters.classId),
      staffApi.getClassTimetable(filters.classId),
    ])
      .then(([classRes, timetableRes]) => {
        setClassInfo(classRes.data);
        setTimetable(timetableRes.data || []);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [filters.classId]);

  useEffect(() => {
    if (!filters.classId) return;

    Promise.all([
      staffApi.getClass(filters.classId),
      staffApi.getClassTimetable(filters.classId),
    ])
      .then(([classRes, timetableRes]) => {
        setClassInfo(classRes.data);
        setTimetable(timetableRes.data || []);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [filters.classId]);

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

  const lessonsBySlot = useMemo(() => {
    const map = new Map();
    timetable.forEach((lesson) => {
      map.set(slotKey(lesson.dayOfWeek, lesson.periodNo), lesson);
    });
    return map;
  }, [timetable]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "schoolYearId" ? { gradeId: "", classId: "" } : {}),
      ...(key === "gradeId" ? { classId: "" } : {}),
    }));
    setClassInfo(null);
    setTimetable([]);
    setError("");
  };

  const buildCreateLink = (extra = {}) => {
    const query = new URLSearchParams({
      schoolYearId: filters.schoolYearId,
      gradeId: filters.gradeId,
      classId: filters.classId,
      ...extra,
    });
    [...query.entries()].forEach(([key, value]) => {
      if (!value) query.delete(key);
    });
    return `/staff/timetable/new?${query.toString()}`;
  };

  const handleDeleteLesson = (lesson) => {
    if (!window.confirm("Xóa tiết học này khỏi thời khóa biểu?")) return;

    staffApi
      .deleteClassTimetableLesson(filters.classId, lesson.timetableId)
      .then((res) => {
        setTimetable(res.data || []);
      })
      .catch((err) => setError(err.message));
  };

  return (
    <>
      <StaffPageHeader
        title="Thêm lịch học"
        action={
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
            <button
              type="button"
              onClick={loadClassTimetable}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#08509F] bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:bg-blue-50"
            >
              <FiRefreshCw />
              Tải lại
            </button>
            <Link
              to={buildCreateLink()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-[#E55C0A]"
            >
              <FiPlus />
              Thêm lịch học
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
          <StaffField label="Năm học">
            <PrettySelect
              className={inputClass}
              value={filters.schoolYearId}
              onChange={(event) => updateFilter("schoolYearId", event.target.value)}
            >
              {lookups.schoolYears.map((year) => (
                <option key={year.schoolYearId} value={year.schoolYearId}>
                  {year.yearName}
                </option>
              ))}
            </PrettySelect>
          </StaffField>
          <StaffField label="Khối">
            <PrettySelect
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
            </PrettySelect>
          </StaffField>
          <StaffField label="Lớp">
            <PrettySelect
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
            </PrettySelect>
          </StaffField>
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2">
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
            {classInfo?.className || "Chưa chọn lớp"}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
            {timetable.length} tiết học
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
        <div className="border-b border-orange-100 px-5 py-4">
          <h2 className="mb-1 text-lg font-bold text-[#0F2747]">
            Thời khóa biểu tuần
          </h2>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-slate-200">
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
                    const lesson = lessonsBySlot.get(slotKey(day.value, period.periodNo));

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
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(lesson)}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:bg-red-50"
                                title="Xóa tiết học"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </article>
                        ) : (
                          <Link
                            to={buildCreateLink({
                              dayOfWeek: String(day.value),
                              periodNo: String(period.periodNo),
                            })}
                            className="flex min-h-28 w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/75 text-sm font-semibold text-slate-400 no-underline transition hover:border-[#F27123] hover:bg-[#FFF7F2] hover:text-[#F27123]"
                          >
                            <span className="inline-flex items-center gap-2">
                              <FiPlus />
                              Thêm tiết
                            </span>
                          </Link>
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
    </>
  );
}

export default StaffTimetablePage;
