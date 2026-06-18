import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffFormCard, { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  relationship: "Father",
  isPrimary: true,
  studentId: "",
  status: "ACTIVE",
};

function StaffParentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [lookups, setLookups] = useState({ students: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    staffApi
      .getParent(id)
      .then((res) => {
        const data = res.data;
        setForm({
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          relationship: data.relationship || "Father",
          isPrimary: Boolean(data.isPrimary),
          studentId: data.students?.[0]?.studentId
            ? String(data.students[0].studentId)
            : "",
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

    const payload = {
      ...form,
      studentId: form.studentId ? Number(form.studentId) : null,
    };

    try {
      if (isEdit) {
        await staffApi.updateParent(id, payload);
        navigate(`/staff/parents/${id}`);
      } else {
        const res = await staffApi.createParent(payload);
        navigate(`/staff/parents/${res.data.parentId}`);
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
        title={isEdit ? "Chỉnh sửa phụ huynh" : "Thêm phụ huynh mới"}
        description="Nhập thông tin phụ huynh và liên kết học sinh"
        action={
          <Link
            to={isEdit ? `/staff/parents/${id}` : "/staff/parents"}
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
        title="Thông tin phụ huynh"
        onSubmit={handleSubmit}
        loading={saving}
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
        <StaffField label="Điện thoại">
          <input
            className={inputClass}
            value={form.phone}
            onChange={handleChange("phone")}
          />
        </StaffField>
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
        <StaffField label="Học sinh liên kết">
          <select
            className={inputClass}
            value={form.studentId}
            onChange={handleChange("studentId")}
          >
            <option value="">-- Chọn học sinh --</option>
            {lookups.students.map((item) => (
              <option key={item.studentId} value={item.studentId}>
                {item.studentCode} · {item.fullName}
              </option>
            ))}
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

export default StaffParentFormPage;
