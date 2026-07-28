import fptLogo from "../../assets/logoFPT.png";

function FptBrand() {
  return (
    <div className="flex w-full items-center justify-center">
      {/* shrink-0 + không giới hạn max-w: khi sidebar đang chạy animation mở ra,
          logo giữ nguyên kích thước (bị cắt bớt) thay vì bị bóp méo rồi giãn ra. */}
      <img
        src={fptLogo}
        alt="FPT School"
        className="h-12 w-auto max-w-none shrink-0 rounded-md object-contain"
      />
    </div>
  );
}

export default FptBrand;