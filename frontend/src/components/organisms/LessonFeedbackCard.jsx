import { useEffect, useState } from "react";

const RATING = {
  GOOD:              { label: "Tốt",         bg: "#DCFCE7", text: "#15803D" },
  NORMAL:            { label: "Bình thường", bg: "#EBF3FF", text: "#225DAD" },
  NEEDS_IMPROVEMENT: { label: "Cần cố gắng", bg: "#FEF3C7", text: "#B45309" },
};

/**
 * Nhận xét theo tiết (GV bộ môn → học sinh). Dùng chung cho portal học sinh & phụ huynh.
 * Prop `fetcher`: async () => feedbackArray. `title` tùy chọn.
 */
function LessonFeedbackCard({ fetcher, title = "Nhận xét theo tiết" }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    Promise.resolve(fetcher())
      .then((res) => { if (m) setItems(res.data ?? []); })
      .catch((e) => { if (m) setError(e.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [fetcher]);

  if (loading) return <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />;
  if (error) return null; // im lặng nếu lỗi — không chặn trang chính
  if (!items || items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
      <div className="border-b border-orange-100 px-5 py-4">
        <h3 className="text-base font-bold text-[#0F2747]">{title}</h3>
        <p className="mb-0 text-xs text-slate-500">Nhận xét của giáo viên bộ môn theo từng tiết học.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.slice(0, 20).map((f) => {
          const r = RATING[f.rating];
          return (
            <li key={f.feedbackId} className="flex flex-wrap items-start gap-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#0F2747]">{f.subjectName}</span>
                  <span className="text-xs text-slate-400">Tiết {f.periodNo} · {f.feedbackDate} · {f.teacherName}</span>
                  {r && <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: r.bg, color: r.text }}>{r.label}</span>}
                </div>
                {f.content && <p className="mb-0 mt-1 text-sm text-slate-600">{f.content}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default LessonFeedbackCard;
