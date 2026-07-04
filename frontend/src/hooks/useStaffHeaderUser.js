import { useMemo } from "react";

import { useAuth } from "../context/useAuth";

function useStaffHeaderUser() {
  const { user } = useAuth();

  return useMemo(() => {
    const staffRole = user?.roles?.find((role) =>
      ["STAFF", "ADMIN"].includes(role.roleName),
    );

    return {
      name: user?.fullName || user?.username || "Staff",
      role: staffRole?.description || "Nhân viên phòng đào tạo",
      avatar: user?.avatar || "",
    };
  }, [user]);
}

export default useStaffHeaderUser;
