import { useMemo } from "react";
import {
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiUser,
} from "react-icons/fi";

import { useAuth } from "../../context/useAuth";

function initials(value) {
  return String(value || "QT")
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

function AdminProfilePage() {
  const { user, loading } = useAuth();

  const primaryRole = useMemo(() => {
    const roles = user?.roles || [];

    return (
      roles.find((role) => role.roleName === "ADMIN") ||
      roles[0] ||
      null
    );
  }, [user]);

  const roleLabel =
    primaryRole?.description || "Quản trị viên hệ thống";

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <span>Trang chủ</span>
        <span>/</span>
        <span className="font-bold text-[#0F2747]">Hồ sơ cá nhân</span>
      </div>

      {loading ? (
        <div className="rounded-3xl border card-border bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải hồ sơ quản trị viên...
        </div>
      ) : null}

      {!loading && !user ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không thể tải hồ sơ quản trị viên.
        </div>
      ) : null}

      {!loading && user ? (
        <>
          <section className="relative mb-4 overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
            <div className="absolute right-0 top-0 h-32 w-44 rounded-bl-[100px] bg-slate-50" />

            <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-blue-50 text-2xl font-black text-[#0F4C8A] shadow-md">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.fullName || "Ảnh quản trị viên"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(user.fullName || user.username)
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h1 className="mb-0 text-2xl font-black text-[#0F2747]">
                    {user.fullName || "Chưa cập nhật họ tên"}
                  </h1>

                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                    Đang hoạt động
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                    <FiUser
                      className="shrink-0 text-[#F27123]"
                      size={16}
                    />

                    <span className="font-semibold">
                      Tên đăng nhập:
                    </span>

                    <strong className="font-extrabold text-[#0F2747]">
                      {user.username || "Chưa cập nhật"}
                    </strong>
                  </p>

                  <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                    <FiShield
                      className="shrink-0 text-[#F27123]"
                      size={16}
                    />

                    <span className="font-semibold">
                      Vai trò:
                    </span>

                    <strong className="font-extrabold text-[#0F2747]">
                      {roleLabel}
                    </strong>
                  </p>

                  <p className="mb-0 inline-flex items-center gap-2 text-sm text-slate-500">
                    <FiMail
                      className="shrink-0 text-[#F27123]"
                      size={16}
                    />

                    <span className="font-semibold">
                      Email:
                    </span>

                    <strong className="font-extrabold text-[#0F2747]">
                      {user.email || "Chưa cập nhật"}
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0">
                <SectionCard
                  icon={FiUser}
                  title="Thông tin cá nhân"
                >
                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    <InfoField label="Họ và tên" value={user.fullName} />
                    <InfoField label="Tên đăng nhập" value={user.username} />
                    <InfoField
                      label="Vai trò"
                      value={primaryRole?.roleName || "ADMIN"}
                    />
                    <InfoField label="Tình trạng" value="Đang hoạt động" />
                    <InfoField
                      label="Mô tả vai trò"
                      value={roleLabel}
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
                      value={user.phone}
                      href={user.phone ? `tel:${user.phone}` : undefined}
                    />

                    <ContactRow
                      icon={FiMail}
                      label="Email"
                      value={user.email}
                      href={user.email ? `mailto:${user.email}` : undefined}
                    />

                    <ContactRow
                      icon={FiMapPin}
                      label="Đơn vị"
                      value="Phòng quản trị hệ thống"
                    />
                  </div>
                </SectionCard>
              </aside>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default AdminProfilePage;
