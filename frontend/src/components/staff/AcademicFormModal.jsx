import { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";

import { staffApi } from "../../api/client";
import { StaffField, inputClass } from "./StaffFormCard";
import PrettySelect from "../molecules/PrettySelect";

const emptyForm = {
  studentId: "",
  subjectId: "",
  semesterId: "",
  scoreType: "MIDTERM",
  scoreValue: "",
  maxScore: 10,
  comment: "",
};

function AcademicFormModal({ show, onHide, editId, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [lookups, setLookups] = useState({
    students: [],
    subjects: [],
    semesters: [],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    staffApi.getLookups().then((res) => setLookups(res.data));
  }, [show]);

  useEffect(() => {
    if (!show) return;

    if (!editId) {
      setForm(emptyForm);
      setError("");
      return;
    }

    staffApi
      .getAcademicResult(editId)
      .then((res) => {
        const data = res.data;
        setForm({
          studentId: String(data.studentId),
          subjectId: String(data.subjectId),
          semesterId: String(data.semesterId),
          scoreType: data.scoreType,
          scoreValue: String(data.scoreValue),
          maxScore: data.maxScore || 10,
          comment: data.comment || "",
        });
      })
      .catch((err) => setError(err.message));
  }, [show, editId]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      studentId: Number(form.studentId),
      subjectId: Number(form.subjectId),
      semesterId: Number(form.semesterId),
      scoreType: form.scoreType,
      scoreValue: Number(form.scoreValue),
      maxScore: Number(form.maxScore),
      comment: form.comment,
    };

    try {
      if (editId) {
        await staffApi.updateAcademicResult(editId, payload);
      } else {
        await staffApi.createAcademicResult(payload);
      }
      onSaved();
      onHide();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="border-0">
        <Modal.Title className="text-[#0F2747]">
          {editId ? "Chỉnh sửa điểm học tập" : "Thêm điểm học tập"}
        </Modal.Title>
      </Modal.Header>

      <form onSubmit={handleSubmit}>
        <Modal.Body className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {error && (
            <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <StaffField label="Học sinh">
            <PrettySelect
              className={inputClass}
              value={form.studentId}
              onChange={handleChange("studentId")}
              required
            >
              <option value="">-- Chọn học sinh --</option>
              {lookups.students.map((item) => (
                <option key={item.studentId} value={item.studentId}>
                  {item.studentCode} · {item.fullName}
                </option>
              ))}
            </PrettySelect>
          </StaffField>

          <StaffField label="Môn học">
            <PrettySelect
              className={inputClass}
              value={form.subjectId}
              onChange={handleChange("subjectId")}
              required
            >
              <option value="">-- Chọn môn --</option>
              {lookups.subjects.map((item) => (
                <option key={item.subjectId} value={item.subjectId}>
                  {item.subjectName}
                </option>
              ))}
            </PrettySelect>
          </StaffField>

          <StaffField label="Học kỳ">
            <PrettySelect
              className={inputClass}
              value={form.semesterId}
              onChange={handleChange("semesterId")}
              required
            >
              <option value="">-- Chọn học kỳ --</option>
              {lookups.semesters.map((item) => (
                <option key={item.semesterId} value={item.semesterId}>
                  {item.semesterName} · {item.schoolYearName}
                </option>
              ))}
            </PrettySelect>
          </StaffField>

          <StaffField label="Loại điểm">
            <PrettySelect
              className={inputClass}
              value={form.scoreType}
              onChange={handleChange("scoreType")}
            >
              <option value="TX1">TX1 (thường xuyên · hệ số 1)</option>
              <option value="TX2">TX2 (thường xuyên · hệ số 1)</option>
              <option value="TX3">TX3 (thường xuyên · hệ số 1)</option>
              <option value="MIDTERM">1 tiết (định kỳ · hệ số 2)</option>
              <option value="FINAL">Cuối kỳ (hệ số 3)</option>
            </PrettySelect>
          </StaffField>

          <StaffField label="Điểm">
            <input
              type="number"
              step="0.1"
              min="0"
              className={inputClass}
              value={form.scoreValue}
              onChange={handleChange("scoreValue")}
              required
            />
          </StaffField>

          <StaffField label="Thang điểm">
            <input
              type="number"
              step="0.1"
              min="1"
              className={inputClass}
              value={form.maxScore}
              onChange={handleChange("maxScore")}
            />
          </StaffField>

          <StaffField label="Nhận xét" className="md:col-span-2">
            <textarea
              className={`${inputClass} min-h-24`}
              value={form.comment}
              onChange={handleChange("comment")}
            />
          </StaffField>
        </Modal.Body>

        <Modal.Footer className="border-0">
          <button
            type="button"
            onClick={onHide}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#F27123] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

export default AcademicFormModal;
