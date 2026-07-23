import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffFormCard, {
  StaffField,
  cancelLinkClass,
  checkboxClass,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const emptyForm = {
  teacherCode: "",
  fullName: "",
  email: "",
  phone: "",
  subjectSpecialize: "",
  isHomeroom: false,
  status: "ACTIVE",
};

function StaffTeacherFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [lookups, setLookups] = useState({ subjects: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    staffApi
      .getTeacher(id)
      .then((res) => {
        const data = res.data;
        setForm({
          teacherCode: data.teacherCode || "",
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          subjectSpecialize: data.subjectSpecialize || "",
          isHomeroom: Boolean(data.isHomeroom),
          status: data.status || "ACTIVE",
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

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
      if (isEdit) {
        await staffApi.updateTeacher(id, form);
        navigate(`/staff/teachers/${id}`);
      } else {
        const res = await staffApi.createTeacher(form);
        navigate(`/staff/teachers/${res.data.teacherId}`);
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
        title={isEdit ? "Chỉnh sửa giáo viên" : "Thêm giáo viên mới"}
        action={
          <Link
            to={isEdit ? `/staff/teachers/${id}` : "/staff/teachers"}
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
        title="Thông tin giáo viên"
        onSubmit={handleSubmit}
        loading={saving}
        footer={
          !isEdit ? (
            <>
              Mật khẩu mặc định: <strong>Password@123</strong>. Phân công vào lớp tại mục Lớp học - chi tiết lớp.
            </>
          ) : (
            "Cập nhật thông tin tài khoản giáo viên."
          )
        }
      >
        <StaffField label="Mã giáo viên">
          <input
            className={inputClass}
            value={form.teacherCode}
            onChange={handleChange("teacherCode")}
            placeholder="VD: GV004"
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
        <StaffField label="Chuyên môn">
          <input
            className={inputClass}
            list="subject-options"
            value={form.subjectSpecialize}
            onChange={handleChange("subjectSpecialize")}
            placeholder="VD: Toán, Văn, Anh..."
          />
          <datalist id="subject-options">
            {lookups.subjects?.map((subject) => (
              <option key={subject.subjectId} value={subject.subjectName} />
            ))}
          </datalist>
        </StaffField>
        <StaffField label="Giáo viên chủ nhiệm" className="rounded-2xl border border-[#DFC0B2] bg-[#F9F9F9] p-4">
          <input
            type="checkbox"
            checked={form.isHomeroom}
            onChange={handleChange("isHomeroom")}
            className={checkboxClass}
          />
          <span className="text-xs font-normal text-slate-500">
            Bật nếu GV có thể làm GVCN (tự động cấp quyền GVCN + bộ môn)
          </span>
        </StaffField>
        {isEdit && (
          <StaffField label="Trạng thái">
            <select
              className={inputClass}
              value={form.status}
              onChange={handleChange("status")}
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngưng hoạt động</option>
            </select>
          </StaffField>
        )}
      </StaffFormCard>

    </>
  );
}

export default StaffTeacherFormPage;
