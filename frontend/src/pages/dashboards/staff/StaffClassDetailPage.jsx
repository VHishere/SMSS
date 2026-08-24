import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiPlus } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffFormCard, {
  StaffField,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import PrettySelect from "../../../components/molecules/PrettySelect";

const ROLE_LABELS = {
  HOMEROOM_TEACHER: "Giáo viên chủ nhiệm",
  SUBJECT_TEACHER: "Giáo viên bộ môn",
};

// Dropdown chọn nhiều học sinh — cùng kiểu thả xuống như PrettySelect (nút bo
// tròn, panel portal) nhưng mỗi dòng là nút bấm đổi màu để chọn/bỏ chọn nhiều
// học sinh thay vì chỉ chọn 1 giá trị.
function StudentMultiSelectDropdown({ students, selectedIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (
        (ref.current && ref.current.contains(event.target)) ||
        (menuRef.current && menuRef.current.contains(event.target))
      ) {
        return;
      }
      setOpen(false);
    };
    const onEsc = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = Math.max(rect.width, 260);
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - menuWidth - 8),
      );
      setMenuStyle({
        position: "fixed",
        left,
        top: rect.bottom + 6,
        width: menuWidth,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const placeholder = selectedIds.length
    ? `Đã chọn ${selectedIds.length} học sinh`
    : "Chọn học sinh";

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center gap-2 rounded-full border bg-white pl-4 pr-2.5 text-sm font-medium shadow-sm outline-none transition-colors hover:border-[#F27123]"
        style={{
          borderColor: open ? "#F27123" : "#DFC0B2",
          color: "#1A1C1C",
          boxShadow: open ? "0 0 0 3px rgba(242,113,35,0.15)" : undefined,
        }}
      >
        <span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
        <span
          className={`material-symbols-outlined shrink-0 !text-[20px] text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="overflow-hidden rounded-2xl border bg-white shadow-lg"
            style={{ borderColor: "#DFC0B2", ...menuStyle }}
          >
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {students.length ? (
                students.map((student) => {
                  const idStr = String(student.studentId);
                  const checked = selectedIds.includes(idStr);
                  return (
                    <button
                      type="button"
                      key={student.studentId}
                      onClick={() => onToggle(student.studentId)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        checked
                          ? "bg-[#F27123] text-white"
                          : "bg-white text-[#1A1C1C] hover:bg-[#FFF3EB]"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {student.studentCode} - {student.fullName}
                      </span>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          checked
                            ? "bg-white/20 text-white"
                            : student.currentClassName
                              ? "bg-slate-100 text-slate-600"
                              : "bg-[#FFE7D6] text-[#F27123]"
                        }`}
                      >
                        {student.currentClassName || "Chưa có lớp"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  Không có học sinh để thêm
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 bg-[#F9F9F9] px-4 py-2 text-right">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-[#08509F]"
              >
                Xong
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function StaffClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [lookups, setLookups] = useState(null);
  const [studentForm, setStudentForm] = useState({ studentIds: [] });
  const [teacherForm, setTeacherForm] = useState({
    teacherId: "",
    roleInClass: "HOMEROOM_TEACHER",
    subjectId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data)).catch(() => {});
    staffApi
      .getClass(id)
      .then((res) => {
        setClassInfo(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const availableStudents = useMemo(() => {
    if (!lookups?.students || !classInfo?.students) return [];
    const enrolledIds = new Set(classInfo.students.map((student) => student.studentId));
    return lookups.students.filter((student) => !enrolledIds.has(student.studentId));
  }, [classInfo, lookups]);

  const selectedTeacher = useMemo(
    () =>
      lookups?.teachers?.find(
        (teacher) => String(teacher.teacherId) === String(teacherForm.teacherId),
      ),
    [lookups, teacherForm.teacherId],
  );

  const teacherSubjects = useMemo(() => {
    if (!selectedTeacher) return lookups?.subjects || [];
    if (!selectedTeacher.subjectIds?.length) return [];
    const allowedIds = new Set(selectedTeacher.subjectIds.map(Number));
    return (lookups?.subjects || []).filter((subject) =>
      allowedIds.has(Number(subject.subjectId)),
    );
  }, [lookups, selectedTeacher]);

  const availableTeachers = useMemo(() => {
    const teachers = lookups?.teachers || [];
    if (teacherForm.roleInClass !== "HOMEROOM_TEACHER" || !classInfo?.schoolYearId) {
      return teachers;
    }

    return teachers.filter((teacher) => {
      const homeroomAssignments = teacher.homeroomAssignments || [];
      return !homeroomAssignments.some(
        (assignment) =>
          Number(assignment.schoolYearId) === Number(classInfo.schoolYearId) &&
          Number(assignment.classId) !== Number(classInfo.classId),
      );
    });
  }, [classInfo, lookups, teacherForm.roleInClass]);

  useEffect(() => {
    if (teacherForm.roleInClass !== "SUBJECT_TEACHER") return;

    if (!teacherForm.subjectId && teacherSubjects.length === 1) {
      setTeacherForm((prev) => ({
        ...prev,
        subjectId: String(teacherSubjects[0].subjectId),
      }));
      return;
    }

    if (!teacherForm.subjectId) return;

    const stillAllowed = teacherSubjects.some(
      (subject) => String(subject.subjectId) === String(teacherForm.subjectId),
    );
    if (!stillAllowed) {
      setTeacherForm((prev) => ({
        ...prev,
        subjectId:
          teacherSubjects.length === 1 ? String(teacherSubjects[0].subjectId) : "",
      }));
    }
  }, [teacherForm.roleInClass, teacherForm.subjectId, teacherSubjects]);

  useEffect(() => {
    if (!teacherForm.teacherId) return;

    const stillAvailable = availableTeachers.some(
      (teacher) => String(teacher.teacherId) === String(teacherForm.teacherId),
    );
    if (!stillAvailable) {
      setTeacherForm((prev) => ({ ...prev, teacherId: "", subjectId: "" }));
    }
  }, [availableTeachers, teacherForm.teacherId]);

  const updateTeacherForm = (field, value) => {
    setTeacherForm((prev) => {
      const next = { ...prev, [field]: value };
      const teacherId = field === "teacherId" ? value : next.teacherId;
      const roleInClass = field === "roleInClass" ? value : next.roleInClass;

      if (field === "teacherId" || field === "roleInClass") {
        const teacher = lookups?.teachers?.find(
          (item) => String(item.teacherId) === String(teacherId),
        );
        const subjectIds = teacher?.subjectIds || [];

        if (roleInClass !== "SUBJECT_TEACHER") {
          next.subjectId = "";
        } else if (subjectIds.length === 1) {
          next.subjectId = String(subjectIds[0]);
        } else if (!subjectIds.map(String).includes(String(next.subjectId))) {
          next.subjectId = "";
        }
      }

      return next;
    });
  };

  const addLessonUrl = useMemo(() => {
    if (!classInfo) return "/staff/timetable/new";
    const query = new URLSearchParams({
      schoolYearId: String(classInfo.schoolYearId || ""),
      gradeId: String(classInfo.gradeId || ""),
      classId: String(classInfo.classId || id),
    });
    [...query.entries()].forEach(([key, value]) => {
      if (!value) query.delete(key);
    });
    return `/staff/timetable/new?${query.toString()}`;
  }, [classInfo, id]);

  const toggleStudentSelection = (studentId) => {
    const idStr = String(studentId);
    setStudentForm((prev) => ({
      studentIds: prev.studentIds.includes(idStr)
        ? prev.studentIds.filter((value) => value !== idStr)
        : [...prev.studentIds, idStr],
    }));
  };

  const handleEnrollStudent = (event) => {
    event.preventDefault();
    if (!studentForm.studentIds.length) return;

    setSaving(true);
    staffApi
      .enrollStudents(id, studentForm.studentIds.map(Number))
      .then((res) => {
        const { enrollResults, ...classData } = res.data || {};
        setClassInfo(classData);
        setStudentForm({ studentIds: [] });
        const failed = (enrollResults || []).filter((item) => !item.success);
        setError(
          failed.length
            ? `Không thể thêm ${failed.length} học sinh: ${failed
                .map((item) => item.message)
                .join("; ")}`
            : "",
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleRemoveStudent = (studentId) => {
    staffApi
      .removeStudentFromClass(id, studentId)
      .then((res) => setClassInfo(res.data))
      .catch((err) => setError(err.message));
  };

  const handleAssignTeacher = (event) => {
    event.preventDefault();
    if (!teacherForm.teacherId) return;

    setSaving(true);
    staffApi
      .assignTeacher(id, {
        teacherId: Number(teacherForm.teacherId),
        roleInClass: teacherForm.roleInClass,
        subjectId:
          teacherForm.roleInClass === "SUBJECT_TEACHER" && teacherForm.subjectId
            ? Number(teacherForm.subjectId)
            : null,
      })
      .then((res) => {
        setClassInfo(res.data);
        setTeacherForm({
          teacherId: "",
          roleInClass: "HOMEROOM_TEACHER",
          subjectId: "",
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleRemoveTeacher = (teacherClassId) => {
    staffApi
      .removeTeacherFromClass(id, teacherClassId)
      .then((res) => setClassInfo(res.data))
      .catch((err) => setError(err.message));
  };

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;
  }

  if (!classInfo) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error || "Không tìm thấy lớp học"}
      </div>
    );
  }

  return (
    <>
      <StaffPageHeader
        title={classInfo.className}
        action={
          <button
            type="button"
            onClick={() => navigate("/staff/classes")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:border-[#08509F] hover:bg-blue-50"
          >
            <FiArrowLeft size={18} />
            Quay lại
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="mb-0 text-lg font-bold text-[#0F2747]">Thông tin lớp</h2>
          <Link
            to={addLessonUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-[#E55C0A]"
          >
            <FiPlus />
            Thêm lịch học
          </Link>
        </div>
        <div className="grid gap-4 text-center sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Lớp", classInfo.className],
            ["Khối", classInfo.gradeName],
            ["Năm học", classInfo.schoolYearName],
            ["Phòng", classInfo.roomName || "—"],
            ["Sĩ số", classInfo.students?.length || 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</p>
              <p className={`mb-0 font-bold ${label === "Sĩ số" ? "text-[#F27123]" : "text-[#0F2747]"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <StaffFormCard
          title="Thêm học sinh"
          onSubmit={handleEnrollStudent}
          submitLabel="Thêm vào lớp"
          loading={saving}
        >
          <StaffField label="Học sinh" className="md:col-span-2">
            <StudentMultiSelectDropdown
              students={availableStudents}
              selectedIds={studentForm.studentIds}
              onToggle={toggleStudentSelection}
            />
          </StaffField>
        </StaffFormCard>

        <StaffFormCard
          title="Phân công giáo viên"
          onSubmit={handleAssignTeacher}
          submitLabel="Thêm giáo viên"
          loading={saving}
        >
          <StaffField label="Giáo viên">
            <PrettySelect
              className={inputClass}
              value={teacherForm.teacherId}
              onChange={(event) => updateTeacherForm("teacherId", event.target.value)}
              required
            >
              <option value="">Chọn giáo viên</option>
              {availableTeachers.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherCode} - {teacher.fullName}
                </option>
              ))}
            </PrettySelect>
            {teacherForm.roleInClass === "HOMEROOM_TEACHER" &&
              (lookups?.teachers || []).length > availableTeachers.length && (
                <p className="mt-2 text-sm text-slate-500">
                  Đã ẩn giáo viên đang chủ nhiệm lớp khác trong năm học này.
                </p>
              )}
          </StaffField>
          <StaffField label="Vai trò">
            <PrettySelect
              className={inputClass}
              value={teacherForm.roleInClass}
              onChange={(event) => updateTeacherForm("roleInClass", event.target.value)}
            >
              <option value="HOMEROOM_TEACHER">Giáo viên chủ nhiệm</option>
              <option value="SUBJECT_TEACHER">Giáo viên bộ môn</option>
            </PrettySelect>
          </StaffField>
          {teacherForm.roleInClass === "SUBJECT_TEACHER" && (
            <StaffField label="Môn học" className="md:col-span-2">
              <PrettySelect
                className={inputClass}
                value={teacherForm.subjectId}
                onChange={(event) =>
                  setTeacherForm((prev) => ({
                    ...prev,
                    subjectId: event.target.value,
                  }))
                }
                required
              >
                <option value="">Chọn môn</option>
                {teacherSubjects.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName}
                  </option>
                ))}
              </PrettySelect>
              {teacherForm.teacherId && teacherSubjects.length === 0 && (
                <p className="mt-2 text-sm text-red-600">
                  Giáo viên này chưa có chuyên môn hoặc phân công môn học.
                </p>
              )}
            </StaffField>
          )}
        </StaffFormCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="mb-0 text-base font-bold text-[#0F2747]">
              Danh sách học sinh - {classInfo.students?.length || 0} học sinh
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-center">Mã HS</th>
                  <th className="px-4 py-3 text-center">Họ tên</th>
                  <th className="px-4 py-3 text-center">Ngày vào lớp</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {classInfo.students?.length ? (
                  classInfo.students.map((student) => (
                    <tr key={student.studentId} className="border-t border-slate-100">
                      <td className="px-4 py-3">{student.studentCode}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F2747]">
                        {student.fullName}
                      </td>
                      <td className="px-4 py-3">{student.enrollmentDate || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(student.studentId)}
                          className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Gỡ khỏi lớp
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-slate-500">
                      Chưa có học sinh trong lớp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="mb-0 text-base font-bold text-[#0F2747]">
              Giáo viên phụ trách - {classInfo.teachers?.length || 0} giáo viên
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-center">Giáo viên</th>
                  <th className="px-4 py-3 text-center">Vai trò</th>
                  <th className="px-4 py-3 text-center">Môn</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {classInfo.teachers?.length ? (
                  classInfo.teachers.map((teacher) => (
                    <tr key={teacher.teacherClassId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-[#0F2747]">{teacher.fullName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          value={ROLE_LABELS[teacher.roleInClass] || teacher.roleInClass}
                          tone={teacher.roleInClass === "HOMEROOM_TEACHER" ? "success" : "info"}
                        />
                      </td>
                      <td className="px-4 py-3">{teacher.subjectName || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveTeacher(teacher.teacherClassId)}
                          className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Gỡ
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-slate-500">
                      Chưa phân công giáo viên
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default StaffClassDetailPage;
