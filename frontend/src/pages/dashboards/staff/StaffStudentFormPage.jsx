import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffFormCard, {
  StaffField,
  cancelLinkClass,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";
import { resolveStaffWorkingSchoolYear } from "../../../utils/staffSchoolYear";

const emptyForm = {
  studentCode: "",
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "MALE",
  address: "",
  classId: "",
  status: "ACTIVE",
};

function StaffStudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [lookups, setLookups] = useState({ classes: [], schoolYears: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data));
  }, []);

  const workingSchoolYearId = useMemo(
    () =>
      resolveStaffWorkingSchoolYear(lookups.schoolYears || [])?.schoolYearId ||
      "",
    [lookups.schoolYears],
  );

  const classOptions = useMemo(
    () =>
      (lookups.classes || []).filter(
        (item) =>
          !workingSchoolYearId ||
          String(item.schoolYearId) === String(workingSchoolYearId) ||
          String(item.classId) === String(form.classId),
      ),
    [form.classId, lookups.classes, workingSchoolYearId],
  );

  useEffect(() => {
    if (!isEdit) return;

    staffApi
      .getStudent(id)
      .then((res) => {
        const data = res.data;
        setForm({
          studentCode: data.studentCode || "",
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          dateOfBirth: data.dateOfBirthRaw || "",
          gender: data.gender || "MALE",
          address: data.address || "",
          classId: data.classId ? String(data.classId) : "",
          status: data.status || "ACTIVE",
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      classId: form.classId ? Number(form.classId) : null,
      schoolYearId: workingSchoolYearId ? Number(workingSchoolYearId) : null,
    };

    try {
      if (isEdit) {
        await staffApi.updateStudent(id, payload);
        navigate(`/staff/students/${id}`);
      } else {
        const res = await staffApi.createStudent(payload);
        navigate(`/staff/students/${res.data.studentId}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;
  }

  return (
    <>
      <StaffPageHeader
        title={isEdit ? "Chỉnh sửa học sinh" : "Thêm học sinh mới"}
        action={
          <Link
            to={isEdit ? `/staff/students/${id}` : "/staff/students"}
            className={cancelLinkClass}
          >
            Hủy
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffFormCard
        title="Thông tin học sinh"
        onSubmit={handleSubmit}
        loading={saving}
        footer={isEdit ? "Cập nhật hồ sơ học sinh." : "Sau khi tạo, hệ thống sẽ mở trang chi tiết học sinh."}
      >
        <StaffField label="Mã học sinh">
          <input
            className={inputClass}
            value={form.studentCode}
            onChange={handleChange("studentCode")}
            required
          />
        </StaffField>
        <StaffField label="Họ và tên">
          <input
            className={inputClass}
            value={form.fullName}
            onChange={handleChange("fullName")}
            required
          />
        </StaffField>
        <StaffField label="Email">
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={handleChange("email")}
            required
          />
        </StaffField>
        <StaffField label="Điện thoại">
          <input
            className={inputClass}
            value={form.phone}
            onChange={handleChange("phone")}
          />
        </StaffField>
        <StaffField label="Ngày sinh">
          <input
            type="date"
            className={inputClass}
            value={form.dateOfBirth}
            onChange={handleChange("dateOfBirth")}
          />
        </StaffField>
        <StaffField label="Giới tính">
          <PrettySelect
            className={inputClass}
            value={form.gender}
            onChange={handleChange("gender")}
          >
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </PrettySelect>
        </StaffField>
        <StaffField label="Lớp" className="md:col-span-2">
          <PrettySelect
            className={inputClass}
            value={form.classId}
            onChange={handleChange("classId")}
          >
            <option value="">-- Chọn lớp --</option>
            {classOptions.map((item) => (
              <option key={item.classId} value={item.classId}>
                {item.className} · {item.gradeName} · {item.schoolYearName}
              </option>
            ))}
          </PrettySelect>
        </StaffField>
        <StaffField label="Địa chỉ" className="md:col-span-2">
          <input
            className={inputClass}
            value={form.address}
            onChange={handleChange("address")}
          />
        </StaffField>
        {isEdit && (
          <StaffField label="Trạng thái">
            <PrettySelect
              className={inputClass}
              value={form.status}
              onChange={handleChange("status")}
            >
              <option value="ACTIVE">Đang học</option>
              <option value="INACTIVE">Ngưng học</option>
            </PrettySelect>
          </StaffField>
        )}
      </StaffFormCard>
    </>
  );
}

export default StaffStudentFormPage;
