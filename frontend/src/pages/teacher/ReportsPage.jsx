import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAward, FiBarChart2, FiCalendar, FiClock, FiFileText, FiFlag, FiShield, FiTrash2, FiTrendingUp, FiUsers,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { reportApi } from "../../api/client";
import { formatDateTimeVN } from "../../utils/datetime";

const REPORT_CARDS = [
  { key: "ATTENDANCE",    label: "Chuyên cần",      desc: "Tỷ lệ có mặt, vắng, muộn theo lớp & thời gian", icon: FiCalendar,   color: "#F27123", bg: "#FFF0E8" },
  { key: "ACADEMIC",      label: "Học tập",         desc: "GPA, xếp hạng, hiệu suất theo môn",            icon: FiAward,      color: "#08509F", bg: "#EBF3FF" },
  { key: "BEHAVIOUR",     label: "Hạnh kiểm",       desc: "Điểm thưởng/trừ, hạnh kiểm theo lớp",          icon: FiShield,     color: "#16A34A", bg: "#ECFDF5" },
  { key: "PROGRESS",      label: "Tiến bộ học sinh", desc: "Tổng hợp học tập, chuyên cần, hạnh kiểm, rủi ro", icon: FiTrendingUp, color: "#F59E0B", bg: "#FFFBEB" },
  { key: "CLASS_SUMMARY", label: "Tổng hợp lớp",    desc: "Thống kê chung, HS tiêu biểu, HS cần chú ý",   icon: FiUsers,      color: "#0F2747", bg: "#FFF7F2" },
  { key: "GOAL",          label: "Hoàn thành mục tiêu", desc: "Tỷ lệ hoàn thành & danh sách mục tiêu của lớp", icon: FiFlag,    color: "#08509F", bg: "#EBF3FF" },
];

const SCHEDULE_LABEL = { NONE: "Không lịch", DAILY: "Hàng ngày", WEEKLY: "Hàng tuần", MONTHLY: "Hàng tháng" };

function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let m = true;
    reportApi.listTemplates().then((res) => { if (m) setTemplates(res.data); }).catch(() => {});
    reportApi.getHistory({ limit: 8 }).then((res) => { if (m) setHistory(res.data.items); }).catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  async function handleDeleteTemplate(t) {
    if (!window.confirm(`Xóa mẫu "${t.name}"?`)) return;
    try { await reportApi.deleteTemplate(t.templateId); setRefresh((k) => k + 1); }
    catch (err) { alert(err.message); }
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Khu vực" sidebarFooterValue="Báo cáo">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>Trung tâm báo cáo</h1>

      {/* Report type cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_CARDS.map((c) => (
          <button key={c.key} type="button" onClick={() => navigate(`/teacher/reports/builder?type=${c.key}`)}
            className="flex items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md" style={{ border: "1px solid #FFE7D6" }}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: c.bg }}>
              <c.icon size={20} style={{ color: c.color }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>{c.label}</h3>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Saved templates */}
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "#0F2747" }}><FiFileText size={15} /> Mẫu đã lưu</h3>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có mẫu nào. Tạo báo cáo rồi nhấn "Lưu mẫu".</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.templateId} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ border: "1px solid #FFE7D6" }}>
                  <button type="button" onClick={() => navigate(`/teacher/reports/builder?type=${t.reportType}&templateId=${t.templateId}`)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-[#0F2747]">{t.name}</p>
                    <p className="text-xs text-slate-400">
                      {REPORT_CARDS.find((c) => c.key === t.reportType)?.label ?? t.reportType}
                      {" · "}<FiClock size={10} className="inline" /> {SCHEDULE_LABEL[t.schedule]}
                      {t.lastRunAt ? ` · chạy lần cuối ${formatDateTimeVN(t.lastRunAt)}` : ""}
                    </p>
                  </button>
                  <button type="button" onClick={() => handleDeleteTemplate(t)} className="shrink-0 text-slate-400 hover:text-red-600"><FiTrash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent exports (audit log) */}
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "#0F2747" }}><FiBarChart2 size={15} /> Xuất gần đây</h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có lượt xuất nào.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.reportId} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#FFF7F2" }}>
                  <span className="truncate text-sm text-[#0F2747]">{h.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTimeVN(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default ReportsPage;
