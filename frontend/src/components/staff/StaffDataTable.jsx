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
  rowLinkClassName = "block max-w-[280px] break-words px-4 py-4 text-inherit no-underline hover:text-inherit sm:px-5",
  columns,
  rows,
  emptyMessage = "Không có dữ liệu",
  isLoading = false,
  tableAlignClassName = "text-left",
}) {
  const hasHeader = title || description || toolbar || showSearch;

  return (
    <section className="max-w-full overflow-hidden rounded-3xl border border-[#DFC0B2] bg-white shadow-sm">
      {hasHeader && (
        <div className="border-b border-[#F1DED4] px-4 py-4 sm:px-6">
          {(title || description) && (
            <div className="mb-4 min-w-0">
              {title && (
                <h3 className="mb-1 break-words text-base font-bold text-[#1A1C1C]">
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

          {(toolbar || showSearch) && (
            <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {showSearch && (
                <div className="relative min-w-0 flex-1">
                  <FiSearch
                    size={18}
                    className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-12 w-full rounded-full border border-[#DFC0B2] bg-[#F9F9F9] pr-4 pl-11 text-sm text-[#1A1C1C] outline-none transition placeholder:text-slate-400 focus:border-[#F27123] focus:bg-white focus:ring-2 focus:ring-[#F27123]/20"
                  />
                </div>
              )}

              {toolbar && (
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:flex lg:shrink-0 lg:items-center">
                  {toolbar}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="max-w-full overflow-x-auto">
        <table className={`min-w-full text-sm ${tableAlignClassName}`}>
          <thead className="bg-[#F9F9F9] text-xs font-semibold tracking-wide text-[#584238] uppercase">
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
                const rowClass = `border-t border-[#F1DED4] transition hover:bg-[#FFF7F2]${rowLink ? " cursor-pointer" : ""}`;

                // Key duy nhất & ổn định. KÈM index vì dữ liệu có thể trùng id
                // thật (vd getParents trả 1 dòng/mỗi liên kết PH–HS ⇒ cùng
                // parentId xuất hiện nhiều lần) → chỉ dùng id sẽ trùng key.
                const rawId =
                  row.id ?? row.studentId ?? row.parentId ?? row.teacherId ??
                  row.classId ?? row.userId ?? row.feeId ?? row.surveyId;
                const rowKey = `${rawId ?? "r"}-${index}`;

                const renderCell = (column) =>
                  column.render ? column.render(row) : row[column.key] || "-";

                if (rowLink) {
                  return (
                    <tr key={rowKey} className={rowClass}>
                      {columns.map((column) => (
                        <td key={column.key} className="p-0 align-top">
                          <Link
                            to={rowLink}
                            className={`${rowLinkClassName} hover:no-underline`}
                          >
                            {renderCell(column)}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  );
                }

                return (
                  <tr key={rowKey} className={rowClass}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="max-w-[280px] px-4 py-4 align-top break-words text-[#1A1C1C] sm:px-5"
                      >
                        {renderCell(column)}
                      </td>
                    ))}
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
