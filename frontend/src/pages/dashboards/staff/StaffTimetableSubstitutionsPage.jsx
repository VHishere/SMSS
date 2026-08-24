import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiRefreshCw } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const STATUS = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-50 text-red-600" },
  CANCELLED: { label: "Đã hủy", className: "bg-slate-100 text-slate-600" },
};

function formatDateVN(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function StaffTimetableSubstitutionsPage() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(() => {
    setLoading(true);
    staffApi
      .getTimetableSubstitutions({ status, limit: 100 })
      .then((res) => {
        setItems(res.data?.items || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <>
      <StaffPageHeader
        title="Yêu cầu đổi tiết"
        action={
          <button
            type="button"
            onClick={loadRequests}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#08509F] bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:bg-blue-50"
          >
            <FiRefreshCw />
            Tải lại
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 px-5 py-4">
          <div>
            <h2 className="mb-1 text-xl font-bold text-[#0F2747]">
              Danh sách yêu cầu đổi tiết
            </h2>
            <p className="mb-0 text-sm text-slate-500">
              Staff xem chi tiết rồi xác nhận để chỉ tiết học trong ngày được chọn có hiệu lực đổi giáo viên.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  status === key
                    ? "bg-[#F27123] text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Môn học</th>
                <th className="px-5 py-4">Lớp</th>
                <th className="px-5 py-4">Tiết</th>
                <th className="px-5 py-4">Ngày áp dụng</th>
                <th className="px-5 py-4">Giáo viên yêu cầu</th>
                <th className="px-5 py-4">Giáo viên thay</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Đang tải yêu cầu đổi tiết...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Không có yêu cầu đổi tiết ở trạng thái này.
                  </td>
                </tr>
              )}
              {!loading && items.map((item) => {
                const statusMeta = STATUS[item.status] || STATUS.PENDING;
                return (
                  <tr key={item.substitutionId} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-[#0F2747]">{item.subjectName}</td>
                    <td className="px-5 py-4">{item.className}</td>
                    <td className="px-5 py-4">Tiết {item.periodNo} · {item.startTime}-{item.endTime}</td>
                    <td className="px-5 py-4">{formatDateVN(item.targetDate)}</td>
                    <td className="px-5 py-4">{item.requesterName}</td>
                    <td className="px-5 py-4">{item.substituteName || "Staff sắp xếp"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Link
                        to={`/staff/timetable-substitutions/${item.substitutionId}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#08509F] no-underline transition hover:bg-blue-50"
                        title="Xem chi tiết"
                      >
                        <FiEye />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default StaffTimetableSubstitutionsPage;
