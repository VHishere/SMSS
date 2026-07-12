import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { adminApi } from "../../../api/client";
import StaffFormCard, {
  StaffField,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const ROLE_CHOICES = [
  { value: "STUDENT", label: "Học sinh" },
  { value: "PARENT", label: "Phụ huynh" },
  { value: "HOMEROOM_TEACHER", label: "Giáo viên chủ nhiệm" },
  { value: "SUBJECT_TEACHER", label: "Giáo viên bộ môn" },
  { value: "DORM_SUPERVISOR", label: "Quản nhiệm (Mentor)" },
  { value: "STAFF", label: "Nhân viên" },
  { value: "ADMIN", label: "Admin" },
];

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  roleName: "STUDENT",
  // student
  studentCode: "",
  dateOfBirth: "",
  gender: "OTHER",
  address: "",
  // parent
  relationship: "Father",
  isPrimary: false,
  // staff
  position: "",
  department: "",
  // teacher
  teacherCode: "",
  subjectSpecialize: "",
};

function AdminUserFormPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (field) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await adminApi.createUser(form);
      navigate("/admin/users");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isTeacherRole = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER"].includes(form.roleName);

  return (
    <>
      <StaffPageHeader
        title="Tạo tài khoản mới"
        action={
          <Link
            to="/admin/users"
            className="rounded-xl border border-[#08509F] px-4 py-2 text-sm font-semibold text-[#08509F] no-underline"
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
        title="Thông tin tài khoản"
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel="Tạo tài khoản"
      >
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

        <StaffField label="Số điện thoại">
          <input
            className={inputClass}
            value={form.phone}
            onChange={handleChange("phone")}
          />
        </StaffField>

        <StaffField label="Mật khẩu">
          <input
            type="password"
            className={inputClass}
            value={form.password}
            onChange={handleChange("password")}
            placeholder="Password@123"
            required
          />
        </StaffField>

        <StaffField label="Vai trò">
          <select
            className={inputClass}
            value={form.roleName}
            onChange={handleChange("roleName")}
          >
            {ROLE_CHOICES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </StaffField>

        {form.roleName === "STUDENT" && (
          <>
            <StaffField label="Mã học sinh">
              <input
                className={inputClass}
                value={form.studentCode}
                onChange={handleChange("studentCode")}
                required
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
              <select
                className={inputClass}
                value={form.gender}
                onChange={handleChange("gender")}
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
              </select>
            </StaffField>

            <StaffField label="Địa chỉ">
              <input
                className={inputClass}
                value={form.address}
                onChange={handleChange("address")}
              />
            </StaffField>
          </>
        )}

        {form.roleName === "PARENT" && (
          <>
            <StaffField label="Quan hệ">
              <select
                className={inputClass}
                value={form.relationship}
                onChange={handleChange("relationship")}
              >
                <option value="Father">Cha</option>
                <option value="Mother">Mẹ</option>
                <option value="Guardian">Người giám hộ</option>
              </select>
            </StaffField>

            <StaffField label="Liên hệ chính" className="flex-row items-center gap-2">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={handleChange("isPrimary")}
                className="h-4 w-4"
              />
            </StaffField>
          </>
        )}

        {form.roleName === "STAFF" && (
          <>
            <StaffField label="Chức vụ">
              <input
                className={inputClass}
                value={form.position}
                onChange={handleChange("position")}
              />
            </StaffField>

            <StaffField label="Phòng ban">
              <input
                className={inputClass}
                value={form.department}
                onChange={handleChange("department")}
              />
            </StaffField>
          </>
        )}

        {isTeacherRole && (
          <>
            <StaffField label="Mã giáo viên">
              <input
                className={inputClass}
                value={form.teacherCode}
                onChange={handleChange("teacherCode")}
              />
            </StaffField>

            <StaffField label="Chuyên môn">
              <input
                className={inputClass}
                value={form.subjectSpecialize}
                onChange={handleChange("subjectSpecialize")}
              />
            </StaffField>
          </>
        )}
      </StaffFormCard>
    </>
  );
}

export default AdminUserFormPage;
