import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiEdit3,
  FiHome,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiShield,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { studentApi } from "../../api/client";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "Chưa cập nhật";

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function genderLabel(value) {
  const labels = {
    MALE: "Nam",
    FEMALE: "Nữ",
    OTHER: "Khác",
  };

  return labels[value] || "Chưa cập nhật";
}

function relationshipLabel(value) {
  const labels = {
    FATHER: "Bố",
    MOTHER: "Mẹ",
    GUARDIAN: "Người giám hộ",
    OTHER: "Khác",
  };

  return labels[String(value || "").toUpperCase()] || value || "Chưa cập nhật";
}

function studentStatusMeta(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "ACTIVE") {
    return {
      label: "Đang học",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (normalized === "GRADUATED") {
    return {
      label: "Đã tốt nghiệp",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (normalized === "SUSPENDED") {
    return {
      label: "Tạm dừng",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Chưa cập nhật",
    className: "bg-slate-100 text-slate-600",
  };
}

function initials(value) {
  return String(value || "HS")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function InfoField({
  label,
  value,
  fullWidth = false,
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mb-0 text-sm font-bold leading-6 text-[#0F2747]">
        {value || "Chưa cập nhật"}
      </p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={`
        rounded-3xl border card-border bg-white
        p-5 shadow-sm
        ${className}
      `}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="mb-0 flex items-center gap-2 text-base font-extrabold text-[#0F2747]">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-[#0F4C8A]">
            <Icon size={15} />
          </span>
          {title}
        </h3>

        {action}
      </div>

      {children}
    </section>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[#0F4C8A]">
        <Icon size={15} />
      </span>

      <span className="min-w-0">
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </span>

        <span className="block truncate text-xs font-extrabold text-[#0F2747]">
          {value || "Chưa cập nhật"}
        </span>
      </span>
    </>
  );

  if (href && value) {
    return (
      <a
        href={href}
        className="flex items-center gap-3 rounded-xl px-2 py-2.5 no-underline transition hover:bg-slate-50"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
      {content}
    </div>
  );
}

function ParentCard({
  parent,
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 truncate text-sm font-extrabold text-[#0F2747]">
            {parent.fullName || "Chưa cập nhật"}
          </p>

          <p className="mb-0 text-[10px] font-bold uppercase tracking-wide text-[#F27123]">
            {relationshipLabel(parent.relationship)}
          </p>
        </div>

        {parent.isPrimary ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold text-emerald-700">
            Liên hệ chính
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="mb-0 flex items-center gap-2 text-xs text-slate-600">
          <FiPhone className="shrink-0 text-[#0F4C8A]" />
          <span className="truncate">{parent.phone || "Chưa cập nhật"}</span>
        </p>

        <p className="mb-0 flex items-center gap-2 text-xs text-slate-600">
          <FiMail className="shrink-0 text-[#0F4C8A]" />
          <span className="truncate">{parent.email || "Chưa cập nhật"}</span>
        </p>
      </div>
    </article>
  );
}

function EditProfileModal({
  profile,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    dateOfBirth: profile?.dateOfBirth || "",
    gender: profile?.gender || "OTHER",
    address: profile?.address || "",
  });

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }


  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Đóng hộp thoại"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-3">
          <div>
            <h3 className="mb-1 text-lg font-black text-[#0F2747]">
              Chỉnh sửa hồ sơ cá nhân
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {error ? (
            <p className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#0F2747]">
                Họ và tên
              </span>

              <input
                value={form.fullName}
                disabled
                title="Học sinh tạm thời không được phép thay đổi họ và tên."
                className={`${inputClass} cursor-not-allowed bg-slate-100 text-slate-500 opacity-80`}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#0F2747]">
                Số điện thoại
              </span>

              <input
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
                placeholder="VD: 0912345678"
                inputMode="numeric"
                maxLength={10}
                pattern="0[0-9]{9}"
                title="Số điện thoại gồm đúng 10 chữ số và bắt đầu bằng 0"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#0F2747]">
                Ngày sinh
              </span>

              <input
                type="date"
                value={form.dateOfBirth}
                max={getTodayInputValue()}
                onChange={(event) =>
                  updateField("dateOfBirth", event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#0F2747]">
                Giới tính
              </span>

              <PrettySelect
                value={form.gender}
                onChange={(event) =>
                  updateField("gender", event.target.value)
                }
                className={inputClass}
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </PrettySelect>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-extrabold text-[#0F2747]">
                Địa chỉ
              </span>

              <textarea
                rows={3}
                value={form.address}
                maxLength={500}
                onChange={(event) =>
                  updateField("address", event.target.value)
                }
                placeholder="Nhập địa chỉ hiện tại"
                className={`${inputClass} h-auto min-h-[100px] resize-y py-3`}
              />
              <span className="mt-1 block text-right text-xs text-slate-400">
                {form.address.length}/500
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F27123] px-7 text-sm font-extrabold text-white transition hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <FiSave />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StudentProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const response = await studentApi.getMyProfile();
      setProfile(response.data);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải hồ sơ học sinh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleUpdateProfile(form) {
    const phone = String(form.phone || "").trim();

    if (phone && !/^0\d{9}$/.test(phone)) {
      setError("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.");
      return;
    }

    if (String(form.address || "").trim().length > 500) {
      setError("Địa chỉ không được vượt quá 500 ký tự.");
      return;
    }

    if (form.dateOfBirth && form.dateOfBirth > getTodayInputValue()) {
      setError("Ngày sinh không được nằm trong tương lai.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await studentApi.updateMyProfile({
        ...form,
        phone,
      });

      setProfile(response.data);
      setShowEditModal(false);
      setSuccessMessage(
        response.message || "Đã cập nhật thông tin cá nhân.",
      );
    } catch (requestError) {
      setError(requestError.message || "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  const status = studentStatusMeta(profile?.studentStatus);

  const primaryParent = useMemo(
    () =>
      profile?.parents?.find((parent) => parent.isPrimary) ||
      profile?.parents?.[0] ||
      null,
    [profile],
  );

  return (
    <StudentDashboardShell context={profile}>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <span>Trang chủ</span>
        <span>/</span>
        <span className="font-bold text-[#0F2747]">Hồ sơ cá nhân</span>
      </div>

      {loading ? (
        <div className="rounded-3xl border card-border bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải hồ sơ học sinh...
        </div>
      ) : null}

      {!loading && error && !profile ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {!loading && profile ? (
        <>
          {successMessage ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <FiCheckCircle />
              {successMessage}
            </div>
          ) : null}

          <section className="relative mb-4 overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
            <div className="absolute right-0 top-0 h-32 w-44 rounded-bl-[100px] bg-slate-50" />

            <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-blue-50 text-2xl font-black text-[#0F4C8A] shadow-md">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.fullName || "Ảnh học sinh"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(profile.fullName)
                  )}
                </div>


              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h1 className="mb-0 text-2xl font-black text-[#0F2747]">
                    {profile.fullName}
                  </h1>

                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                    <FiUser
                      className="shrink-0 text-[#F27123]"
                      size={16}
                    />

                    <span className="font-semibold">
                      Mã học sinh:
                    </span>

                    <strong className="font-extrabold text-[#0F2747]">
                      {profile.studentCode || "Chưa cập nhật"}
                    </strong>
                  </p>

                  <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                    <FiBookOpen
                      className="shrink-0 text-[#F27123]"
                      size={16}
                    />

                    <span className="font-semibold">
                      Lớp:
                    </span>

                    <strong className="font-extrabold text-[#0F2747]">
                      {profile.className || "Chưa cập nhật"}
                    </strong>
                  </p>

                  <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                    <FiMapPin
                      className="shrink-0 text-[#F27123]"
                      size={16}
                    />

                    <span className="font-semibold">
                      Khối:
                    </span>

                    <strong className="font-extrabold text-[#0F2747]">
                      {profile.gradeName || "Chưa cập nhật"}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#F27123] px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d95f17] sm:self-auto"
              >
                <FiEdit3 />
                Chỉnh sửa
              </button>
            </div>
          </section>

          <div className="space-y-4">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0">
              <SectionCard
                icon={FiUser}
                title="Thông tin cá nhân"
                action={
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="text-xs font-bold text-[#0F4C8A] transition hover:text-[#F27123]"
                  >
                    Chỉnh sửa
                  </button>
                }
              >
                <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <InfoField label="Họ và tên" value={profile.fullName} />
                  <InfoField
                    label="Ngày sinh"
                    value={formatDate(profile.dateOfBirth)}
                  />
                  <InfoField
                    label="Giới tính"
                    value={genderLabel(profile.gender)}
                  />
                  <InfoField
                    label="Tình trạng"
                    value={status.label}
                  />
                  <InfoField
                    label="Địa chỉ"
                    value={profile.address}
                    fullWidth
                  />
                </div>
              </SectionCard>
              </div>

              <aside className="min-w-0">
              <SectionCard
                icon={FiPhone}
                title="Liên hệ"
              >
                <div className="space-y-1">
                  <ContactRow
                    icon={FiPhone}
                    label="Số điện thoại"
                    value={profile.phone}
                    href={
                      profile.phone
                        ? `tel:${profile.phone}`
                        : undefined
                    }
                  />

                  <ContactRow
                    icon={FiMail}
                    label="Email"
                    value={profile.email}
                    href={
                      profile.email
                        ? `mailto:${profile.email}`
                        : undefined
                    }
                  />

                  <ContactRow
                    icon={FiMapPin}
                    label="Địa chỉ"
                    value={profile.address}
                  />
                </div>
              </SectionCard>
              </aside>
            </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard
                  icon={FiBookOpen}
                  title="Thông tin học tập"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-sm font-medium text-slate-500">
                        Lớp học
                      </span>

                      <strong className="text-right text-sm text-[#0F2747]">
                        {profile.className || "Chưa cập nhật"}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-sm font-medium text-slate-500">
                        Khối
                      </span>

                      <strong className="text-right text-sm text-[#0F2747]">
                        {profile.gradeName || "Chưa cập nhật"}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-sm font-medium text-slate-500">
                        Phòng học
                      </span>

                      <strong className="text-right text-sm text-[#0F2747]">
                        {profile.roomName || "Chưa cập nhật"}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-sm font-medium text-slate-500">
                        Năm học
                      </span>

                      <strong className="text-right text-sm text-[#0F2747]">
                        {profile.schoolYearName || "Chưa cập nhật"}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-4 border-slate-100 pt-3">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                      <FiShield className="text-[#F27123]" />
                      Giáo viên chủ nhiệm
                    </h4>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0F4C8A] text-sm font-black text-white">
                          {initials(profile.homeroomTeacherName || "GV")}
                        </span>

                        <div className="min-w-0">
                          <p className="mb-0 truncate text-sm font-extrabold text-[#0F2747]">
                            {profile.homeroomTeacherName || "Chưa cập nhật"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-blue-100 pt-3">
                        <p className="mb-0 flex items-center gap-2 text-xs text-blue-800">
                          <FiPhone className="shrink-0" />
                          <span className="truncate">
                            {profile.homeroomTeacherPhone || "Chưa cập nhật"}
                          </span>
                        </p>

                        <p className="mb-0 flex items-center gap-2 text-xs text-blue-800">
                          <FiMail className="shrink-0" />
                          <span className="truncate">
                            {profile.homeroomTeacherEmail || "Chưa cập nhật"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={FiUsers}
                  title="Thông tin gia đình"
                >
                  {profile.parents?.length > 0 ? (
                    <div className="space-y-3">
                      {profile.parents.map((parent) => (
                        <ParentCard
                          key={parent.parentId}
                          parent={parent}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                      <FiUsers
                        className="mx-auto mb-2 text-slate-300"
                        size={22}
                      />

                      <p className="mb-0 text-xs text-slate-500">
                        Chưa có thông tin phụ huynh.
                      </p>
                    </div>
                  )}

                  {primaryParent ? (
                    <div className="mt-4 pt-3">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                        <FiHome className="text-[#F27123]" />
                        Liên hệ khẩn cấp
                      </h4>

                      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="mb-1 truncate text-sm font-extrabold text-red-800">
                              {primaryParent.fullName || "Chưa cập nhật"}
                            </p>

                            <p className="mb-0 text-[10px] font-bold uppercase tracking-wide text-red-500">
                              {relationshipLabel(primaryParent.relationship)}
                            </p>
                          </div>

                          <p className="mb-0 flex shrink-0 items-center gap-2 text-sm font-semibold text-red-700">
                            <FiPhone />
                            {primaryParent.phone || "Chưa cập nhật"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </SectionCard>
              </div>
          </div>

          {showEditModal ? (
            <EditProfileModal
              profile={profile}
              saving={saving}
              error={error}
              onClose={() => {
                if (!saving) {
                  setShowEditModal(false);
                  setError("");
                }
              }}
              onSubmit={handleUpdateProfile}
            />
          ) : null}
        </>
      ) : null}
    </StudentDashboardShell>
  );
}

export default StudentProfile;