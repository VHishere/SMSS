import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { goalApi } from "../../api/client";
import GoalCommentModal from "../../components/organisms/GoalCommentModal";
import PrettySelect from "../../components/molecules/PrettySelect";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useStudentMeta } from "../../hooks/useStudentMeta";
import { formatDateVN } from "../../utils/datetime";

const GOAL_TYPE_LABEL = {
  ACADEMIC: "Học tập",
  BEHAVIOUR: "Hạnh kiểm",
  ATTENDANCE: "Chuyên cần",
  PERSONAL: "Phát triển cá nhân",
};

function Ms({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

const selectClass =
  "rounded-xl border border-[#DFC0B2] bg-white px-3 py-2 text-sm text-[#1A1C1C] shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";

function GoalManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: meta, loading: metaLoading } = useStudentMeta();

  const [classId, setClassId] = useState("");
  const [goalType, setGoalType] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [goalTypes, setGoalTypes] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGoal, setSelectedGoal] = useState(null);

  const classes = (meta?.classes ?? []).filter(
    (item) => item.roleInClass === "HOMEROOM_TEACHER",
  );
  const effectiveClassId =
    classId || (classes[0]?.classId ? String(classes[0].classId) : "");

  useEffect(() => {
    let mounted = true;

    goalApi
      .getTypes()
      .then((response) => {
        if (mounted) setGoalTypes(response.data ?? []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!effectiveClassId) return undefined;

    let mounted = true;
    setLoading(true);
    setError("");

    goalApi
      .listByClass({
        classId: effectiveClassId,
        goalType,
        page,
        limit: 20,
      })
      .then((response) => {
        if (mounted) setData(response.data);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [effectiveClassId, goalType, page, refreshKey]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((role) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(
        role.roleName,
      ),
    );

    return {
      name: user?.fullName ?? user?.username ?? "Giáo viên",
      role: roleEntry?.description ?? "Giáo viên",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  const pagination = data?.pagination;

  function handleCommentSaved() {
    setSelectedGoal(null);
    setRefreshKey((current) => current + 1);
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp"
      sidebarFooterValue={
        classes.find((item) => String(item.classId) === effectiveClassId)?.className ?? "—"
      }
    >
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
      ) : classes.length === 0 ? (
        <div
          className="rounded-3xl px-4 py-3 text-sm"
          style={{
            border: "1px solid #FFE7D6",
            backgroundColor: "#FFF7F2",
            color: "#0F2747",
          }}
        >
          Bạn chưa được phân công làm giáo viên chủ nhiệm lớp nào.
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1
                className="text-2xl font-extrabold tracking-tight sm:text-3xl"
                style={{ color: "#1A1C1C" }}
              >
                Theo dõi mục tiêu học sinh
              </h1>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <PrettySelect
                value={effectiveClassId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setPage(1);
                }}
                className={selectClass}
              >
                {classes.map((item) => (
                  <option key={item.classId} value={item.classId}>
                    {item.className}
                  </option>
                ))}
              </PrettySelect>

              <PrettySelect
                value={goalType}
                onChange={(event) => {
                  setGoalType(event.target.value);
                  setPage(1);
                }}
                className={selectClass}
              >
                <option value="">Mọi loại mục tiêu</option>
                {goalTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </PrettySelect>
            </div>
          </div>

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((number) => (
                <div
                  key={number}
                  className="h-14 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          )}

          {!loading && !error && data &&
            (data.items.length === 0 ? (
              <div
                className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm"
                style={{ border: "1px solid #FFE7D6" }}
              >
                Chưa có học sinh nào tạo mục tiêu.
              </div>
            ) : (
              <>
                <div
                  className="overflow-hidden rounded-3xl bg-white shadow-sm"
                  style={{ border: "1px solid #FFE7D6" }}
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#00458E] text-white">
                        <tr className="text-left">
                          {[
                            "HỌC SINH",
                            "MỤC TIÊU",
                            "LOẠI",
                            "HẠN HOÀN THÀNH",
                            "NHẬN XÉT GVCN",
                            "",
                          ].map((column, index) => (
                            <th
                              key={`${column}-${index}`}
                              className="px-4 py-3 text-xs font-medium uppercase tracking-wider"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody
                        className="divide-y"
                        style={{ borderColor: "#DFC0B2" }}
                      >
                        {data.items.map((goal) => (
                          <tr
                            key={goal.goalId}
                            onClick={() =>
                              navigate(`/teacher/students/${goal.studentId}?tab=roadmap`)
                            }
                            className="group cursor-pointer transition-colors hover:bg-[#F3F3F3]"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00458E] text-xs font-bold text-white">
                                  {goal.studentAvatar ? (
                                    <img
                                      src={goal.studentAvatar}
                                      alt={goal.studentName}
                                      className="h-9 w-9 rounded-full object-cover"
                                    />
                                  ) : (
                                    goal.studentName?.[0]?.toUpperCase() ?? "?"
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-[#1A1C1C]">
                                    {goal.studentName}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {goal.studentCode}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="max-w-[320px]">
                                <div className="flex items-center gap-1.5">
                                  <Ms
                                    name="flag"
                                    className="!text-[15px] shrink-0"
                                    style={{ color: "#225DAD" }}
                                  />
                                  <span className="text-sm font-medium text-[#1A1C1C]">
                                    {goal.title}
                                  </span>
                                </div>
                                {goal.description && (
                                  <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                                    {goal.description}
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: "rgba(34,93,173,0.1)",
                                  color: "#225DAD",
                                }}
                              >
                                {GOAL_TYPE_LABEL[goal.goalType] ?? goal.goalType}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                              {goal.targetDate ? formatDateVN(goal.targetDate) : "—"}
                            </td>

                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedGoal(goal);
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  goal.teacherRemark
                                    ? "bg-blue-50 text-[#225DAD] hover:bg-blue-100"
                                    : "bg-orange-50 text-[#F27123] hover:bg-orange-100"
                                }`}
                              >
                                <Ms
                                  name={goal.teacherRemark ? "edit_note" : "rate_review"}
                                  className="!text-[15px]"
                                />
                                {goal.teacherRemark
                                  ? "Cập nhật nhận xét"
                                  : "Thêm nhận xét"}
                              </button>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <Ms
                                name="chevron_right"
                                className="!text-[18px] inline text-slate-300 transition group-hover:text-[#225DAD]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                    <span>
                      {(page - 1) * pagination.limit + 1}–
                      {Math.min(page * pagination.limit, pagination.total)} / {pagination.total}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((current) =>
                            Math.min(pagination.totalPages, current + 1),
                          )
                        }
                        disabled={page >= pagination.totalPages}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </>
            ))}
        </>
      )}

      {selectedGoal && (
        <GoalCommentModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onSaved={handleCommentSaved}
        />
      )}
    </DashboardShell>
  );
}

export default GoalManagementPage;
