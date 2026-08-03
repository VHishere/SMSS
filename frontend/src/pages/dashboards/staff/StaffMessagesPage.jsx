import { staffApi } from "../../../api/client";
import AdminMessages from "../../admin/AdminMessages";

function StaffMessagesPage() {
  return (
    <AdminMessages
      api={staffApi}
      staffSectionLabel="Admin"
      teacherSectionLabel="Giáo viên"
      contactSearchPlaceholder="Tìm admin, giáo viên..."
    />
  );
}

export default StaffMessagesPage;
