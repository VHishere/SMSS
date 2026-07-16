import { Link } from "react-router-dom";
import { FiSearch } from "react-icons/fi";

function StaffDataTable({
  title,
  description,
  toolbar,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  showSearch = true,
  getRowLink,
  rowLinkClassName = "block max-w-[260px] break-words px-4 py-4 text-inherit no-underline hover:text-inherit sm:px-5",
  columns,
  rows,
  emptyMessage = "Không có dữ liệu",
  isLoading = false,
  tableAlignClassName = "text-left",
}) {
  return (
    <section className="max-w-full overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
      <div className="border-b border-orange-50 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {(title || description) && (
            <div className="min-w-0">
              {title && (
                <h3 className="mb-1 break-words text-base font-bold text-[#0F2747]">
                  {title}
                </h3>
              )}

              {description && (
                <p className="mb-0 text-sm text-slate-500">
                  {description}
                </p>
              )}
            </div>
          )}

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
            {toolbar}

            {showSearch && (
              <div className="relative w-full min-w-0 sm:max-w-xs">
                <FiSearch
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) =>
                    onSearchChange(event.target.value)
                  }
                  placeholder={searchPlaceholder}
                  className="
                    w-full rounded-xl border
                    border-slate-200 bg-[#FFF7F2]
                    py-2.5 pr-3 pl-9 text-sm
                    text-[#0F2747] outline-none
                    transition focus:border-[#F27123]
                    focus:bg-white focus:ring-2
                    focus:ring-[#F27123]/20
                  "
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table className={`min-w-full text-sm ${tableAlignClassName}`}>
          <thead className="bg-[#FFF7F2] text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 whitespace-nowrap sm:px-5"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const rowLink = getRowLink?.(row);
                const rowClass = `border-t border-slate-100 transition hover:bg-[#FFE7D6]/25${rowLink ? " cursor-pointer" : ""}`;

                const cells = columns.map((column) => (
                  <td
                    key={column.key}
                    className="max-w-[260px] px-4 py-4 align-top break-words text-[#0F2747] sm:px-5"
                  >
                    {column.render
                      ? column.render(row)
                      : row[column.key] || "—"}
                  </td>
                ));

                if (rowLink) {
                  return (
                    <tr key={row.id || index} className={rowClass}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="p-0 align-top sm:p-0"
                        >
                        <Link
                            to={rowLink}
                            className={`${rowLinkClassName} hover:no-underline`}
                          >
                            {column.render
                              ? column.render(row)
                              : row[column.key] || "—"}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  );
                }

                return (
                  <tr key={row.id || index} className={rowClass}>
                    {cells}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default StaffDataTable;
