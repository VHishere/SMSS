import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useParentStudents } from "../../hooks/useParentStudents";

function ParentStudentRedirect() {
  const navigate = useNavigate();
  const { students, loading, error } = useParentStudents();

  useEffect(() => {
    if (loading) return;

    if (error || students.length === 0) return;

    const primary = students.find((s) => s.isPrimary === 1) || students[0];
    navigate(`/parent/student/${primary.studentId}`, { replace: true });
  }, [students, loading, error, navigate]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!loading && students.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        Chưa có học sinh nào được liên kết với tài khoản này.
      </div>
    );
  }

  return (
    <div className="py-10 text-center text-sm text-slate-500">
      Đang tải...
    </div>
  );
}

export default ParentStudentRedirect;
