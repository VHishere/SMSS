import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDetailCard, { StaffDetailItem } from "../../../components/staff/StaffDetailCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  formatGender,
  formatRelationship,
  formatStatus,
} from "../../../utils/formatters";

function StaffStudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffApi
      .getStudent(id)
      .then((res) => setStudent(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;
  }

  if (error || !student) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error || "Không tìm thấy học sinh"}
      </div>
    );
  }

  return (
    <>
      <StaffPageHeader
        title={student.fullName}
        description={`Mã HS: ${student.studentCode}`}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/staff/students/${id}/edit`)}
              className="rounded-xl bg-[#F27123] px-4 py-2 text-sm font-semibold text-white"
            >
              Chỉnh sửa
            </button>
            <Link
              to="/staff/students"
              className="rounded-xl border border-[#08509F] px-4 py-2 text-sm font-semibold text-[#08509F] no-underline"
            >
              Quay lại
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StaffDetailCard title="Thông tin cá nhân">
          <div className="grid gap-4">
            <StaffDetailItem label="Họ tên" value={student.fullName} />
            <StaffDetailItem label="Email" value={student.email} />
            <StaffDetailItem label="Điện thoại" value={student.phone} />
            <StaffDetailItem label="Ngày sinh" value={student.dateOfBirth} />
            <StaffDetailItem label="Giới tính" value={formatGender(student.gender)} />
            <StaffDetailItem label="Địa chỉ" value={student.address} />
            <StaffDetailItem
              label="Trạng thái"
              value={formatStatus(student.status)}
            />
          </div>
        </StaffDetailCard>

        <StaffDetailCard title="Thông tin lớp học">
          <div className="grid gap-4">
            <StaffDetailItem label="Lớp" value={student.className} />
            <StaffDetailItem label="Khối" value={student.gradeName} />
            <StaffDetailItem label="Năm học" value={student.schoolYearName} />
          </div>
          {student.className && (
            <Link
              to="/staff/classes"
              className="mt-4 inline-block text-sm font-semibold text-[#08509F] no-underline"
            >
              Quản lý lớp học →
            </Link>
          )}
        </StaffDetailCard>

        <StaffDetailCard title="Phụ huynh liên kết">
          {student.parents?.length ? (
            <div className="space-y-3">
              {student.parents.map((parent) => (
                <Link
                  key={parent.parentId}
                  to={`/staff/parents/${parent.parentId}`}
                  className="block rounded-xl bg-[#FFF7F2] p-3 no-underline transition hover:bg-[#FFE7D6]"
                >
                  <p className="mb-1 font-semibold text-[#0F2747]">
                    {parent.fullName}
                  </p>
                  <p className="mb-0 text-xs text-slate-500">
                    {formatRelationship(parent.relationship)} · {parent.phone}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa liên kết phụ huynh</p>
          )}
        </StaffDetailCard>
      </div>
    </>
  );
}

export default StaffStudentDetailPage;
