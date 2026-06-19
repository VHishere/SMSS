import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { parentApi } from "../../api/client";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import {
  formatGender,
  formatStatus,
} from "../../utils/formatters";

function DetailCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-[#0F2747]">{title}</h3>
      {children}
    </section>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mb-0 text-sm font-medium text-[#0F2747]">{value || "—"}</p>
    </div>
  );
}

function ParentStudentProfilePage() {
  const { studentId } = useParams();
  const { user } = useAuth();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    parentApi
      .getStudentProfile(studentId)
      .then((res) => setStudent(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const headerUser = useMemo(() => {
    const parentRole = user?.roles?.find((r) => r.roleName === "PARENT");
    return {
      name: user?.fullName || user?.username || "Phụ huynh",
      role: parentRole?.description || "Phụ huynh",
      avatar: user?.avatar || "",
    };
  }, [user]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={student?.schoolYearName || "Chưa cập nhật"}
    >
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {loading ? (
            <div className="mb-1 h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          ) : (
            <h1 className="mb-1 text-2xl font-bold text-[#0F2747]">
              {student?.fullName || "Hồ sơ học sinh"}
            </h1>
          )}
          {student && (
            <p className="mb-0 text-sm text-slate-500">
              Mã HS: {student.studentCode}
            </p>
          )}
        </div>

        <Link
          to="/parent"
          className="
            rounded-xl border border-[#08509F]
            px-4 py-2 text-sm font-semibold
            text-[#08509F] no-underline
            transition hover:bg-blue-50
          "
        >
          Quay lại
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && student && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Personal info */}
          <DetailCard title="Thông tin cá nhân">
            <div className="flex flex-col gap-4">
              {student.avatar && (
                <img
                  src={student.avatar}
                  alt={student.fullName}
                  className="h-20 w-20 rounded-full object-cover"
                />
              )}
              <DetailItem label="Họ tên" value={student.fullName} />
              <DetailItem label="Email" value={student.email} />
              <DetailItem label="Điện thoại" value={student.phone} />
              <DetailItem label="Ngày sinh" value={student.dateOfBirth} />
              <DetailItem label="Giới tính" value={formatGender(student.gender)} />
              <DetailItem label="Địa chỉ" value={student.address} />
              <DetailItem label="Trạng thái" value={formatStatus(student.studentStatus)} />
            </div>
          </DetailCard>

          {/* Class info */}
          <DetailCard title="Thông tin lớp học">
            <div className="flex flex-col gap-4">
              <DetailItem label="Lớp" value={student.className} />
              <DetailItem label="Phòng học" value={student.roomName} />
              <DetailItem label="Khối" value={student.gradeName} />
              <DetailItem label="Năm học" value={student.schoolYearName} />
            </div>

            {student.classId && (
              <Link
                to={`/parent/timetable?student=${studentId}`}
                className="
                  mt-5 flex items-center gap-1.5
                  text-sm font-semibold
                  text-[#08509F] no-underline
                  transition hover:text-[#06408A]
                "
              >
                Xem thời khóa biểu →
              </Link>
            )}
          </DetailCard>

          {/* Homeroom teacher */}
          <DetailCard title="Giáo viên chủ nhiệm">
            {student.homeroomTeacherId ? (
              <div className="flex items-start gap-4">
                {student.homeroomTeacherAvatar ? (
                  <img
                    src={student.homeroomTeacherAvatar}
                    alt={student.homeroomTeacherName}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="
                      flex h-12 w-12 shrink-0 items-center
                      justify-center rounded-full
                      bg-[#0F2747] text-lg
                      font-bold text-white
                    "
                  >
                    {student.homeroomTeacherName?.[0] || "?"}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <DetailItem label="Họ tên" value={student.homeroomTeacherName} />
                  <DetailItem label="Email" value={student.homeroomTeacherEmail} />
                  <DetailItem label="Điện thoại" value={student.homeroomTeacherPhone} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Chưa có giáo viên chủ nhiệm
              </p>
            )}
          </DetailCard>
        </div>
      )}
    </DashboardShell>
  );
}

export default ParentStudentProfilePage;
