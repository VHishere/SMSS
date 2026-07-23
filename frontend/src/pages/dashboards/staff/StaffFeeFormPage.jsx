import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffFormCard, { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const initialForm = {
  title: "",
  feeType: "Học phí",
  schoolYearId: "",
  semesterId: "",
  amount: "",
  discountAmount: "",
  dueDate: "",
  description: "",
  status: "PUBLISHED",
  scopeType: "CLASS",
  studentId: "",
  classId: "",
  gradeId: "",
};

function StaffFeeFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lookups, setLookups] = useState({
    schoolYears: [],
    semesters: [],
    grades: [],
    classes: [],
    students: [],
  });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        setLookups(res.data);
        const queryYearId = searchParams.get("schoolYearId");
        const activeYearId = res.data.schoolYears?.find((item) => item.isActive)?.schoolYearId;
        setForm((prev) => ({
          ...prev,
          schoolYearId: queryYearId || activeYearId || "",
        }));
      })
      .catch((err) => setError(err.message));
  }, [searchParams]);

  const filteredSemesters = useMemo(
    () =>
      lookups.semesters?.filter(
        (semester) => String(semester.schoolYearId) === String(form.schoolYearId),
      ) || [],
    [lookups.semesters, form.schoolYearId],
  );

  const filteredClasses = useMemo(
    () =>
      lookups.classes?.filter((item) => {
        const sameYear = !form.schoolYearId || String(item.schoolYearId) === String(form.schoolYearId);
        const sameGrade = !form.gradeId || String(item.gradeId) === String(form.gradeId);
        return sameYear && sameGrade;
      }) || [],
    [lookups.classes, form.schoolYearId, form.gradeId],
  );

  const filteredStudents = useMemo(() => {
    if (!form.classId) return lookups.students || [];
    const selectedClass = lookups.classes?.find(
      (item) => String(item.classId) === String(form.classId),
    );
    if (!selectedClass) return lookups.students || [];
    return lookups.students || [];
  }, [lookups.classes, lookups.students, form.classId]);

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "schoolYearId") {
        next.semesterId = "";
        next.classId = "";
        next.gradeId = "";
      }

      if (field === "gradeId") {
        next.classId = "";
      }

      if (field === "scopeType") {
        next.studentId = "";
        next.classId = "";
        next.gradeId = "";
      }

      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    staffApi
      .createFeePlan({
        ...form,
        amount: Number(form.amount),
        discountAmount: Number(form.discountAmount || 0),
      })
      .then((res) => navigate(`/staff/fees/${res.data.feePlanId}`))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <StaffPageHeader
        title="Tạo khoản học phí"
        action={
          <Link
            to="/staff/fees"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#0F2747] no-underline hover:border-[#F27123] hover:text-[#F27123] hover:no-underline sm:w-auto"
          >
            <FiArrowLeft size={16} />
            Quay lại
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffFormCard
        title="Thông tin khoản phí"
        onSubmit={handleSubmit}
        submitLabel="Tạo khoản phí"
        loading={loading}
      >
        <StaffField label="Tên khoản phí">
          <input
            className={inputClass}
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            placeholder="VD: Học phí tháng 9"
            required
          />
        </StaffField>

        <StaffField label="Loại phí">
          <select
            className={inputClass}
            value={form.feeType}
            onChange={(event) => setField("feeType", event.target.value)}
          >
            <option value="Học phí">Học phí</option>
            <option value="Bán trú">Bán trú</option>
            <option value="Xe đưa đón">Xe đưa đón</option>
            <option value="Hoạt động ngoại khóa">Hoạt động ngoại khóa</option>
            <option value="Khác">Khác</option>
          </select>
        </StaffField>

        <StaffField label="Năm học">
          <select
            className={inputClass}
            value={form.schoolYearId}
            onChange={(event) => setField("schoolYearId", event.target.value)}
            required
          >
            <option value="">Chọn năm học</option>
            {lookups.schoolYears?.map((year) => (
              <option key={year.schoolYearId} value={year.schoolYearId}>
                {year.yearName}
              </option>
            ))}
          </select>
        </StaffField>

        <StaffField label="Học kỳ">
          <select
            className={inputClass}
            value={form.semesterId}
            onChange={(event) => setField("semesterId", event.target.value)}
          >
            <option value="">Không chọn học kỳ</option>
            {filteredSemesters.map((semester) => (
              <option key={semester.semesterId} value={semester.semesterId}>
                {semester.semesterName}
              </option>
            ))}
          </select>
        </StaffField>

        <StaffField label="Số tiền">
          <input
            type="number"
            min="0"
            step="1000"
            className={inputClass}
            value={form.amount}
            onChange={(event) => setField("amount", event.target.value)}
            required
          />
        </StaffField>

        <StaffField label="Giảm trừ mặc định">
          <input
            type="number"
            min="0"
            step="1000"
            className={inputClass}
            value={form.discountAmount}
            onChange={(event) => setField("discountAmount", event.target.value)}
          />
        </StaffField>

        <StaffField label="Hạn đóng">
          <input
            type="date"
            className={inputClass}
            value={form.dueDate}
            onChange={(event) => setField("dueDate", event.target.value)}
            required
          />
        </StaffField>

        <StaffField label="Trạng thái">
          <select
            className={inputClass}
            value={form.status}
            onChange={(event) => setField("status", event.target.value)}
          >
            <option value="PUBLISHED">Công bố ngay</option>
            <option value="DRAFT">Lưu nháp</option>
          </select>
        </StaffField>

        <StaffField label="Phạm vi áp dụng">
          <select
            className={inputClass}
            value={form.scopeType}
            onChange={(event) => setField("scopeType", event.target.value)}
          >
            <option value="STUDENT">Từng học sinh</option>
            <option value="CLASS">Theo lớp</option>
            <option value="GRADE">Theo khối</option>
            <option value="SCHOOL">Toàn trường</option>
          </select>
        </StaffField>

        {form.scopeType === "STUDENT" && (
          <StaffField label="Học sinh">
            <select
              className={inputClass}
              value={form.studentId}
              onChange={(event) => setField("studentId", event.target.value)}
              required
            >
              <option value="">Chọn học sinh</option>
              {filteredStudents.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentCode} - {student.fullName}
                </option>
              ))}
            </select>
          </StaffField>
        )}

        {(form.scopeType === "CLASS" || form.scopeType === "GRADE") && (
          <StaffField label="Khối">
            <select
              className={inputClass}
              value={form.gradeId}
              onChange={(event) => setField("gradeId", event.target.value)}
              required={form.scopeType === "GRADE"}
            >
              <option value="">Chọn khối</option>
              {lookups.grades?.map((grade) => (
                <option key={grade.gradeId} value={grade.gradeId}>
                  {grade.gradeName}
                </option>
              ))}
            </select>
          </StaffField>
        )}

        {form.scopeType === "CLASS" && (
          <StaffField label="Lớp">
            <select
              className={inputClass}
              value={form.classId}
              onChange={(event) => setField("classId", event.target.value)}
              required
            >
              <option value="">Chọn lớp</option>
              {filteredClasses.map((classItem) => (
                <option key={classItem.classId} value={classItem.classId}>
                  {classItem.className} - {classItem.schoolYearName}
                </option>
              ))}
            </select>
          </StaffField>
        )}

        <StaffField label="Ghi chú" className="md:col-span-2">
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            placeholder="Nội dung hiển thị cho phụ huynh/học sinh khi xem khoản phí"
          />
        </StaffField>
      </StaffFormCard>
    </>
  );
}

export default StaffFeeFormPage;
