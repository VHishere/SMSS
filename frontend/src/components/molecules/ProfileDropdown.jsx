import { forwardRef } from "react";

import Dropdown from "react-bootstrap/Dropdown";

import { useNavigate } from "react-router-dom";

import {
  FiChevronDown,
  FiLogOut,
  FiSettings,
  FiUser,
} from "react-icons/fi";

import { useAuth } from "../../context/AuthContext";

import UserAvatar from "../atoms/UserAvatar";

const ProfileToggle = forwardRef(
  function ProfileToggle(
    {
      onClick,
      user,
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        className="
          flex items-center gap-3
          rounded-xl border-0
          bg-transparent px-2 py-1.5
          text-left transition
          hover:bg-[#FFE7D6]/60
        "
      >
        <UserAvatar
          name={user.name}
          src={user.avatar}
        />

        <div className="hidden min-w-0 sm:block">
          <p className="mb-0 max-w-32 truncate text-sm font-bold text-[#0F2747]">
            {user.name}
          </p>

          <p className="mb-0 text-xs text-slate-500">
            {user.role}
          </p>
        </div>

        <FiChevronDown
          size={16}
          className="hidden text-slate-500 sm:block"
        />
      </button>
    );
  },
);

function ProfileDropdown({ user }) {
  const navigate = useNavigate();
  const {
    logout,
    user: authUser,
  } = useAuth();

  const roleNames =
    authUser?.roles?.map(
      (role) => role.roleName,
    ) || [];

  const canViewStudentProfile =
    roleNames.includes("STUDENT");

  const handleViewProfile = () => {
    if (canViewStudentProfile) {
      navigate("/student/profile");
    }
  };

  const handleLogout = () => {
    logout();

    navigate("/login/school", {
      replace: true,
    });
  };

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        as={ProfileToggle}
        user={user}
      />

      <Dropdown.Menu
        className="
          mt-2 min-w-56 rounded-xl
          border-orange-100 p-2
          shadow-lg
        "
      >
        <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
          <p className="mb-0 text-sm font-bold text-[#0F2747]">
            {user.name}
          </p>

          <p className="mb-0 text-xs text-slate-500">
            {user.role}
          </p>
        </div>

        <Dropdown.Item
          as="button"
          onClick={handleViewProfile}
          disabled={!canViewStudentProfile}
          className="
            flex items-center gap-3
            rounded-lg px-3 py-2
            text-sm
          "
        >
          <FiUser size={17} />
          Hồ sơ cá nhân
        </Dropdown.Item>

        <Dropdown.Item
          as="button"
          disabled
          className="
            flex items-center gap-3
            rounded-lg px-3 py-2
            text-sm
          "
        >
          <FiSettings size={17} />
          Cài đặt
        </Dropdown.Item>

        <Dropdown.Divider />

        <Dropdown.Item
          as="button"
          onClick={handleLogout}
          className="
            flex items-center gap-3
            rounded-lg px-3 py-2
            text-sm text-red-600
          "
        >
          <FiLogOut size={17} />
          Đăng xuất
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default ProfileDropdown;