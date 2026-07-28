import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffFormCard, {
  StaffField,
  cancelLinkClass,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";

const WEEK_DAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
];

const PERIODS = [
  { periodNo: 1, startTime: "07:30", endTime: "08:15" },
  { periodNo: 2, startTime: "08:20", endTime: "09:05" },
  { periodNo: 3, startTime: "09:25", endTime: "10:10" },
  { periodNo: 4, startTime: "10:20", endTime: "11:05" },
  { periodNo: 5, startTime: "13:30", endTime: "14:15" },
  { periodNo: 6, startTime: "14:20", endTime: "15:05" },
  { periodNo: 7, startTime: "15:25", endTime: "16:10" },
  { periodNo: 8, startTime: "16:15", endTime: "17:00" },
];

function StaffTimetableCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lookups, setLookups] = useState({
    schoolYears: [],
    grades: [],
    subjects: [],
    teachers: [],
  });
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    scope: searchParams.get("classId") ? "CLASS" : "GRADE",
    schoolYearId: searchParams.get("schoolYearId") || "",
    gradeId: searchParams.get("gradeId") || "",
    classId: searchParams.get("classId") || "",
    dayOfWeek: searchParams.get("dayOfWeek") || "2",
    periodNo: searchParams.get("periodNo") || "1",
    subjectId: "",
    teacherMode: "ASSIGNED_TEACHER",
    teacherId: "",
    roomName: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        setLookups(res.data);
        if (!form.schoolYearId) {
          const activeYear =
            res.data.schoolYears?.find((year) => year.isActive) ||
            res.data.schoolYears?.[0];
          if (activeYear) {
            setForm((prev) => ({
              ...prev,
              schoolYearId: String(activeYear.schoolYearId),
            }));
          }
        }
      })
      .catch((err) => setError(err.message));
  }, [form.schoolYearId]);

  useEffect(() => {
    if (!form.schoolYearId) return;

    staffApi
      .getClasses({
        schoolYearId: form.schoolYearId,
        gradeId: form.gradeId || undefined,
      })
      .then((res) => {
        const items = res.data || [];
        setClasses(items);
        setForm((prev) => {
          if (prev.scope !== "CLASS") return prev;
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
  }, [form.schoolYearId, form.gradeId]);

  const targetSummary = useMemo(() => {
    if (form.scope === "SCHOOL") {
      return `${classes.length} lớp trong năm học`;
    }
    if (form.scope === "GRADE") {
      return `${classes.length} lớp trong khối đã chọn`;
    }
    const selectedClass = classes.find(
      (item) => String(item.classId) === form.classId,
    );
    return selectedClass?.className || "Chưa chọn lớp";
  }, [classes, form.classId, form.scope]);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "schoolYearId" ? { gradeId: "", classId: "" } : {}),
      ...(key === "gradeId" ? { classId: "" } : {}),
      ...(key === "scope" && value !== "CLASS" ? { classId: "" } : {}),
      ...(key === "scope" && value === "CLASS" ? { teacherMode: "SELECTED_TEACHER" } : {}),
      ...(key === "scope" && value !== "CLASS" ? { teacherMode: "ASSIGNED_TEACHER" } : {}),
    }));
    setError("");
    setConflicts([]);
  };

  const backToTimetable = () => {
    const query = new URLSearchParams({
      schoolYearId: form.schoolYearId,
      gradeId: form.gradeId,
      classId: form.classId,
    });
    [...query.entries()].forEach(([key, value]) => {
      if (!value) query.delete(key);
    });
    navigate(`/staff/timetable?${query.toString()}`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setConflicts([]);

    staffApi
      .createTimetableLessons({
        ...form,
        schoolYearId: Number(form.schoolYearId),
        gradeId: form.gradeId ? Number(form.gradeId) : null,
        classId: form.classId ? Number(form.classId) : null,
        dayOfWeek: Number(form.dayOfWeek),
        periodNo: Number(form.periodNo),
        subjectId: Number(form.subjectId),
        teacherId:
          form.teacherMode === "SELECTED_TEACHER" && form.teacherId
            ? Number(form.teacherId)
            : null,
      })
      .then(backToTimetable)
      .catch((err) => {
        setError(err.message);
        setConflicts(err.details || []);
      })
      .finally(() => setSaving(false));
  };

  return (
    <>
      <StaffPageHeader
        title="Thêm lịch học"
        action={
          <Link
            to="/staff/timetable"
            className={cancelLinkClass}
          >
            <FiArrowLeft size={16} />
            Quay lại thời khóa biểu
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {conflicts.length > 0 && (
        <section className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-base font-bold text-red-700">
            Các lớp chưa thể thêm lịch
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {conflicts.map((item) => (
              <div
                key={`${item.classId}-${item.reason}`}
                className="rounded-2xl bg-white px-4 py-3 text-sm text-red-700 shadow-sm"
              >
                <p className="mb-1 font-semibold">{item.className}</p>
                <p className="mb-0">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <StaffFormCard
        title="Thông tin buổi học"
        onSubmit={handleSubmit}
        submitLabel="Kiểm tra và thêm lịch"
        loading={saving}
        footer={`Phạm vi áp dụng: ${targetSummary}`}
      >
        <StaffField label="Phạm vi">
          <PrettySelect
            className={inputClass}
            value={form.scope}
            onChange={(event) => updateForm("scope", event.target.value)}
          >
            <option value="CLASS">Từng lớp</option>
            <option value="GRADE">Theo khối</option>
            <option value="SCHOOL">Cả trường</option>
          </PrettySelect>
        </StaffField>

        <StaffField label="Năm học">
          <PrettySelect
            className={inputClass}
            value={form.schoolYearId}
            onChange={(event) => updateForm("schoolYearId", event.target.value)}
            required
          >
            <option value="">Chọn năm học</option>
            {lookups.schoolYears.map((year) => (
              <option key={year.schoolYearId} value={year.schoolYearId}>
                {year.yearName}
              </option>
            ))}
          </PrettySelect>
        </StaffField>

        {form.scope !== "SCHOOL" && (
          <StaffField label="Khối">
            <PrettySelect
              className={inputClass}
              value={form.gradeId}
              onChange={(event) => updateForm("gradeId", event.target.value)}
              required={form.scope === "GRADE"}
            >
              <option value="">Chọn khối</option>
              {lookups.grades.map((grade) => (
                <option key={grade.gradeId} value={grade.gradeId}>
                  {grade.gradeName}
                </option>
              ))}
            </PrettySelect>
          </StaffField>
        )}

        {form.scope === "CLASS" && (
          <StaffField label="Lớp">
            <PrettySelect
              className={inputClass}
              value={form.classId}
              onChange={(event) => updateForm("classId", event.target.value)}
              required
            >
              <option value="">Chọn lớp</option>
              {classes.map((item) => (
                <option key={item.classId} value={item.classId}>
                  {item.className}
                </option>
              ))}
            </PrettySelect>
          </StaffField>
        )}

        <StaffField label="Thứ">
          <PrettySelect
            className={inputClass}
            value={form.dayOfWeek}
            onChange={(event) => updateForm("dayOfWeek", event.target.value)}
          >
            {WEEK_DAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </PrettySelect>
        </StaffField>

        <StaffField label="Tiết">
          <PrettySelect
            className={inputClass}
            value={form.periodNo}
            onChange={(event) => updateForm("periodNo", event.target.value)}
          >
            {PERIODS.map((period) => (
              <option key={period.periodNo} value={period.periodNo}>
                Tiết {period.periodNo} ({period.startTime}-{period.endTime})
              </option>
            ))}
          </PrettySelect>
        </StaffField>

        <StaffField label="Môn học">
          <PrettySelect
            className={inputClass}
            value={form.subjectId}
            onChange={(event) => updateForm("subjectId", event.target.value)}
            required
          >
            <option value="">Chọn môn học</option>
            {lookups.subjects.map((subject) => (
              <option key={subject.subjectId} value={subject.subjectId}>
                {subject.subjectName}
              </option>
            ))}
          </PrettySelect>
        </StaffField>

        <StaffField label="Cách chọn giáo viên">
          <PrettySelect
            className={inputClass}
            value={form.teacherMode}
            onChange={(event) => updateForm("teacherMode", event.target.value)}
          >
            <option value="ASSIGNED_TEACHER">
              Tự lấy giáo viên đã phân công theo từng lớp
            </option>
            <option value="SELECTED_TEACHER">Chọn một giáo viên cụ thể</option>
          </PrettySelect>
        </StaffField>

        {form.teacherMode === "SELECTED_TEACHER" && (
          <StaffField label="Giáo viên">
            <PrettySelect
              className={inputClass}
              value={form.teacherId}
              onChange={(event) => updateForm("teacherId", event.target.value)}
              required
            >
              <option value="">Chọn giáo viên</option>
              {lookups.teachers.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.fullName}
                </option>
              ))}
            </PrettySelect>
          </StaffField>
        )}

        <StaffField label="Phòng học">
          <input
            className={inputClass}
            value={form.roomName}
            onChange={(event) => updateForm("roomName", event.target.value)}
            placeholder="Để trống để dùng phòng mặc định của lớp"
          />
        </StaffField>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#08509F] md:col-span-2">
          Phạm vi áp dụng: {targetSummary}
        </div>
      </StaffFormCard>
    </>
  );
}

export default StaffTimetableCreatePage;
