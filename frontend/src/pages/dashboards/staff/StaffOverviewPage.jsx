import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBookOpen,
  FiCalendar,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

import { staffApi } from "../../../api/client";
import WelcomeBanner from "../../../components/molecules/WelcomeBanner";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StaffStatCard from "../../../components/staff/StaffStatCard";
import StatusBadge from "../../../components/staff/StatusBadge";
import { useAuth } from "../../../context/useAuth";
import { formatStatus } from "../../../utils/formatters";
import {
  resolveStaffWorkingSchoolYear,
  setStaffWorkingSchoolYearId,
} from "../../../utils/staffSchoolYear";

function StaffOverviewPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    staffApi
      .getSchoolYears()
      .then((schoolYearsRes) => {
        const workingYear = resolveStaffWorkingSchoolYear(
          schoolYearsRes.data || [],
        );
        const schoolYearId = workingYear
          ? String(workingYear.schoolYearId)
          : "";

        if (schoolYearId) {
          setStaffWorkingSchoolYearId(schoolYearId);
        }

        return Promise.all([
          staffApi.getOverview({ schoolYearId }),
          staffApi.getStudents({ schoolYearId }),
          staffApi.getParents({ schoolYearId }),
          staffApi.getClasses({ schoolYearId }),
        ]);
      })
      .then(([overviewRes, studentsRes, parentsRes, classesRes]) => {
        if (!isMounted) return;

        setOverview(overviewRes.data);
        setStudents(studentsRes.data.slice(0, 5));
        setParents(parentsRes.data.slice(0, 5));
        setClasses(classesRes.data.slice(0, 5));
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <WelcomeBanner name={user?.fullName ?? user?.username} />

      <StaffPageHeader title="Tổng quan Staff" />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaffStatCard
          label="Năm học hiện tại"
          value={loading ? "..." : overview?.schoolYearName ?? "-"}
          hint={`${overview?.totalSchoolYears ?? 0} năm học trong hệ thống`}
          icon={FiCalendar}
          accent="orange"
        />
        <StaffStatCard
          label="Lớp học"
          value={loading ? "..." : overview?.totalClasses ?? 0}
          hint="Lớp đang hoạt động"
          icon={FiBookOpen}
          accent="blue"
        />
        <StaffStatCard
          label="Tổng học sinh"
          value={loading ? "..." : overview?.totalStudents ?? 0}
          hint="Học sinh đang hoạt động"
          icon={FiUsers}
          accent="peach"
        />
        <StaffStatCard
          label="Giáo viên"
          value={loading ? "..." : overview?.totalTeachers ?? 0}
          hint={`${overview?.totalParents ?? 0} phụ huynh liên kết`}
          icon={FiUserCheck}
          accent="navy"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StaffDataTable
          title="Lớp học"
          description="Danh sách lớp theo năm học hiện tại"
          showSearch={false}
          searchValue=""
          onSearchChange={() => {}}
          isLoading={loading}
          getRowLink={(row) => `/staff/classes/${row.classId}`}
          columns={[
            {
              key: "className",
              label: "Lớp",
              render: (row) => row.className || "Chưa xếp lớp",
            },
            { key: "gradeName", label: "Khối" },
            { key: "studentCount", label: "HS" },
            { key: "teacherCount", label: "GV" },
          ]}
          rows={classes.map((item) => ({ ...item, id: item.classId }))}
        />

        <StaffDataTable
          title="Học sinh mới nhất"
          description="Hồ sơ học sinh trong hệ thống"
          showSearch={false}
          searchValue=""
          onSearchChange={() => {}}
          isLoading={loading}
          columns={[
            { key: "studentCode", label: "Mã HS" },
            { key: "fullName", label: "Họ tên" },
            { key: "className", label: "Lớp" },
            {
              key: "status",
              label: "Trạng thái",
              render: (row) => (
                <StatusBadge value={formatStatus(row.status)} tone="success" />
              ),
            },
          ]}
          rows={students.map((item) => ({ ...item, id: item.studentId }))}
        />
      </section>

      <StaffDataTable
        title="Phụ huynh liên kết"
        description="Thông tin phụ huynh và học sinh tương ứng"
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        columns={[
          { key: "fullName", label: "Phụ huynh" },
          { key: "studentName", label: "Học sinh" },
          { key: "phone", label: "Điện thoại" },
        ]}
        rows={parents.map((item) => ({ ...item, id: item.parentId }))}
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/staff/school-years"
          className="inline-flex items-center justify-center rounded-full bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-[#E55C0A] hover:text-white"
        >
          Quản lý năm học
        </Link>
        <Link
          to="/staff/classes"
          className="inline-flex items-center justify-center rounded-full border border-[#DFC0B2] bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50 hover:text-[#08509F]"
        >
          Quản lý lớp học
        </Link>
      </div>
    </>
  );
}

export default StaffOverviewPage;
