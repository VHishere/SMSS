import { useCallback, useRef, useState } from "react";

// Tự thu gọn / mở sidebar theo vùng người dùng bấm (desktop). Tách khỏi UI để
// dễ test và tái sử dụng. Quy tắc:
//   • Bấm vùng nội dung chính (ngoài sidebar)      → collapsed = true
//   • Bấm bất kỳ đâu trong sidebar khi collapsed    → collapsed = false
//     (kể cả menu item — để không kẹt thu gọn trên shell bền vững như staff)
// Dùng handler gắn trực tiếp lên element (không nghe document toàn cục) nên
// không tranh chấp với listener khác. Ở mobile các class thu gọn đều là `lg:`
// nên state này không ảnh hưởng giao diện offcanvas.
export function useAutoCollapseSidebar(initialCollapsed = false) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const sidebarRef = useRef(null);

  // Bấm vào vùng nội dung chính → thu gọn (React tự bỏ qua nếu đã true).
  const onContentMouseDown = useCallback(() => setCollapsed(true), []);

  // Bấm bất kỳ đâu trong sidebar khi đang thu gọn → mở lại (kể cả menu item).
  // Trước đây menu item bị loại trừ, nên trên shell bền vững (staff dùng
  // StaffDashboardLayout, không remount khi điều hướng) sidebar bị kẹt thu gọn:
  // bấm icon thì điều hướng nhưng không mở lại. Giờ luôn mở khi đang collapsed;
  // nếu đang mở thì giữ nguyên (React bỏ qua set cùng giá trị).
  const onSidebarMouseDown = useCallback(() => {
    setCollapsed((c) => (c ? false : c));
  }, []);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return { collapsed, setCollapsed, toggle, sidebarRef, onContentMouseDown, onSidebarMouseDown };
}

export default useAutoCollapseSidebar;
