function ErrorAlert({ error }) {
  if (!error) return null;

  return (
    <div
      className="
        rounded-2xl border border-red-200
        bg-red-50 px-5 py-4
        text-sm text-red-600
      "
    >
      {error}
    </div>
  );
}

export default ErrorAlert;