import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDetailCard, { StaffDetailItem } from "../../../components/staff/StaffDetailCard";
import StaffFormCard, {
  StaffField,
  cancelLinkClass,
  inputClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";

const WEEK_DAYS = [
  { value: "", label: "Chưa xếp lịch" },
  { value: "2", label: "Thứ 2" },
  { value: "3", label: "Thứ 3" },
  { value: "4", label: "Thứ 4" },
  { value: "5", label: "Thứ 5" },
  { value: "6", label: "Thứ 6" },
  { value: "7", label: "Thứ 7" },
];

const SESSION_PARTS = [
  { value: "MORNING", label: "Buổi sáng" },
  { value: "AFTERNOON", label: "Buổi chiều" },
];

function StaffCurriculumDetailPage() {
  const { id } = useParams();
  const [curriculum, setCurriculum] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({});
  const [curriculumForm, setCurriculumForm] = useState({
    periodsPerWeek: 2,
    note: "",
    gradeId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCurriculum = () => {
    setLoading(true);
    staffApi
      .getCurriculumItem(id)
      .then((res) => {
        setCurriculum(res.data);
        setCurriculumForm({
          periodsPerWeek: res.data.periodsPerWeek,
          note: res.data.note || "",
          gradeId: res.data.gradeId ? String(res.data.gradeId) : "",
        });
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCurriculum();
  }, [id]);

  const handleUpdateCurriculum = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await staffApi.updateCurriculumItem(id, {
        periodsPerWeek: Number(curriculumForm.periodsPerWeek),
        note: curriculumForm.note,
        gradeId: curriculumForm.gradeId ? Number(curriculumForm.gradeId) : null,
      });
      setCurriculum(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSession = (session) => {
    setEditingSession(session.sessionId);
    setSessionForm({
      sessionName: session.sessionName,
      dayOfWeek: session.dayOfWeek ? String(session.dayOfWeek) : "",
      periodNo: session.periodNo || "",
      startTime: session.startTime || "",
      endTime: session.endTime || "",
      sessionPart: session.sessionPart || "MORNING",
    });
  };

  const handleSaveSession = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await staffApi.updateStudySession(editingSession, {
        ...sessionForm,
        dayOfWeek: sessionForm.dayOfWeek ? Number(sessionForm.dayOfWeek) : null,
        periodNo: sessionForm.periodNo ? Number(sessionForm.periodNo) : null,
      });
      setCurriculum((prev) => ({ ...prev, sessions: res.data }));
      setEditingSession(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;
  }

  if (error && !curriculum) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <>
      <StaffPageHeader
        title={curriculum.subjectName}
        description={`${curriculum.schoolYearName} · ${curriculum.semesterName}`}
        action={
          <Link
            to="/staff/curriculum"
            className={cancelLinkClass}
          >
            Quay lại
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StaffDetailCard title="Thông tin chương trình">
          <div className="grid gap-4 sm:grid-cols-2">
            <StaffDetailItem label="Môn học" value={curriculum.subjectName} />
            <StaffDetailItem label="Mã môn" value={curriculum.subjectCode} />
            <StaffDetailItem label="Năm học" value={curriculum.schoolYearName} />
            <StaffDetailItem label="Học kỳ" value={curriculum.semesterName} />
            <StaffDetailItem
              label="Khối"
              value={curriculum.gradeName || "Tất cả khối"}
            />
            <StaffDetailItem
              label="Số buổi/tuần"
              value={curriculum.periodsPerWeek}
            />
          </div>
        </StaffDetailCard>

        <StaffFormCard
          title="Cập nhật chương trình"
          onSubmit={handleUpdateCurriculum}
          submitLabel="Lưu chương trình"
          loading={saving}
          footer="Thay đổi này áp dụng cho chương trình học hiện tại."
        >
          <StaffField label="Số buổi/tuần">
            <input
              type="number"
              min="1"
              max="8"
              className={inputClass}
              value={curriculumForm.periodsPerWeek}
              onChange={(e) =>
                setCurriculumForm((prev) => ({
                  ...prev,
                  periodsPerWeek: e.target.value,
                }))
              }
              required
            />
          </StaffField>
          <StaffField label="Ghi chú" className="md:col-span-2">
            <input
              className={inputClass}
              value={curriculumForm.note}
              onChange={(e) =>
                setCurriculumForm((prev) => ({ ...prev, note: e.target.value }))
              }
            />
          </StaffField>
        </StaffFormCard>
      </div>

      <StaffDetailCard title="Buổi học trong chương trình">
        {curriculum.sessions?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#FFF7F2] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Buổi</th>
                  <th className="px-4 py-2 text-left">Thứ</th>
                  <th className="px-4 py-2 text-left">Tiết</th>
                  <th className="px-4 py-2 text-left">Thời gian</th>
                  <th className="px-4 py-2 text-left">Buổi</th>
                  <th className="px-4 py-2 text-left" />
                </tr>
              </thead>
              <tbody>
                {curriculum.sessions.map((session) => (
                  <tr key={session.sessionId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{session.sessionName}</td>
                    <td className="px-4 py-3">
                      {WEEK_DAYS.find((day) => Number(day.value) === session.dayOfWeek)
                        ?.label || "—"}
                    </td>
                    <td className="px-4 py-3">{session.periodNo || "—"}</td>
                    <td className="px-4 py-3">
                      {session.startTime && session.endTime
                        ? `${session.startTime} - ${session.endTime}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {SESSION_PARTS.find((part) => part.value === session.sessionPart)
                        ?.label || session.sessionPart}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleEditSession(session)}
                        className="text-xs font-semibold text-[#08509F]"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chưa có buổi học</p>
        )}
      </StaffDetailCard>

      {editingSession && (
        <div className="mt-6">
          <StaffFormCard
            title="Chỉnh sửa buổi học"
            onSubmit={handleSaveSession}
            submitLabel="Lưu buổi học"
            loading={saving}
            footer="Cập nhật buổi học để đồng bộ với lịch học thực tế."
          >
            <StaffField label="Tên buổi học" className="md:col-span-2">
              <input
                className={inputClass}
                value={sessionForm.sessionName}
                onChange={(e) =>
                  setSessionForm((prev) => ({
                    ...prev,
                    sessionName: e.target.value,
                  }))
                }
                required
              />
            </StaffField>
            <StaffField label="Thứ">
              <PrettySelect
                className={inputClass}
                value={sessionForm.dayOfWeek}
                onChange={(e) =>
                  setSessionForm((prev) => ({
                    ...prev,
                    dayOfWeek: e.target.value,
                  }))
                }
              >
                {WEEK_DAYS.map((day) => (
                  <option key={day.value || "none"} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </PrettySelect>
            </StaffField>
            <StaffField label="Tiết">
              <input
                type="number"
                min="1"
                max="8"
                className={inputClass}
                value={sessionForm.periodNo}
                onChange={(e) =>
                  setSessionForm((prev) => ({
                    ...prev,
                    periodNo: e.target.value,
                  }))
                }
              />
            </StaffField>
            <StaffField label="Bắt đầu">
              <input
                type="time"
                className={inputClass}
                value={sessionForm.startTime}
                onChange={(e) =>
                  setSessionForm((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
              />
            </StaffField>
            <StaffField label="Kết thúc">
              <input
                type="time"
                className={inputClass}
                value={sessionForm.endTime}
                onChange={(e) =>
                  setSessionForm((prev) => ({
                    ...prev,
                    endTime: e.target.value,
                  }))
                }
              />
            </StaffField>
            <StaffField label="Buổi trong ngày">
              <PrettySelect
                className={inputClass}
                value={sessionForm.sessionPart}
                onChange={(e) =>
                  setSessionForm((prev) => ({
                    ...prev,
                    sessionPart: e.target.value,
                  }))
                }
              >
                {SESSION_PARTS.map((part) => (
                  <option key={part.value} value={part.value}>
                    {part.label}
                  </option>
                ))}
              </PrettySelect>
            </StaffField>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className={cancelLinkClass}
              >
                Hủy
              </button>
            </div>
          </StaffFormCard>
        </div>
      )}
    </>
  );
}

export default StaffCurriculumDetailPage;
