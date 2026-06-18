import { Link } from "react-router-dom";
import { FiSearch } from "react-icons/fi";

function StaffDataTable({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  showSearch = true,
  getRowLink,
  columns,
  rows,
  emptyMessage = "Không có dữ liệu",
  isLoading = false,
}) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white shadow-sm">
      <div className="border-b border-orange-50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="mb-1 text-base font-bold text-[#0F2747]">
              {title}
            </h3>

            {description && (
              <p className="mb-0 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            {showSearch && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#FFF7F2] text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-5 py-3 whitespace-nowrap sm:px-6"
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
                    className="px-5 py-4 align-top whitespace-nowrap text-[#0F2747] sm:px-6"
                  >
                    {column.render
                      ? column.render(row)
                      : row[column.key] || "—"}
                  </td>
                ));

                if (rowLink) {
                  return (
                    <tr key={row.id || index} className={rowClass}>
                      {columns.map((column, colIndex) => (
                        <td
                          key={column.key}
                          className="p-0 align-top whitespace-nowrap sm:p-0"
                        >
                          <Link
                            to={rowLink}
                            className="block px-5 py-4 text-[#0F2747] no-underline sm:px-6"
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
