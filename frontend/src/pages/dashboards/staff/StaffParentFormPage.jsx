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
import PrettySelect from "../../../components/molecules/PrettySelect";

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
  // Các con khác của phụ huynh mà form này không chỉnh sửa — phải gửi lại khi
  // lưu, nếu không backend sẽ hiểu là staff muốn gỡ liên kết.
  const [otherStudentIds, setOtherStudentIds] = useState([]);
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
        const students = data.students || [];
        setForm({
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          relationship: data.relationship || "Father",
          isPrimary: Boolean(data.isPrimary),
          studentId: students[0]?.studentId ? String(students[0].studentId) : "",
          status: data.status || "ACTIVE",
        });
        setOtherStudentIds(students.slice(1).map((item) => item.studentId));
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
      studentIds: [
        ...new Set(
          [
            form.studentId ? Number(form.studentId) : null,
            ...otherStudentIds,
          ].filter(Boolean),
        ),
      ],
    };
    delete payload.studentId;

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
        action={
          <Link
            to={isEdit ? `/staff/parents/${id}` : "/staff/parents"}
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
        title="Thông tin phụ huynh"
        onSubmit={handleSubmit}
        loading={saving}
        footer="Thông tin này dùng để phụ huynh đăng nhập và theo dõi học sinh."
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
          <PrettySelect
            className={inputClass}
            value={form.relationship}
            onChange={handleChange("relationship")}
          >
            <option value="Father">Cha</option>
            <option value="Mother">Mẹ</option>
            <option value="Guardian">Người giám hộ</option>
          </PrettySelect>
        </StaffField>
        <StaffField label="Học sinh liên kết">
          <PrettySelect
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
          </PrettySelect>
          {otherStudentIds.length > 0 && (
            <p className="mt-2 mb-0 text-xs text-slate-500">
              Các con khác đang liên kết (được giữ nguyên khi lưu):{" "}
              {otherStudentIds
                .map((studentId) => {
                  const match = lookups.students.find(
                    (item) => item.studentId === studentId,
                  );
                  return match
                    ? `${match.studentCode} · ${match.fullName}`
                    : `#${studentId}`;
                })
                .join(", ")}
            </p>
          )}
        </StaffField>
        <StaffField label="Liên hệ chính" className="rounded-2xl border border-[#DFC0B2] bg-[#F9F9F9] p-4 md:self-end">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={handleChange("isPrimary")}
            className={checkboxClass}
          />
        </StaffField>
        {isEdit && (
          <StaffField label="Trạng thái">
            <PrettySelect
              className={inputClass}
              value={form.status}
              onChange={handleChange("status")}
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngưng hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
            </PrettySelect>
          </StaffField>
        )}
      </StaffFormCard>
    </>
  );
}

export default StaffParentFormPage;
