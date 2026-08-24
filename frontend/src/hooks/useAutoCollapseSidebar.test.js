import { renderHook, act } from "@testing-library/react";

import { useAutoCollapseSidebar } from "./useAutoCollapseSidebar";

// Giả lập event: closest('[data-menu-item]') trả object (menu item) hoặc null.
const evt = (isMenuItem) => ({ target: { closest: () => (isMenuItem ? {} : null) } });

describe("useAutoCollapseSidebar", () => {
  it("mặc định: sidebar mở rộng", () => {
    const { result } = renderHook(() => useAutoCollapseSidebar());
    expect(result.current.collapsed).toBe(false);
  });

  it("bấm vùng nội dung chính → thu gọn", () => {
    const { result } = renderHook(() => useAutoCollapseSidebar());
    act(() => result.current.onContentMouseDown());
    expect(result.current.collapsed).toBe(true);
  });

  it("đang thu gọn + bấm vùng chrome sidebar (không phải menu) → mở ra", () => {
    const { result } = renderHook(() => useAutoCollapseSidebar(true));
    act(() => result.current.onSidebarMouseDown(evt(false)));
    expect(result.current.collapsed).toBe(false);
  });

  it("đang thu gọn + bấm MENU ITEM → cũng mở ra (không kẹt thu gọn trên staff)", () => {
    const { result } = renderHook(() => useAutoCollapseSidebar(true));
    act(() => result.current.onSidebarMouseDown(evt(true)));
    expect(result.current.collapsed).toBe(false);
  });

  it("đang mở + bấm chrome sidebar → không toggle (vẫn mở)", () => {
    const { result } = renderHook(() => useAutoCollapseSidebar(false));
    act(() => result.current.onSidebarMouseDown(evt(false)));
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle() đảo trạng thái", () => {
    const { result } = renderHook(() => useAutoCollapseSidebar(false));
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });
});
