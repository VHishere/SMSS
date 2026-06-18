import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDetailCard, { StaffDetailItem } from "../../../components/staff/StaffDetailCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import { formatRelationship } from "../../../utils/formatters";

function StaffParentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parent, setParent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffApi
      .getParent(id)
      .then((res) => setParent(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;
  }

  if (error || !parent) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error || "Không tìm thấy phụ huynh"}
      </div>
    );
  }

  return (
    <>
      <StaffPageHeader
        title={parent.fullName}
        description="Thông tin phụ huynh và học sinh liên kết"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/staff/parents/${id}/edit`)}
              className="rounded-xl bg-[#F27123] px-4 py-2 text-sm font-semibold text-white"
            >
              Chỉnh sửa
            </button>
            <Link
              to="/staff/parents"
              className="rounded-xl border border-[#08509F] px-4 py-2 text-sm font-semibold text-[#08509F] no-underline"
            >
              Quay lại
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StaffDetailCard title="Thông tin phụ huynh">
          <div className="grid gap-4 sm:grid-cols-2">
            <StaffDetailItem label="Họ tên" value={parent.fullName} />
            <StaffDetailItem label="Email" value={parent.email} />
            <StaffDetailItem label="Điện thoại" value={parent.phone} />
            <StaffDetailItem
              label="Quan hệ"
              value={formatRelationship(parent.relationship)}
            />
            <StaffDetailItem
              label="Liên hệ chính"
              value={parent.isPrimary ? "Có" : "Không"}
            />
            <StaffDetailItem label="Trạng thái" value={parent.status} />
          </div>
        </StaffDetailCard>

        <StaffDetailCard title="Học sinh liên kết">
          {parent.students?.length ? (
            <div className="space-y-3">
              {parent.students.map((student) => (
                <Link
                  key={student.studentId}
                  to={`/staff/students/${student.studentId}`}
                  className="block rounded-xl bg-[#FFF7F2] p-3 no-underline transition hover:bg-[#FFE7D6]"
                >
                  <p className="mb-1 font-semibold text-[#0F2747]">
                    {student.studentName}
                  </p>
                  <p className="mb-0 text-xs text-slate-500">
                    {student.studentCode} · {student.className || "Chưa có lớp"} ·{" "}
                    {formatRelationship(student.relationship)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa liên kết học sinh</p>
          )}
        </StaffDetailCard>
      </div>
    </>
  );
}

export default StaffParentDetailPage;
