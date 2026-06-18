import { useEffect, useMemo, useState } from "react";

import { staffApi } from "../../../api/client";
import AcademicFormModal from "../../../components/staff/AcademicFormModal";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import { formatScoreType } from "../../../utils/formatters";

function StaffAcademicPage() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);

  const loadResults = () => {
    setLoading(true);
    staffApi
      .getAcademicResults(search)
      .then((response) => {
        setResults(response.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(loadResults, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const rows = useMemo(
    () =>
      results.map((result) => ({
        ...result,
        id: result.resultId,
      })),
    [results],
  );

  const openCreate = () => {
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (resultId) => {
    setEditId(resultId);
    setShowModal(true);
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm("Xóa bản ghi điểm này?")) return;

    try {
      await staffApi.deleteAcademicResult(resultId);
      loadResults();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <StaffPageHeader
        title="Quản lý thông tin học tập"
        description="Theo dõi điểm số, môn học và học kỳ của học sinh"
        action={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Thêm điểm
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffDataTable
        title="Kết quả học tập"
        description={`${rows.length} bản ghi điểm`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo học sinh, môn học, học kỳ..."
        isLoading={loading}
        columns={[
          {
            key: "studentName",
            label: "Học sinh",
            render: (row) => (
              <div>
                <p className="mb-0 font-semibold">{row.studentName}</p>
                <p className="mb-0 text-xs text-slate-500">
                  {row.studentCode}
                </p>
              </div>
            ),
          },
          { key: "subjectName", label: "Môn học" },
          { key: "semesterName", label: "Học kỳ" },
          { key: "schoolYearName", label: "Năm học" },
          {
            key: "scoreType",
            label: "Loại điểm",
            render: (row) => (
              <StatusBadge
                value={formatScoreType(row.scoreType)}
                tone="info"
              />
            ),
          },
          {
            key: "scoreValue",
            label: "Điểm",
            render: (row) => (
              <span className="text-base font-bold text-[#F27123]">
                {row.scoreValue}/{row.maxScore}
              </span>
            ),
          },
          {
            key: "comment",
            label: "Nhận xét",
            render: (row) => row.comment || "—",
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) => (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(row.resultId)}
                  className="rounded-lg border border-[#08509F] px-2.5 py-1 text-xs font-semibold text-[#08509F]"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row.resultId)}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600"
                >
                  Xóa
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyMessage="Không tìm thấy bản ghi học tập phù hợp"
      />

      <AcademicFormModal
        show={showModal}
        onHide={() => setShowModal(false)}
        editId={editId}
        onSaved={loadResults}
      />
    </>
  );
}

export default StaffAcademicPage;
