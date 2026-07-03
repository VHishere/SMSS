import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCamera,
  FiEdit3,
  FiMail,
  FiPhone,
  FiSave,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { studentApi } from "../../api/client";

function formatDate(value) {
  if (!value) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN").format(
    new Date(value),
  );
}

function genderLabel(value) {
  const labels = {
    MALE: "Nam",
    FEMALE: "Nữ",
    OTHER: "Khác",
  };

  return labels[value] || "Chưa cập nhật";
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm font-medium text-slate-500">
        {label}
      </span>

      <span className="text-right text-sm font-bold text-[#0F2747]">
        {value || "Chưa cập nhật"}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-[#0F2747]">
        {label}
      </span>

      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100";

function StudentProfile() {
  const { user } = useAuth();
  const avatarInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    avatarFile: null,
    avatarPreview: "",
    dateOfBirth: "",
    gender: "OTHER",
    address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const response = await studentApi.getMyProfile();
      setProfile(response.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const headerUser = useMemo(() => {
    const studentRole = user?.roles?.find(
      (role) => role.roleName === "STUDENT",
    );

    return {
      name:
        profile?.fullName ||
        user?.fullName ||
        user?.username ||
        "Học sinh",
      role: studentRole?.description || "Học sinh",
      avatar: profile?.avatar || user?.avatar || "",
    };
  }, [profile, user]);

  function openEditForm() {
    setForm({
      fullName: profile?.fullName || "",
      phone: profile?.phone || "",
      avatarFile: null,
      avatarPreview: profile?.avatar || "",
      dateOfBirth: profile?.dateOfBirth || "",
      gender: profile?.gender || "OTHER",
      address: profile?.address || "",
    });

    setSuccessMessage("");
    setError("");
    setEditMode(true);
  }

  function closeEditForm() {
    setEditMode(false);
    setSuccessMessage("");
    setError("");
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAvatarChange(event) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh.");
      return;
    }

    setError("");

    setForm((current) => ({
      ...current,
      avatarFile: selectedFile,
      avatarPreview: URL.createObjectURL(selectedFile),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await studentApi.updateMyProfile(form);

      setProfile(response.data);
      setEditMode(false);
      setSuccessMessage(response.message || "Đã cập nhật hồ sơ");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        profile?.schoolYearName || "Chưa cập nhật"
      }
    >
      {!editMode && profile && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={openEditForm}
            className="group inline-flex items-center gap-2 !rounded-[10px] border border-orange-200 bg-white px-3 py-2 text-sm font-bold text-[#F27123] shadow-sm transition hover:-translate-y-0.5 hover:border-[#F27123] hover:bg-[#FFF7F2] hover:shadow-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF7F2] text-[#F27123] transition group-hover:bg-[#F27123] group-hover:text-white">
              <FiEdit3 size={16} />
            </span>
            Cập nhật thông tin
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải hồ sơ học sinh...
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
          {successMessage}
        </div>
      )}

      {!loading && profile && (
        <>
          {editMode ? (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="mb-1 text-lg font-black text-[#0F2747]">
                    Cập nhật thông tin
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={closeEditForm}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Field label="Họ và tên">
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      updateField("fullName", event.target.value)
                    }
                    className={inputClass}
                    required
                  />
                </Field>

                <Field label="Số điện thoại">
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Ngày sinh">
                  <input
                    type="date"
                    value={form.dateOfBirth || ""}
                    onChange={(event) =>
                      updateField("dateOfBirth", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Giới tính">
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      updateField("gender", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </Field>

                <Field label="Ảnh đại diện">
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-orange-100 bg-white p-2 text-lg font-bold text-[#F27123]">
                      {form.avatarPreview ? (
                        <img
                          src={form.avatarPreview}
                          alt="Avatar preview"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        profile?.fullName?.slice(0, 2)?.toUpperCase() || "HS"
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />

                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex items-center gap-2 !rounded-[10px] border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#F27123] transition hover:bg-[#FFF7F2]"
                      >
                        <FiCamera size={16} />
                        Chọn ảnh
                      </button>

                      {form.avatarFile && (
                        <p className="mt-2 mb-0 truncate text-xs font-medium text-slate-500">
                          Đã chọn: {form.avatarFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Field>

                <Field label="Địa chỉ">
                  <textarea
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    rows={3}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 !rounded-[10px] bg-[#F27123] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiSave size={16} />
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm xl:col-span-2">
                  <h3 className="mb-4 text-base font-bold text-[#0F2747]">
                    Thông tin cá nhân
                  </h3>

                  <DetailRow label="Họ và tên" value={profile.fullName} />
                  <DetailRow label="Mã học sinh" value={profile.studentCode} />
                  <DetailRow label="Lớp" value={profile.className} />
                  <DetailRow label="Email" value={profile.email} />
                  <DetailRow label="Số điện thoại" value={profile.phone} />
                  <DetailRow label="Ngày sinh" value={formatDate(profile.dateOfBirth)} />
                  <DetailRow label="Giới tính" value={genderLabel(profile.gender)} />
                  <DetailRow label="Địa chỉ" value={profile.address} />
                </div>

                <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-base font-bold text-[#0F2747]">
                    Giáo viên chủ nhiệm
                  </h3>

                  <div className="rounded-2xl bg-[#FFF7F2] p-4">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#F27123]">
                      <FiUser size={20} />
                    </div>

                    <p className="mb-1 text-base font-bold text-[#0F2747]">
                      {profile.homeroomTeacherName || "Chưa cập nhật"}
                    </p>

                    <p className="mb-1 flex items-center gap-2 text-sm text-slate-600">
                      <FiMail size={15} />
                      {profile.homeroomTeacherEmail || "Chưa cập nhật"}
                    </p>

                    <p className="mb-0 flex items-center gap-2 text-sm text-slate-600">
                      <FiPhone size={15} />
                      {profile.homeroomTeacherPhone || "Chưa cập nhật"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#08509F]">
                    <FiUsers size={19} />
                  </div>

                  <div>
                    <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                      Phụ huynh liên hệ
                    </h3>

                    <p className="mb-0 text-sm text-slate-500">
                      Danh sách phụ huynh được liên kết với học sinh.
                    </p>
                  </div>
                </div>

                {profile.parents?.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {profile.parents.map((parent) => (
                      <div
                        key={parent.parentId}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <p className="mb-1 text-base font-bold text-[#0F2747]">
                          {parent.fullName}
                        </p>

                        <p className="mb-1 text-sm text-slate-600">
                          Quan hệ: {parent.relationship || "Chưa cập nhật"}
                        </p>

                        <p className="mb-1 text-sm text-slate-600">
                          Email: {parent.email || "Chưa cập nhật"}
                        </p>

                        <p className="mb-0 text-sm text-slate-600">
                          SĐT: {parent.phone || "Chưa cập nhật"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Chưa có thông tin phụ huynh.
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default StudentProfile;