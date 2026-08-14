const promotionService = require("../services/promotion.service");
const staffSchoolYearModel = require("../models/staff/schoolYears");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
    ...(error.details ? { details: error.details } : {}),
  });
}

async function evaluateSchoolYear(req, res) {
  try {
    const data = await promotionService.evaluateSchoolYear({
      schoolYearId: Number(req.params.id),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể xét điều kiện lên lớp");
  }
}

async function closeSchoolYear(req, res) {
  try {
    const schoolYearId = Number(req.params.id);

    // Chặn NGAY trước mọi side-effect: nếu chưa qua ngày kết thúc năm học thì
    // không được tự tạo/copy dữ liệu nền của năm kế tiếp chỉ vì Admin bấm nhầm.
    await promotionService.assertSchoolYearCanClose({ schoolYearId });

    const preview = await promotionService.evaluateSchoolYear({ schoolYearId });

    // Tận dụng logic đã có: tự chuẩn bị lớp/học kỳ/chương trình của năm tiếp theo
    // trước khi kiểm tra mapping. Không thêm bảng hay thay đổi schema DB.
    await staffSchoolYearModel.initializeSchoolYearData(
      preview.targetYear.schoolYearId,
    );

    const data = await promotionService.closeSchoolYear({ schoolYearId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể kết thúc năm học");
  }
}

module.exports = {
  closeSchoolYear,
  evaluateSchoolYear,
};
