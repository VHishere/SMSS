import fptLogo from "../../assets/logoFPT.jpg";

function FptBrand() {
  return (
    <div className="flex w-full items-center justify-center">
      <img
        src={fptLogo}
        alt="FPT School"
        className="h-12 w-auto max-w-full rounded-md object-contain"
      />
    </div>
  );
}

export default FptBrand;