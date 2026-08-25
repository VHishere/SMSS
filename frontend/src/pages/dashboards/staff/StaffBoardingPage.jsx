import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";
import StatusBadge from "../../../components/staff/StatusBadge";

const inputClass =
  "h-11 w-full rounded-full border border-[#DFC0B2] bg-white px-4 text-sm outline-none transition focus:border-[#F27123] focus:ring-2 focus:ring-[#F27123]/20";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F1DED4] px-6 py-5">
          <h2 className="mb-0 text-xl font-bold text-[#1A1C1C]">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#DFC0B2] text-slate-600 hover:bg-slate-50" title="Đóng">
            <FiX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StaffBoardingPage() {
  const [data, setData] = useState({ areas: [], supervisors: [], rooms: [], assignments: [], students: [] });
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [areaDialog, setAreaDialog] = useState(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [areaForm, setAreaForm] = useState({ areaName: "", areaType: "DORM_FLOOR", supervisorId: "", description: "", status: "ACTIVE" });
  const [assignmentForm, setAssignmentForm] = useState({ studentId: "", roomId: "", startDate: todayIso() });

  const load = useCallback(async (preferredAreaId = selectedAreaId) => {
    setLoading(true);
    try {
      const response = await staffApi.getBoardingManagement({ areaId: preferredAreaId, search });
      const next = response.data;
      setData(next);
      const validSelected = next.areas.some((area) => String(area.areaId) === String(preferredAreaId));
      if (!validSelected && next.areas.length) setSelectedAreaId(String(next.areas[0].areaId));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, selectedAreaId]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const selectedArea = useMemo(
    () => data.areas.find((area) => String(area.areaId) === String(selectedAreaId)),
    [data.areas, selectedAreaId],
  );
  const selectedStudent = data.students.find((student) => String(student.studentId) === String(assignmentForm.studentId));
  const areaRooms = data.rooms.filter((room) => String(room.areaId) === String(selectedAreaId));

  function openCreateArea() {
    setAreaForm({ areaName: "", areaType: "DORM_FLOOR", supervisorId: "", description: "", status: "ACTIVE" });
    setAreaDialog("create");
  }

  function openEditArea(area) {
    setAreaForm({
      areaName: area.areaName || "",
      areaType: area.areaType || "",
      supervisorId: String(area.supervisorId || ""),
      description: area.description || "",
      status: area.status || "ACTIVE",
    });
    setAreaDialog("edit");
  }

  async function submitArea(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (areaDialog === "create") await staffApi.createBoardingArea(areaForm);
      else await staffApi.updateBoardingArea(selectedArea.areaId, areaForm);
      setAreaDialog(null);
      setNotice(areaDialog === "create" ? "Đã tạo khu nội trú" : "Đã cập nhật khu nội trú");
      await load(selectedAreaId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitAssignment(event) {
    event.preventDefault();
    const transfer = Boolean(selectedStudent?.areaId);
    if (transfer && !window.confirm(`${selectedStudent.fullName} đang thuộc ${selectedStudent.areaName}. Chuyển học sinh sang ${selectedArea.areaName}?`)) return;
    setSaving(true);
    try {
      await staffApi.assignStudentToArea({ ...assignmentForm, areaId: selectedAreaId, transfer });
      setAssignDialog(false);
      setAssignmentForm({ studentId: "", roomId: "", startDate: todayIso() });
      setNotice(transfer ? "Đã chuyển khu cho học sinh" : "Đã xếp học sinh vào khu");
      await load(selectedAreaId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(row) {
    if (!window.confirm(`Gỡ ${row.fullName} khỏi ${row.areaName}?`)) return;
    try {
      await staffApi.removeStudentFromArea(row.studentAreaId);
      setNotice("Đã gỡ học sinh khỏi khu nội trú");
      await load(selectedAreaId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <StaffPageHeader
        title="Quản lý nội trú"
        action={
          <button type="button" onClick={openCreateArea} className="inline-flex items-center gap-2 rounded-full bg-[#F27123] px-5 py-3 text-sm font-semibold text-white hover:bg-[#E55C0A]">
            <FiPlus /> Tạo khu
          </button>
        }
      />

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <StaffDataTable
          title={`Khu nội trú - ${data.areas.length} khu`}
          showSearch={false}
          isLoading={loading}
          rows={data.areas.map((area) => ({ ...area, id: area.areaId }))}
          emptyMessage="Chưa có khu nội trú"
          columns={[
            { key: "areaName", label: "Khu", render: (row) => <button type="button" onClick={() => setSelectedAreaId(String(row.areaId))} className={`font-semibold ${String(row.areaId) === String(selectedAreaId) ? "text-[#F27123]" : "text-[#08509F]"}`}>{row.areaName}</button> },
            { key: "supervisorName", label: "Quản nhiệm" },
            { key: "studentCount", label: "Học sinh" },
            { key: "status", label: "Trạng thái", render: (row) => <StatusBadge value={row.status === "ACTIVE" ? "Hoạt động" : "Ngừng"} tone={row.status === "ACTIVE" ? "success" : "neutral"} /> },
            { key: "actions", label: "Sửa", render: (row) => <button type="button" onClick={() => { setSelectedAreaId(String(row.areaId)); openEditArea(row); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFC0B2] text-[#08509F] hover:bg-blue-50" title="Sửa khu"><FiEdit2 /></button> },
          ]}
        />

        <StaffDataTable
          title={selectedArea ? `${selectedArea.areaName} - ${data.assignments.length} học sinh` : "Học sinh nội trú"}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm học sinh để xếp khu..."
          toolbar={
            <button type="button" disabled={!selectedArea || selectedArea.status !== "ACTIVE"} onClick={() => setAssignDialog(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#F27123] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <FiPlus /> Xếp học sinh
            </button>
          }
          isLoading={loading}
          rows={data.assignments.map((assignment) => ({ ...assignment, id: assignment.studentAreaId }))}
          emptyMessage={selectedArea ? "Chưa có học sinh trong khu" : "Chọn một khu để xem học sinh"}
          columns={[
            { key: "studentCode", label: "Mã HS" },
            { key: "fullName", label: "Họ tên", render: (row) => <span className="font-semibold">{row.fullName}</span> },
            { key: "roomName", label: "Phòng" },
            { key: "startDate", label: "Ngày vào" },
            { key: "actions", label: "Thao tác", render: (row) => <button type="button" onClick={() => removeAssignment(row)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50" title="Gỡ khỏi khu"><FiTrash2 /></button> },
          ]}
        />
      </div>

      {areaDialog && (
        <Dialog title={areaDialog === "create" ? "Tạo khu nội trú" : "Cập nhật khu nội trú"} onClose={() => setAreaDialog(null)}>
          <form onSubmit={submitArea}>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <label className="text-sm font-semibold">Tên khu<input required maxLength={100} value={areaForm.areaName} onChange={(event) => setAreaForm((prev) => ({ ...prev, areaName: event.target.value }))} className={`${inputClass} mt-2`} /></label>
              <label className="text-sm font-semibold">Loại khu<input maxLength={50} value={areaForm.areaType} onChange={(event) => setAreaForm((prev) => ({ ...prev, areaType: event.target.value }))} className={`${inputClass} mt-2`} placeholder="DORM_FLOOR" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Quản nhiệm<PrettySelect className="mt-2 w-full" required value={areaForm.supervisorId} onChange={(event) => setAreaForm((prev) => ({ ...prev, supervisorId: event.target.value }))}><option value="">Chọn quản nhiệm</option>{data.supervisors.map((supervisor) => <option key={supervisor.supervisorId} value={supervisor.supervisorId}>{supervisor.fullName} ({supervisor.activeAreaCount} khu)</option>)}</PrettySelect></label>
              {areaDialog === "edit" && <label className="text-sm font-semibold sm:col-span-2">Trạng thái<PrettySelect className="mt-2 w-full" value={areaForm.status} onChange={(event) => setAreaForm((prev) => ({ ...prev, status: event.target.value }))}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></PrettySelect></label>}
              <label className="text-sm font-semibold sm:col-span-2">Ghi chú<textarea maxLength={1000} value={areaForm.description} onChange={(event) => setAreaForm((prev) => ({ ...prev, description: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border border-[#DFC0B2] p-4 text-sm outline-none focus:border-[#F27123]" /></label>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#F1DED4] px-6 py-4"><button type="button" onClick={() => setAreaDialog(null)} className="rounded-full border border-[#DFC0B2] px-5 py-2.5 font-semibold">Hủy</button><button disabled={saving} className="rounded-full bg-[#F27123] px-5 py-2.5 font-semibold text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu"}</button></div>
          </form>
        </Dialog>
      )}

      {assignDialog && selectedArea && (
        <Dialog title={`Xếp học sinh vào ${selectedArea.areaName}`} onClose={() => setAssignDialog(false)}>
          <form onSubmit={submitAssignment}>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">Học sinh<PrettySelect className="mt-2 w-full" required value={assignmentForm.studentId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, studentId: event.target.value, roomId: "" }))}><option value="">Chọn học sinh</option>{data.students.filter((student) => String(student.areaId || "") !== String(selectedAreaId)).map((student) => <option key={student.studentId} value={student.studentId}>{student.studentCode} - {student.fullName} - {student.className}{student.areaName ? ` (đang ở ${student.areaName})` : ""}</option>)}</PrettySelect></label>
              <label className="text-sm font-semibold">Phòng (tùy chọn)<PrettySelect className="mt-2 w-full" value={assignmentForm.roomId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, roomId: event.target.value }))}><option value="">Chưa xếp phòng</option>{areaRooms.map((room) => <option key={room.roomId} value={room.roomId}>{room.roomName} - sức chứa {room.capacity}</option>)}</PrettySelect></label>
              <label className="text-sm font-semibold">Ngày bắt đầu<input type="date" required value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, startDate: event.target.value }))} className={`${inputClass} mt-2`} /></label>
              {selectedStudent?.areaName && <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Học sinh đang thuộc {selectedStudent.areaName}. Khi xác nhận, phân công cũ sẽ kết thúc.</div>}
            </div>
            <div className="flex justify-end gap-3 border-t border-[#F1DED4] px-6 py-4"><button type="button" onClick={() => setAssignDialog(false)} className="rounded-full border border-[#DFC0B2] px-5 py-2.5 font-semibold">Hủy</button><button disabled={saving} className="rounded-full bg-[#F27123] px-5 py-2.5 font-semibold text-white disabled:opacity-60">{saving ? "Đang lưu..." : selectedStudent?.areaName ? "Chuyển khu" : "Xếp vào khu"}</button></div>
          </form>
        </Dialog>
      )}
    </>
  );
}

export default StaffBoardingPage;
