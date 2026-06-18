import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDetailCard from "../../../components/staff/StaffDetailCard";
import StaffFormCard, { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";

const ROLE_LABELS = {
  HOMEROOM_TEACHER: "Giáo viên chủ nhiệm",
  SUBJECT_TEACHER: "Giáo viên bộ môn",
};

function StaffClassDetailPage() {
  const { id } = useParams();
  const [classInfo, setClassInfo] = useState(null);
  const [lookups, setLookups] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentForm, setStudentForm] = useState({ studentId: "" });
  const [teacherForm, setTeacherForm] = useState({
    teacherId: "",
    roleInClass: "HOMEROOM_TEACHER",
    subjectId: "",
  });
  const [saving, setSaving] = useState(false);

  const loadClass = () => {
    setLoading(true);
    staffApi
      .getClass(id)
      .then((res) => {
        setClassInfo(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data)).catch(() => {});
    loadClass();
  }, [id]);

  const availableStudents = useMemo(() => {
    if (!lookups?.students || !classInfo?.students) return [];
    const enrolledIds = new Set(classInfo.students.map((s) => s.studentId));
    return lookups.students.filter((s) => !enrolledIds.has(s.studentId));
  }, [lookups, classInfo]);

  const handleEnrollStudent = (event) => {
    event.preventDefault();
    if (!studentForm.studentId) return;

    setSaving(true);
    staffApi
      .enrollStudent(id, Number(studentForm.studentId))
      .then((res) => {
        setClassInfo(res.data);
        setStudentForm({ studentId: "" });
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

  if (error && !classInfo) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <>
      <StaffPageHeader
        title={classInfo.className}
        description={`${classInfo.gradeName} · ${classInfo.schoolYearName}`}
        action={
          <Link
            to="/staff/classes"
            className="rounded-xl border border-[#08509F] px-4 py-2 text-sm font-semibold text-[#08509F] no-underline"
          >
            Quay lại
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StaffDetailCard title="Thông tin lớp">
          <p className="mb-1 text-sm text-slate-500">Phòng học</p>
          <p className="mb-0 font-semibold text-[#0F2747]">
            {classInfo.roomName || "—"}
          </p>
        </StaffDetailCard>
        <StaffDetailCard title="Học sinh">
          <p className="mb-0 text-3xl font-bold text-[#F27123]">
            {classInfo.students?.length || 0}
          </p>
        </StaffDetailCard>
        <StaffDetailCard title="Giáo viên">
          <p className="mb-0 text-3xl font-bold text-[#08509F]">
            {classInfo.teachers?.length || 0}
          </p>
        </StaffDetailCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StaffFormCard
          title="Thêm học sinh vào lớp"
          onSubmit={handleEnrollStudent}
          submitLabel="Thêm học sinh"
          loading={saving}
        >
          <StaffField label="Học sinh" className="md:col-span-2">
            <select
              className={inputClass}
              value={studentForm.studentId}
              onChange={(e) =>
                setStudentForm({ studentId: e.target.value })
              }
              required
            >
              <option value="">Chọn học sinh</option>
              {availableStudents.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentCode} — {student.fullName}
                </option>
              ))}
            </select>
          </StaffField>
        </StaffFormCard>

        <StaffFormCard
          title="Phân công giáo viên"
          onSubmit={handleAssignTeacher}
          submitLabel="Thêm giáo viên"
          loading={saving}
        >
          <StaffField label="Giáo viên">
            <select
              className={inputClass}
              value={teacherForm.teacherId}
              onChange={(e) =>
                setTeacherForm((prev) => ({
                  ...prev,
                  teacherId: e.target.value,
                }))
              }
              required
            >
              <option value="">Chọn giáo viên</option>
              {lookups?.teachers?.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherCode} — {teacher.fullName}
                </option>
              ))}
            </select>
          </StaffField>
          <StaffField label="Vai trò">
            <select
              className={inputClass}
              value={teacherForm.roleInClass}
              onChange={(e) =>
                setTeacherForm((prev) => ({
                  ...prev,
                  roleInClass: e.target.value,
                }))
              }
            >
              <option value="HOMEROOM_TEACHER">Giáo viên chủ nhiệm</option>
              <option value="SUBJECT_TEACHER">Giáo viên bộ môn</option>
            </select>
          </StaffField>
          {teacherForm.roleInClass === "SUBJECT_TEACHER" && (
            <StaffField label="Môn học" className="md:col-span-2">
              <select
                className={inputClass}
                value={teacherForm.subjectId}
                onChange={(e) =>
                  setTeacherForm((prev) => ({
                    ...prev,
                    subjectId: e.target.value,
                  }))
                }
              >
                <option value="">Chọn môn</option>
                {lookups?.subjects?.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName}
                  </option>
                ))}
              </select>
            </StaffField>
          )}
        </StaffFormCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StaffDetailCard title="Danh sách học sinh">
          {classInfo.students?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#FFF7F2] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Mã HS</th>
                    <th className="px-4 py-2 text-left">Họ tên</th>
                    <th className="px-4 py-2 text-left">Ngày vào lớp</th>
                    <th className="px-4 py-2 text-left" />
                  </tr>
                </thead>
                <tbody>
                  {classInfo.students.map((student) => (
                    <tr key={student.studentId} className="border-t border-slate-100">
                      <td className="px-4 py-3">{student.studentCode}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/staff/students/${student.studentId}`}
                          className="font-semibold text-[#08509F] no-underline"
                        >
                          {student.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{student.enrollmentDate}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(student.studentId)}
                          className="text-xs font-semibold text-red-500"
                        >
                          Gỡ khỏi lớp
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa có học sinh trong lớp</p>
          )}
        </StaffDetailCard>

        <StaffDetailCard title="Giáo viên phụ trách">
          {classInfo.teachers?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#FFF7F2] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Giáo viên</th>
                    <th className="px-4 py-2 text-left">Vai trò</th>
                    <th className="px-4 py-2 text-left">Môn</th>
                    <th className="px-4 py-2 text-left" />
                  </tr>
                </thead>
                <tbody>
                  {classInfo.teachers.map((teacher) => (
                    <tr key={teacher.teacherClassId} className="border-t border-slate-100">
                      <td className="px-4 py-3">{teacher.fullName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          value={ROLE_LABELS[teacher.roleInClass] || teacher.roleInClass}
                          tone={teacher.roleInClass === "HOMEROOM_TEACHER" ? "success" : "info"}
                        />
                      </td>
                      <td className="px-4 py-3">{teacher.subjectName || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveTeacher(teacher.teacherClassId)}
                          className="text-xs font-semibold text-red-500"
                        >
                          Gỡ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa phân công giáo viên</p>
          )}
        </StaffDetailCard>
      </div>
    </>
  );
}

export default StaffClassDetailPage;
