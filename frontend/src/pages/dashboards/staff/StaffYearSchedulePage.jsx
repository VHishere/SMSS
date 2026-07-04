import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffFormCard, { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";

const ENTRY_TYPES = [
  { value: "SUBJECT", label: "Môn học chính khóa" },
  { value: "EXTRACURRICULAR", label: "Hoạt động ngoại khóa" },
];

const EXTRACURRICULAR_SUGGESTIONS = [
  "CLB Bóng rổ",
  "CLB Cờ vua",
  "CLB Mỹ thuật",
  "CLB Tiếng Anh",
  "Ngày hội thể thao",
  "Hoạt động tình nguyện",
  "Tham quan ngoại khóa",
];

function StaffYearSchedulePage() {
  const [lookups, setLookups] = useState({ schoolYears: [], subjects: [], grades: [] });
  const [entries, setEntries] = useState([]);
  const [filters, setFilters] = useState({ schoolYearId: "", month: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    entryType: "SUBJECT",
    scheduleDate: "",
    subjectId: "",
    title: "",
    description: "",
    startTime: "07:30",
    endTime: "08:15",
    location: "",
    gradeId: "",
  });

  useEffect(() => {
    staffApi.getLookups().then((res) => {
      setLookups(res.data);
      const activeYear =
        res.data.schoolYears?.find((year) => year.isActive) ||
        res.data.schoolYears?.[0];
      if (activeYear) {
        const month = activeYear.startDate
          ? activeYear.startDate.slice(0, 7)
          : new Date().toISOString().slice(0, 7);
        setFilters({
          schoolYearId: String(activeYear.schoolYearId),
          month,
        });
        setForm((prev) => ({
          ...prev,
          scheduleDate: activeYear.startDate || "",
        }));
      }
    });
  }, []);

  const selectedYear = useMemo(
    () =>
      lookups.schoolYears.find(
        (year) => String(year.schoolYearId) === filters.schoolYearId,
      ),
    [lookups.schoolYears, filters.schoolYearId],
  );

  const loadSchedule = () => {
    if (!filters.schoolYearId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    staffApi
      .getYearSchedule({
        schoolYearId: filters.schoolYearId,
        month: filters.month || undefined,
      })
      .then((res) => {
        setEntries(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchedule();
  }, [filters.schoolYearId, filters.month]);

  const groupedEntries = useMemo(() => {
    const groups = new Map();

    entries.forEach((entry) => {
      const key = entry.scheduleDate;
      if (!groups.has(key)) {
        groups.set(key, {
          date: key,
          label: entry.scheduleDateLabel,
          items: [],
        });
      }
      groups.get(key).items.push(entry);
    });

    return Array.from(groups.values());
  }, [entries]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    staffApi
      .createYearScheduleEntry({
        schoolYearId: Number(filters.schoolYearId),
        entryType: form.entryType,
        scheduleDate: form.scheduleDate,
        subjectId: form.entryType === "SUBJECT" ? Number(form.subjectId) : null,
        title: form.entryType === "EXTRACURRICULAR" ? form.title : undefined,
        description: form.description,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        gradeId: form.gradeId ? Number(form.gradeId) : null,
      })
      .then(() => {
        setShowForm(false);
        setSuccess("Đã thêm vào lịch năm học");
        loadSchedule();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleGenerate = () => {
    if (!filters.schoolYearId) return;

    setGenerating(true);
    setError("");
    setSuccess("");

    staffApi
      .generateYearSchedule(filters.schoolYearId)
      .then((res) => {
        setSuccess(`Đã sinh ${res.data.createdCount} buổi học từ chương trình`);
        loadSchedule();
      })
      .catch((err) => setError(err.message))
      .finally(() => setGenerating(false));
  };

  const handleDelete = (entryId) => {
    if (!window.confirm("Xóa mục này khỏi lịch năm học?")) return;

    staffApi
      .deleteYearScheduleEntry(entryId)
      .then(() => loadSchedule())
      .catch((err) => setError(err.message));
  };

  return (
    <>
      <StaffPageHeader
        title="Lịch học năm học"
        description="Xem và quản lý lịch theo từng ngày trong năm học, gồm môn chính khóa và hoạt động ngoại khóa"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/staff/curriculum"
              className="rounded-xl border border-[#08509F] px-4 py-2.5 text-sm font-semibold text-[#08509F] no-underline"
            >
              Chương trình học
            </Link>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !filters.schoolYearId}
              className="rounded-xl border border-[#08509F] px-4 py-2.5 text-sm font-semibold text-[#08509F] disabled:opacity-50"
            >
              {generating ? "Đang sinh lịch..." : "Sinh lịch từ chương trình"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white"
            >
              + Thêm vào lịch
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={filters.schoolYearId}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, schoolYearId: e.target.value }))
          }
        >
          <option value="">Chọn năm học</option>
          {lookups.schoolYears.map((year) => (
            <option key={year.schoolYearId} value={year.schoolYearId}>
              {year.yearName}
            </option>
          ))}
        </select>
        <input
          type="month"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={filters.month}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, month: e.target.value }))
          }
        />
        {selectedYear && (
          <span className="self-center text-sm text-slate-500">
            {selectedYear.startDate || "—"} → {selectedYear.endDate || "—"}
          </span>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title="Thêm môn học / hoạt động ngoại khóa"
            onSubmit={handleSubmit}
            submitLabel="Thêm vào lịch"
            loading={saving}
          >
            <StaffField label="Loại">
              <select
                className={inputClass}
                value={form.entryType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, entryType: e.target.value }))
                }
              >
                {ENTRY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Ngày">
              <input
                type="date"
                className={inputClass}
                value={form.scheduleDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, scheduleDate: e.target.value }))
                }
                required
              />
            </StaffField>
            {form.entryType === "SUBJECT" ? (
              <StaffField label="Môn học">
                <select
                  className={inputClass}
                  value={form.subjectId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subjectId: e.target.value }))
                  }
                  required
                >
                  <option value="">Chọn môn</option>
                  {lookups.subjects.map((subject) => (
                    <option key={subject.subjectId} value={subject.subjectId}>
                      {subject.subjectName}
                    </option>
                  ))}
                </select>
              </StaffField>
            ) : (
              <StaffField label="Tên hoạt động">
                <input
                  className={inputClass}
                  list="extracurricular-options"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="VD: CLB Bóng rổ"
                  required
                />
                <datalist id="extracurricular-options">
                  {EXTRACURRICULAR_SUGGESTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </StaffField>
            )}
            <StaffField label="Bắt đầu">
              <input
                type="time"
                className={inputClass}
                value={form.startTime}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startTime: e.target.value }))
                }
              />
            </StaffField>
            <StaffField label="Kết thúc">
              <input
                type="time"
                className={inputClass}
                value={form.endTime}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endTime: e.target.value }))
                }
              />
            </StaffField>
            <StaffField label="Địa điểm">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="VD: Sân thể thao, Phòng A101"
              />
            </StaffField>
            <StaffField label="Khối (tuỳ chọn)">
              <select
                className={inputClass}
                value={form.gradeId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, gradeId: e.target.value }))
                }
              >
                <option value="">Tất cả khối</option>
                {lookups.grades.map((grade) => (
                  <option key={grade.gradeId} value={grade.gradeId}>
                    {grade.gradeName}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Ghi chú" className="md:col-span-2">
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </StaffField>
          </StaffFormCard>
        </div>
      )}

      <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="mb-1 text-lg font-bold text-[#0F2747]">
              Lịch tháng {filters.month || "—"}
            </h3>
            <p className="mb-0 text-sm text-slate-500">
              {loading ? "Đang tải..." : `${entries.length} mục trong tháng này`}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Đang tải lịch...</p>
        ) : groupedEntries.length ? (
          <div className="space-y-6">
            {groupedEntries.map((group) => (
              <div key={group.date}>
                <h4 className="mb-3 border-b border-[#FFE7D6] pb-2 text-sm font-bold uppercase tracking-wide text-[#08509F]">
                  {group.label}
                </h4>
                <div className="space-y-3">
                  {group.items.map((entry) => (
                    <div
                      key={entry.entryId}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#FFF7F2] p-4"
                    >
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <p className="mb-0 font-semibold text-[#0F2747]">
                            {entry.title}
                          </p>
                          <StatusBadge
                            value={
                              entry.entryType === "SUBJECT"
                                ? "Môn học"
                                : "Ngoại khóa"
                            }
                            tone={
                              entry.entryType === "SUBJECT" ? "info" : "warning"
                            }
                          />
                          {entry.gradeName && (
                            <StatusBadge value={entry.gradeName} tone="neutral" />
                          )}
                        </div>
                        <p className="mb-1 text-sm text-slate-600">
                          {entry.startTime && entry.endTime
                            ? `${entry.startTime} - ${entry.endTime}`
                            : "Chưa xếp giờ"}
                          {entry.location ? ` · ${entry.location}` : ""}
                        </p>
                        {entry.description && (
                          <p className="mb-0 text-sm text-slate-500">
                            {entry.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.entryId)}
                        className="text-xs font-semibold text-red-500"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Chưa có lịch trong tháng này. Thêm thủ công hoặc sinh lịch từ chương
            trình (cần gán thứ cho buổi học trong Chương trình học trước).
          </p>
        )}
      </div>
    </>
  );
}

export default StaffYearSchedulePage;
