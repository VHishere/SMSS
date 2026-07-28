import { useMemo, useState } from "react";
import {
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiSearch,
  FiStar,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentGrades } from "../../hooks/useStudentGrades";
import PrettySelect from "../../components/molecules/PrettySelect";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (Number.isNaN(number)) return String(value);

  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function scorePillClass(value) {
  const score = Number(value);

  if (Number.isNaN(score)) {
    return "bg-slate-100 text-slate-500";
  }

  if (score >= 8) return "bg-blue-50 text-[#0F4C8A]";
  if (score >= 6.5) return "bg-emerald-50 text-emerald-700";
  if (score >= 5) return "bg-amber-50 text-amber-700";

  return "bg-red-50 text-red-600";
}

function scoreTypeGroup(scoreType) {
  const type = String(scoreType || "").toUpperCase();

  if (["TX1", "TX2", "TX3", "REGULAR", "FREQUENT"].some((key) => type.includes(key))) {
    return "regular";
  }

  if (
    type.includes("MIDTERM") ||
    type.includes("MID_TERM") ||
    type.includes("ONE_PERIOD") ||
    type.includes("MOT_TIET")
  ) {
    return "midterm";
  }

  if (
    type.includes("FINAL") ||
    type.includes("CUOI_KY") ||
    type.includes("END_TERM")
  ) {
    return "final";
  }

  return "regular";
}

function average(values) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  if (numbers.length === 0) return null;

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function calculateWeightedAverage(row) {
  const groups = [
    {
      value: average(row.regular),
      weight: 1,
    },
    {
      value: average(row.midterm),
      weight: 2,
    },
    {
      value: average(row.final),
      weight: 3,
    },
  ].filter((group) => group.value !== null);

  if (groups.length === 0) return null;

  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
  const total = groups.reduce(
    (sum, group) => sum + group.value * group.weight,
    0,
  );

  return total / totalWeight;
}

function buildSemesterOptions(data) {
  const map = new Map();

  (data?.schoolYears || []).forEach((item) => {
    const key = String(item.semesterId);

    if (!map.has(key)) {
      map.set(key, {
        key,
        semesterId: item.semesterId,
        semesterName: item.semesterName,
        schoolYearName: item.schoolYearName,
        isActive: Boolean(item.isActive),
        startDate: item.semesterStartDate,
      });
    }
  });

  (data?.grades || []).forEach((grade) => {
    const key = String(grade.semesterId);

    if (!map.has(key)) {
      map.set(key, {
        key,
        semesterId: grade.semesterId,
        semesterName: grade.semesterName,
        schoolYearName: grade.schoolYearName,
        isActive: Boolean(grade.schoolYearIsActive),
        startDate: grade.semesterStartDate,
      });
    }
  });

  return Array.from(map.values()).sort((first, second) => {
    if (first.isActive !== second.isActive) {
      return first.isActive ? -1 : 1;
    }

    return new Date(second.startDate || 0) - new Date(first.startDate || 0);
  });
}

function buildSubjectRows(data, semesterId) {
  const grades = (data?.grades || []).filter(
    (grade) => String(grade.semesterId) === String(semesterId),
  );

  const map = new Map();

  grades.forEach((grade) => {
    const key = String(grade.subjectId || normalizeText(grade.subjectName));

    if (!map.has(key)) {
      map.set(key, {
        subjectId: grade.subjectId,
        subjectCode: grade.subjectCode,
        subjectName: grade.subjectName,
        regular: [],
        midterm: [],
        final: [],
        comments: [],
      });
    }

    const row = map.get(key);
    const group = scoreTypeGroup(grade.scoreType);

    row[group].push(grade.scoreValue);

    if (grade.comment) {
      row.comments.push(grade.comment);
    }
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      average: calculateWeightedAverage(row),
    }))
    .sort((first, second) =>
      first.subjectName.localeCompare(second.subjectName, "vi"),
    );
}

