import { useEffect, useMemo, useState } from "react";

import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import { staffApi } from "../../../api/client";

const inputCls =
  "w-full rounded-xl border border-orange-100 bg-white px-3 py-2 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:ring-2 focus:ring-orange-100";

const STATUS_BADGE = {
  OPEN:   { label: "Đang mở", bg: "#DCFCE7", text: "#15803D" },
  CLOSED: { label: "Đã đóng", bg: "#F1F5F9", text: "#475569" },
};

function AggregateModal({ survey, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    staffApi.getTeacherSurveyAggregate(survey.surveyId)
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [survey.surveyId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-[#0F2747]">Tổng hợp đánh giá (ẩn danh)</h3>
        <p className="mb-4 text-sm text-slate-500">GV {survey.teacherName}{survey.subjectName ? ` · ${survey.subjectName}` : ""} · {survey.semesterName}</p>
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        ) : data && (
          <>
            <div className="mb-4 flex items-center gap-6">
              <div>
                <p className="mb-0 text-3xl font-bold text-[#F27123]">{data.avgScore ?? "—"}</p>
                <p className="mb-0 text-xs text-slate-500">Điểm TB / 5</p>
              </div>
              <div>
                <p className="mb-0 text-3xl font-bold text-[#0F2747]">{data.responseCount}</p>
                <p className="mb-0 text-xs text-slate-500">Lượt đánh giá</p>
              </div>
            </div>
            <div className="mb-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = data.distribution?.[n] ?? 0;
                const pct = data.responseCount ? Math.round((c / data.responseCount) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-right font-semibold text-slate-600">{n}★</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#F27123]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-slate-500">{c}</span>
                  </div>
                );
              })}
            </div>
            {data.comments?.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-semibold text-[#0F2747]">Góp ý ({data.comments.length})</p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                  {data.comments.map((c, i) => (
                    <li key={i} className="rounded-lg bg-[#FFF7F2] px-3 py-2 text-sm text-slate-600">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function StaffSurveysPage() {
  const [surveys, setSurveys] = useState([]);
  const [lookups, setLookups] = useState({ teachers: [], semesters: [], subjects: [], classes: [] });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState({ semesterId: "", teacherId: "", subjectId: "", classId: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", isError: false });
  const [aggregate, setAggregate] = useState(null);

  useEffect(() => {
    let m = true;
    setLoading(true);
    Promise.all([staffApi.listTeacherSurveys(), staffApi.getLookups()])
      .then(([s, l]) => { if (!m) return; setSurveys(s.data); setLookups(l.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.semesterId || !form.teacherId) { setMsg({ text: "Chọn học kỳ và giáo viên.", isError: true }); return; }
    setSaving(true); setMsg({ text: "", isError: false });
    try {
      await staffApi.createTeacherSurvey({
        semesterId: Number(form.semesterId), teacherId: Number(form.teacherId),
        subjectId: form.subjectId ? Number(form.subjectId) : null,
        classId: form.classId ? Number(form.classId) : null,
        title: form.title.trim() || null,
      });
      setMsg({ text: "Đã tạo khảo sát.", isError: false });
      setForm({ semesterId: "", teacherId: "", subjectId: "", classId: "", title: "" });
      setRefresh((k) => k + 1);
    } catch (err) { setMsg({ text: err.message, isError: true }); } finally { setSaving(false); }
  }

  async function handleClose(id) {
    if (!window.confirm("Đóng khảo sát này?")) return;
    try { await staffApi.closeTeacherSurvey(id); setRefresh((k) => k + 1); } catch (err) { alert(err.message); }
  }

  const teacherName = useMemo(() => Object.fromEntries((lookups.teachers ?? []).map((t) => [t.teacherId, t.fullName])), [lookups]);

  return (
    <>
      <StaffPageHeader title="Khảo sát đánh giá giáo viên" description="Tạo khảo sát cuối kỳ (học sinh đánh giá ẩn danh) và xem tổng hợp." />

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-bold text-[#0F2747]">Tạo khảo sát mới</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <select className={inputCls} value={form.semesterId} onChange={set("semesterId")}>
            <option value="">— Học kỳ * —</option>
            {(lookups.semesters ?? []).map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
          </select>
          <select className={inputCls} value={form.teacherId} onChange={set("teacherId")}>
            <option value="">— Giáo viên * —</option>
            {(lookups.teachers ?? []).map((t) => <option key={t.teacherId} value={t.teacherId}>{t.fullName}</option>)}
          </select>
          <select className={inputCls} value={form.subjectId} onChange={set("subjectId")}>
            <option value="">— Môn (tùy chọn) —</option>
            {(lookups.subjects ?? []).map((s) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
          </select>
          <select className={inputCls} value={form.classId} onChange={set("classId")}>
            <option value="">— Lớp (tùy chọn, giới hạn HS) —</option>
            {(lookups.classes ?? []).map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <input className={`${inputCls} md:col-span-2`} placeholder="Tiêu đề (tùy chọn)" value={form.title} onChange={set("title")} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-full bg-[#F27123] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Đang tạo..." : "Tạo khảo sát"}
          </button>
          {msg.text && <span className={`text-xs font-medium ${msg.isError ? "text-red-600" : "text-green-600"}`}>{msg.text}</span>}
        </div>
      </form>

      {/* List */}
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : surveys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Chưa có khảo sát nào.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0F2747] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Giáo viên</th>
                <th className="px-4 py-3 font-semibold">Môn / Học kỳ</th>
                <th className="px-4 py-3 text-center font-semibold">Lượt / Điểm TB</th>
                <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {surveys.map((s) => {
                const st = STATUS_BADGE[s.status] ?? STATUS_BADGE.OPEN;
                return (
                  <tr key={s.surveyId} className="hover:bg-[#FFF9F4]">
                    <td className="px-4 py-3 font-medium text-[#0F2747]">{s.teacherName ?? teacherName[s.teacherId]}</td>
                    <td className="px-4 py-3 text-slate-500">{s.subjectName ?? "—"} · {s.semesterName}{s.className ? ` · ${s.className}` : ""}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#0F2747]">{s.responseCount} · {s.avgScore ?? "—"}</td>
                    <td className="px-4 py-3 text-center"><span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setAggregate(s)} className="mr-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#225DAD]">Tổng hợp</button>
                      {s.status === "OPEN" && <button type="button" onClick={() => handleClose(s.surveyId)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Đóng</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aggregate && <AggregateModal survey={aggregate} onClose={() => setAggregate(null)} />}
    </>
  );
}

export default StaffSurveysPage;
