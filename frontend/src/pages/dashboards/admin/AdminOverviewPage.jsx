import { Link } from "react-router-dom";
import { FiUsers } from "react-icons/fi";

import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const QUICK_LINKS = [
  {
    label: "Quản lý tài khoản",
    description: "Tạo, tìm kiếm và khóa/mở khóa tài khoản người dùng",
    icon: FiUsers,
    path: "/admin/users",
  },
];

function AdminOverviewPage() {
  return (
    <>
      <StaffPageHeader
        title="Bảng điều khiển Admin"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="rounded-2xl border border-orange-100 bg-white p-5 no-underline shadow-sm transition hover:border-[#F27123] hover:shadow-md"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
              <item.icon size={20} />
            </div>

            <p className="mb-1 text-base font-bold text-[#0F2747]">
              {item.label}
            </p>

            <p className="mb-0 text-sm text-slate-500">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

export default AdminOverviewPage;
