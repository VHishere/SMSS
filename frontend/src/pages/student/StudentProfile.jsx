import { useMemo } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiHome,
  FiMail,
  FiPhone,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import UserAvatar from "../../components/atoms/UserAvatar";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/AuthContext";
import { useStudentProfile } from "../../hooks/useStudentProfile";

function formatDate(value) {
  if (!value) {
    return "Chưa cập nhật";
  }

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

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
        <Icon size={20} />
      </div>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mb-0 text-base font-bold text-[#0F2747]">
        {value || "Chưa cập nhật"}
      </p>
    </div>
  );
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

function StudentProfile() {
  const { user } = useAuth();
  const {
    data: profile,
    loading,
    error,
  } = useStudentProfile();

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

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        profile?.schoolYearName || "Chưa cập nhật"
      }
    >
      <section className="mb-6 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-6 lg:px-8">
          <div className="flex items-center gap-5">
            <UserAvatar
              name={profile?.fullName || user?.fullName || "Học sinh"}
              src={profile?.avatar || user?.avatar}
              size="lg"
            />

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F27123]">
                Hồ sơ học sinh
              </p>

              <h1 className="mb-2 text-3xl font-bold text-[#0F2747]">
                {profile?.fullName || user?.fullName || "Học sinh"}
              </h1>

              <p className="mb-0 text-sm text-slate-500">
                Xem thông tin cá nhân, lớp học và phụ huynh liên hệ.
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải hồ sơ học sinh...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được hồ sơ học sinh: {error}
        </div>
      )}

      {!loading && !error && profile && (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              icon={FiShield}
              label="Mã học sinh"
              value={profile.studentCode}
            />

            <InfoCard
              icon={FiBookOpen}
              label="Lớp"
              value={profile.className}
            />

            <InfoCard
              icon={FiHome}
              label="Phòng học"
              value={profile.roomName}
            />

            <InfoCard
              icon={FiCalendar}
              label="Năm học"
              value={profile.schoolYearName}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm xl:col-span-2">
              <h3 className="mb-4 text-base font-bold text-[#0F2747]">
                Thông tin cá nhân
              </h3>

              <DetailRow
                label="Họ và tên"
                value={profile.fullName}
              />

              <DetailRow
                label="Email"
                value={profile.email}
              />

              <DetailRow
                label="Số điện thoại"
                value={profile.phone}
              />

              <DetailRow
                label="Ngày sinh"
                value={formatDate(profile.dateOfBirth)}
              />

              <DetailRow
                label="Giới tính"
                value={genderLabel(profile.gender)}
              />

              <DetailRow
                label="Địa chỉ"
                value={profile.address}
              />

              <DetailRow
                label="Trạng thái"
                value={profile.studentStatus}
              />
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
    </DashboardShell>
  );
}

export default StudentProfile;