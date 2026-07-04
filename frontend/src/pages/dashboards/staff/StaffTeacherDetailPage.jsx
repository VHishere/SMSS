import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDetailCard, { StaffDetailItem } from "../../../components/staff/StaffDetailCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import {
  formatAccountStatus,
  formatTeacherType,
} from "../../../utils/formatters";

const ROLE_LABELS = {
  HOMEROOM_TEACHER: "Giáo viên chủ nhiệm",
  SUBJECT_TEACHER: "Giáo viên bộ môn",
};

function StaffTeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffApi
      .getTeacher(id)
      .then((res) => setTeacher(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;
  }

  if (error || !teacher) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error || "Không tìm thấy giáo viên"}
      </div>
    );
  }

  return (
    <>
      <StaffPageHeader
        title={teacher.fullName}
        description={`Mã GV: ${teacher.teacherCode}`}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/staff/teachers/${id}/edit`)}
              className="rounded-xl bg-[#F27123] px-4 py-2 text-sm font-semibold text-white"
            >
              Chỉnh sửa
            </button>
            <Link
              to="/staff/teachers"
              className="rounded-xl border border-[#08509F] px-4 py-2 text-sm font-semibold text-[#08509F] no-underline"
            >
              Quay lại
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StaffDetailCard title="Thông tin giáo viên">
          <div className="grid gap-4">
            <StaffDetailItem label="Họ tên" value={teacher.fullName} />
            <StaffDetailItem label="Email" value={teacher.email} />
            <StaffDetailItem label="Điện thoại" value={teacher.phone} />
            <StaffDetailItem label="Chuyên môn" value={teacher.subjectSpecialize} />
            <StaffDetailItem
              label="Loại tài khoản"
              value={formatTeacherType(teacher.isHomeroom)}
            />
            <StaffDetailItem
              label="Trạng thái"
              value={formatAccountStatus(teacher.status)}
            />
          </div>
        </StaffDetailCard>

        <StaffDetailCard title="Lớp phụ trách">
          <p className="mb-3 text-3xl font-bold text-[#08509F]">
            {teacher.classes?.length || 0}
          </p>
          <Link
            to="/staff/classes"
            className="text-sm font-semibold text-[#08509F] no-underline"
          >
            Phân công vào lớp →
          </Link>
        </StaffDetailCard>
      </div>

      <StaffDetailCard title="Danh sách lớp đang phụ trách">
        {teacher.classes?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#FFF7F2] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Lớp</th>
                  <th className="px-4 py-2 text-left">Khối</th>
                  <th className="px-4 py-2 text-left">Năm học</th>
                  <th className="px-4 py-2 text-left">Vai trò</th>
                  <th className="px-4 py-2 text-left">Môn</th>
                </tr>
              </thead>
              <tbody>
                {teacher.classes.map((item) => (
                  <tr key={item.teacherClassId} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        to={`/staff/classes/${item.classId}`}
                        className="font-semibold text-[#08509F] no-underline"
                      >
                        {item.className}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{item.gradeName}</td>
                    <td className="px-4 py-3">{item.schoolYearName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        value={ROLE_LABELS[item.roleInClass] || item.roleInClass}
                        tone={
                          item.roleInClass === "HOMEROOM_TEACHER"
                            ? "success"
                            : "info"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">{item.subjectName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Chưa được phân công lớp. Vào mục Lớp học để thêm giáo viên vào lớp.
          </p>
        )}
      </StaffDetailCard>
    </>
  );
}

export default StaffTeacherDetailPage;
