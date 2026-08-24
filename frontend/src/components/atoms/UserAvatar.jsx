
function UserAvatar({ name = "User", src, size = "md" }) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-20 w-20 text-xl",
  };

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-orange-100`}
      />
    );
  }

  return (
    <div
      className={`
        ${sizes[size]}
        flex shrink-0 items-center justify-center
        rounded-full bg-[#F27123]
        font-bold text-white ring-2 ring-orange-100
      `}
    >
      {initials}
    </div>
  );
}

export default UserAvatar;