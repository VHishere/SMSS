import { staffApi } from "../../../api/client";
import AdminMessages from "../../admin/AdminMessages";

function StaffMessagesPage() {
  return (
    <AdminMessages
      api={staffApi}
      staffSectionLabel="Admin"
      teacherSectionLabel="Giáo viên"
    />
  );
}

export default StaffMessagesPage;
