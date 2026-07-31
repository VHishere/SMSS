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

const initialForm = {
  title: "",
  feeCategoryId: "",
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
    feeCategories: [],
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
          feeCategoryId:
            prev.feeCategoryId || res.data.feeCategories?.[0]?.feeCategoryId || "",
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
            className={cancelLinkClass}
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
        footer="Khoản phí sau khi công bố sẽ hiển thị cho phụ huynh và học sinh theo phạm vi đã chọn."
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
          <PrettySelect
            className={inputClass}
            value={form.feeCategoryId}
            onChange={(event) => setField("feeCategoryId", event.target.value)}
            required
          >
            <option value="">Chọn loại phí</option>
            {lookups.feeCategories?.map((category) => (
              <option key={category.feeCategoryId} value={category.feeCategoryId}>
                {category.name}
              </option>
            ))}
          </PrettySelect>
        </StaffField>

        <StaffField label="Năm học">
          <PrettySelect
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
          </PrettySelect>
        </StaffField>

        <StaffField label="Học kỳ">
          <PrettySelect
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
          </PrettySelect>
        </StaffField>

        <StaffField label="Số tiền">
          <input
            type="number"
            min="1"
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
          <PrettySelect
            className={inputClass}
            value={form.status}
            onChange={(event) => setField("status", event.target.value)}
          >
            <option value="PUBLISHED">Công bố ngay</option>
            <option value="DRAFT">Lưu nháp</option>
          </PrettySelect>
        </StaffField>

        <StaffField label="Phạm vi áp dụng">
          <PrettySelect
            className={inputClass}
            value={form.scopeType}
            onChange={(event) => setField("scopeType", event.target.value)}
          >
            <option value="STUDENT">Từng học sinh</option>
            <option value="CLASS">Theo lớp</option>
            <option value="GRADE">Theo khối</option>
            <option value="SCHOOL">Toàn trường</option>
          </PrettySelect>
        </StaffField>

        {form.scopeType === "STUDENT" && (
          <StaffField label="Học sinh">
            <PrettySelect
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
            </PrettySelect>
          </StaffField>
        )}

        {(form.scopeType === "CLASS" || form.scopeType === "GRADE") && (
          <StaffField label="Khối">
            <PrettySelect
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
            </PrettySelect>
          </StaffField>
        )}

        {form.scopeType === "CLASS" && (
          <StaffField label="Lớp">
            <PrettySelect
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
            </PrettySelect>
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
