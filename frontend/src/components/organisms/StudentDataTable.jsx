import EmptyState from "../molecules/EmptyState";

function StudentDataTable({
  columns,
  data,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription,
}) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-orange-100 bg-[#FFF7F2]">
            {columns.map((column) => (
              <th
                key={column.key}
                className="
                  px-4 py-3 text-left
                  text-xs font-bold uppercase
                  tracking-wider text-[#F27123]
                "
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((item, index) => (
            <tr
              key={item.id || item.attendanceId || item.behaviorId || item.goalId || index}
              className="
                border-b border-slate-50 bg-white
                hover:bg-orange-50/40
              "
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-4 py-3 text-slate-600"
                >
                  {column.render
                    ? column.render(item, index)
                    : item[column.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StudentDataTable;