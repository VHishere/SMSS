import StaffPageHeader from "../../../components/staff/StaffPageHeader";

function StaffReportsPage() {
  return (
    <>
      <StaffPageHeader
        title="Báo cáo"
        // description="Khu vực báo cáo tổng hợp sẽ được bổ sung trong giai đoạn tiếp theo"
      />

      <div className="rounded-3xl border border-dashed card-border bg-white p-10 text-center shadow-sm">
        <p className="mb-0 text-sm font-medium text-slate-500">
          Module báo cáo đang được phát triển
        </p>
      </div>
    </>
  );
}

export default StaffReportsPage;
