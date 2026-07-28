import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FiGrid } from "react-icons/fi";

import SidebarMenuItem from "./SidebarMenuItem";

function renderItem(props = {}) {
  return render(
    <MemoryRouter>
      <SidebarMenuItem to="/x" label="Tổng quan" icon={FiGrid} variant="stitch" {...props} />
    </MemoryRouter>,
  );
}

describe("SidebarMenuItem", () => {
  it("mở rộng: hiện label", () => {
    renderItem();
    expect(screen.getByText("Tổng quan")).toBeTruthy();
  });

  it("thu gọn: ẩn label + có tooltip + data-menu-item", () => {
    const { container } = renderItem({ collapsed: true });
    expect(screen.queryByText("Tổng quan")).toBeNull();
    const link = container.querySelector("a[data-menu-item]");
    expect(link).toBeTruthy();
    expect(link.getAttribute("title")).toBe("Tổng quan");
  });
});