function getInitials(subjectName) {
  return String(subjectName || "MH")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAcademicRank(score) {
  const value = Number(score);

  if (Number.isNaN(value)) return "Chưa xếp loại";
  if (value >= 8) return "Giỏi";
  if (value >= 6.5) return "Khá";
  if (value >= 5) return "Trung bình";

  return "Cần cải thiện";
}

function ScoreList({ values }) {
  if (!values.length) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <span className="text-sm font-medium text-slate-600">
      {values.map(formatScore).join(", ")}
    </span>
  );
}

function StudentGrades() {
  const { data, loading, error } = useStudentGrades();
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [search, setSearch] = useState("");

  const semesterOptions = useMemo(
    () => buildSemesterOptions(data),
    [data],
  );

  const activeSemesterId =
    selectedSemesterId || semesterOptions[0]?.key || "";

  const selectedSemester = useMemo(
    () =>
      semesterOptions.find(
        (semester) => semester.key === activeSemesterId,
      ),
    [semesterOptions, activeSemesterId],
  );

  const rows = useMemo(
    () => buildSubjectRows(data, activeSemesterId),
    [data, activeSemesterId],
  );

  const filteredRows = useMemo(() => {
    const keyword = normalizeText(search);

    if (!keyword) return rows;

    return rows.filter(
      (row) =>
        normalizeText(row.subjectName).includes(keyword) ||
        normalizeText(row.subjectCode).includes(keyword),
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    const averages = rows
      .map((row) => row.average)
      .filter((value) => value !== null);

    return {
      average: average(averages),
      highest: averages.length ? Math.max(...averages) : null,
      lowest: averages.length ? Math.min(...averages) : null,
    };
  }, [rows]);

  const strongestSubject = useMemo(
    () =>
      rows
        .filter((row) => row.average !== null)
        .sort((first, second) => second.average - first.average)[0],
    [rows],
  );

  const weakestSubject = useMemo(
    () =>
      rows
        .filter((row) => row.average !== null)
        .sort((first, second) => first.average - second.average)[0],
    [rows],
  );

  return (
    <StudentDashboardShell context={data?.context}>
      <section className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F27123]">
            Kết quả học tập
          </p>
          <h2 className="mb-1 text-2xl font-black text-[#0F2747]">
            Bảng điểm cá nhân
          </h2>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block sm:w-60">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm môn học..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <PrettySelect
            value={activeSemesterId}
            onChange={(event) => setSelectedSemesterId(event.target.value)}
            className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0F2747] outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          >
            {semesterOptions.map((semester) => (
              <option key={semester.key} value={semester.key}>
                {semester.semesterName} · {semester.schoolYearName}
              </option>
            ))}
          </PrettySelect>
        </div>
      </section>

      {loading && <LoadingState label="Đang tải bảng điểm..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được bảng điểm: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-4 grid gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
            <article className="relative overflow-hidden rounded-2xl bg-[#0F4C8A] p-5 text-white shadow-sm">
              <div className="relative z-10">
                <p className="mb-1 text-xs font-bold text-white/75">
                  Điểm trung bình học kỳ
                </p>
                <strong className="block text-4xl font-black">
                  {summary.average === null
                    ? "—"
                    : summary.average.toFixed(1)}
                </strong>
                <span className="mt-2 inline-flex rounded-full bg-[#F27123] px-3 py-1 text-[10px] font-extrabold uppercase">
                  Xếp loại: {getAcademicRank(summary.average)}
                </span>
                <p className="mb-0 mt-2 text-[11px] text-white/75">
                  {selectedSemester
                    ? `${selectedSemester.semesterName} · ${selectedSemester.schoolYearName}`
                    : "Chưa có dữ liệu học kỳ"}
                </p>
              </div>

              <FiStar className="absolute -bottom-5 right-3 text-white/10" size={110} />
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <FiTrendingUp />
              </span>
              <p className="mb-1 text-xs font-medium text-slate-500">
                Điểm cao nhất
              </p>
              <strong className="text-2xl font-black text-[#0F2747]">
                {summary.highest === null ? "—" : summary.highest.toFixed(1)}
              </strong>
              <p className="mb-0 mt-1 line-clamp-1 text-[11px] text-slate-400">
                {strongestSubject?.subjectName || "Chưa có dữ liệu"}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-[#F27123]">
                <FiTrendingDown />
              </span>
              <p className="mb-1 text-xs font-medium text-slate-500">
                Cần tập trung
              </p>
              <strong className="text-2xl font-black text-[#0F2747]">
                {summary.lowest === null ? "—" : summary.lowest.toFixed(1)}
              </strong>
              <p className="mb-0 mt-1 line-clamp-1 text-[11px] text-slate-400">
                {weakestSubject?.subjectName || "Chưa có dữ liệu"}
              </p>
            </article>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                    <FiBookOpen className="text-[#F27123]" />
                    Chi tiết điểm số
                  </h2>
                  <p className="mb-0 text-xs text-slate-500">
                    Điểm thường xuyên, giữa kỳ, cuối kỳ và trung bình môn.
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0F4C8A]">
                  {filteredRows.length} môn
                </span>
              </div>

              {filteredRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Không tìm thấy dữ liệu điểm"
                    description="Thử đổi học kỳ hoặc từ khóa môn học."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full border-collapse text-left">
                    <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Môn học</th>
                        <th className="px-4 py-3 text-center">Thường xuyên</th>
                        <th className="px-4 py-3 text-center">Giữa kỳ</th>
                        <th className="px-4 py-3 text-center">Cuối kỳ</th>
                        <th className="px-5 py-3 text-center">Trung bình</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((row) => (
                        <tr
                          key={row.subjectId || row.subjectName}
                          className="transition hover:bg-orange-50/30"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-[10px] font-black text-[#0F4C8A]">
                                {getInitials(row.subjectName)}
                              </span>
                              <div className="min-w-0">
                                <p className="mb-0 truncate text-sm font-extrabold text-[#0F2747]">
                                  {row.subjectName}
                                </p>
                                <p className="mb-0 text-[10px] text-slate-400">
                                  {row.subjectCode || "Chưa có mã môn"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <ScoreList values={row.regular} />
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <ScoreList values={row.midterm} />
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <ScoreList values={row.final} />
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex min-w-12 items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-extrabold ${scorePillClass(row.average)}`}
                            >
                              {formatScore(row.average)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="space-y-4 xl:sticky xl:top-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="mb-0 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                    <FiBarChart2 className="text-[#F27123]" />
                    Phân tích năng lực
                  </h2>
                  <FiAward className="text-slate-300" />
                </div>

                {rows.length === 0 ? (
                  <p className="mb-0 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                    Chưa có dữ liệu để phân tích.
                  </p>
                ) : (
                  <div className="flex h-52 items-end gap-2 border-b border-slate-200 pb-2">
                    {rows.slice(0, 7).map((row) => {
                      const height = Math.max(
                        8,
                        Math.min(100, Number(row.average || 0) * 10),
                      );

                      return (
                        <div
                          key={row.subjectId || row.subjectName}
                          className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        >
                          <span className="text-[9px] font-bold text-slate-500">
                            {formatScore(row.average)}
                          </span>
                          <div className="flex h-36 w-full items-end rounded-t-lg bg-slate-100 px-1">
                            <div
                              className="w-full rounded-t-md bg-[#C9D7E8] transition-all"
                              style={{ height: `${height}%` }}
                              title={`${row.subjectName}: ${formatScore(row.average)}`}
                            />
                          </div>
                          <span className="w-full truncate text-center text-[8px] font-bold text-slate-500">
                            {row.subjectCode || getInitials(row.subjectName)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-extrabold text-[#0F2747]">
                  Tình trạng học tập
                </h2>

                <div className="space-y-3">
                  <div className="rounded-xl bg-blue-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                      Môn nổi bật
                    </p>
                    <p className="mb-0 text-xs font-extrabold text-blue-800">
                      {strongestSubject
                        ? `${strongestSubject.subjectName} (${formatScore(strongestSubject.average)})`
                        : "Chưa có dữ liệu"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-orange-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#F27123]">
                      Môn cần phát huy
                    </p>
                    <p className="mb-0 text-xs font-extrabold text-[#A94700]">
                      {weakestSubject
                        ? `${weakestSubject.subjectName} (${formatScore(weakestSubject.average)})`
                        : "Chưa có dữ liệu"}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentGrades;