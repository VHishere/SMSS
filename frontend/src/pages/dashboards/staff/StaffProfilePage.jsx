import { FiMail, FiPhone, FiShield, FiUser } from "react-icons/fi";

import StaffDetailCard, {
  StaffDetailItem,
} from "../../../components/staff/StaffDetailCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import UserAvatar from "../../../components/atoms/UserAvatar";
import { useAuth } from "../../../context/useAuth";

function StaffProfilePage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const primaryRole = roles.find((role) =>
    ["STAFF", "ADMIN"].includes(role.roleName),
  ) || roles[0];

  return (
    <>
      <StaffPageHeader title="Hồ sơ cá nhân" />

      <section className="mb-6 rounded-3xl border border-[#DFC0B2] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex rounded-full border-2 border-[#F27123]">
              <UserAvatar
                name={user?.fullName || user?.username || "Staff"}
                src={user?.avatar || ""}
              />
            </span>

            <div>
              <h2 className="mb-1 text-2xl font-bold text-[#0F2747]">
                {user?.fullName || "Chưa cập nhật họ tên"}
              </h2>
              <p className="mb-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {primaryRole?.description || "Nhân viên phòng đào tạo/văn phòng"}
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-[#F27123]">
            <FiShield size={16} />
            {primaryRole?.roleName || "STAFF"}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StaffDetailCard title="Thông tin tài khoản">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <StaffDetailItem label="Tên đăng nhập" value={user?.username} />
            <StaffDetailItem label="Trạng thái" value="Đang hoạt động" />
            <StaffDetailItem label="Email" value={user?.email} />
            <StaffDetailItem label="Số điện thoại" value={user?.phone} />
          </div>
        </StaffDetailCard>

        <StaffDetailCard title="Vai trò trong hệ thống">
          <div className="space-y-3">
            {roles.length > 0 ? (
              roles.map((role) => (
                <div
                  key={role.roleId || role.roleName}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="mt-0.5 rounded-full bg-white p-2 text-[#08509F]">
                    <FiUser size={16} />
                  </span>
                  <div>
                    <p className="mb-0 text-sm font-bold text-[#0F2747]">
                      {role.description || role.roleName}
                    </p>
                    <p className="mb-0 text-xs font-semibold text-slate-500">
                      {role.roleName}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="mb-0 text-sm text-slate-500">Chưa có vai trò.</p>
            )}
          </div>
        </StaffDetailCard>
      </div>

      <section className="mt-6 rounded-3xl border border-[#DFC0B2] bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-bold text-[#1A1C1C]">Liên hệ</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <a
            href={user?.email ? `mailto:${user.email}` : undefined}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#FFF7F2] px-4 py-3 text-sm font-semibold text-[#0F2747] no-underline hover:text-[#F27123] hover:no-underline"
          >
            <FiMail size={18} />
            {user?.email || "Chưa cập nhật email"}
          </a>
          <a
            href={user?.phone ? `tel:${user.phone}` : undefined}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#FFF7F2] px-4 py-3 text-sm font-semibold text-[#0F2747] no-underline hover:text-[#F27123] hover:no-underline"
          >
            <FiPhone size={18} />
            {user?.phone || "Chưa cập nhật số điện thoại"}
          </a>
        </div>
      </section>
    </>
  );
}

export default StaffProfilePage;
