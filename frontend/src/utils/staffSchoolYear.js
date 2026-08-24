const STAFF_WORKING_SCHOOL_YEAR_KEY = "staff_working_school_year_id";

export function getStaffWorkingSchoolYearId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STAFF_WORKING_SCHOOL_YEAR_KEY) || "";
}

export function setStaffWorkingSchoolYearId(schoolYearId) {
  if (typeof window === "undefined") return;

  const value = schoolYearId ? String(schoolYearId) : "";
  if (value) {
    window.localStorage.setItem(STAFF_WORKING_SCHOOL_YEAR_KEY, value);
  } else {
    window.localStorage.removeItem(STAFF_WORKING_SCHOOL_YEAR_KEY);
  }

  window.dispatchEvent(
    new CustomEvent("staff-school-year:changed", {
      detail: { schoolYearId: value },
    }),
  );
}

export function resolveStaffWorkingSchoolYear(schoolYears = [], preferredId = "") {
  const workingId = preferredId || getStaffWorkingSchoolYearId();
  const selected = schoolYears.find(
    (year) => String(year.schoolYearId) === String(workingId),
  );

  return (
    selected ||
    schoolYears.find((year) => year.isActive) ||
    schoolYears[0] ||
    null
  );
}
