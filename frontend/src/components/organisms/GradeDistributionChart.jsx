// SVG bar chart for grade distribution (no external chart library).
const BAR_COLORS = ["#DC2626", "#F59E0B", "#08509F", "#F27123", "#16A34A"];

function GradeDistributionChart({ distribution }) {
  if (!distribution || distribution.length === 0) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-slate-400"
        style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
      >
        Chưa có dữ liệu
      </div>
    );
  }

  const SLOT = 92;
  const BAR_W = 54;
  const CH = 130;
  const PAD_T = 22;
  const LABEL_H = 44;
  const SVG_W = distribution.length * SLOT;
  const SVG_H = PAD_T + CH + LABEL_H;
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" role="img" aria-label="Phân bố điểm">
      {distribution.map((d, i) => {
        const cx = i * SLOT + SLOT / 2;
        const bx = cx - BAR_W / 2;
        const h = Math.round((d.count / maxCount) * CH);
        const top = PAD_T + CH - h;
        const color = BAR_COLORS[i % BAR_COLORS.length];

        return (
          <g key={d.key}>
            <rect x={bx} y={PAD_T} width={BAR_W} height={CH} rx={6} fill="#F1F5F9" />
            {h > 1 && <rect x={bx} y={top} width={BAR_W} height={h} rx={6} fill={color} />}
            <text x={cx} y={top - 6} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#0F2747">
              {d.count}
            </text>
            {d.label.split(" ").reduce((lines, word) => {
              // wrap label into max 2 lines
              const last = lines[lines.length - 1];
              if (last && (last + " " + word).length <= 12) lines[lines.length - 1] = last + " " + word;
              else lines.push(word);
              return lines;
            }, []).slice(0, 2).map((line, li) => (
              <text key={li} x={cx} y={PAD_T + CH + 16 + li * 12} textAnchor="middle" fontSize="10" fontFamily="system-ui, sans-serif" fill="#64748B">
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default GradeDistributionChart;
