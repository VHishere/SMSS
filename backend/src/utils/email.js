const SCHOOL_EMAIL_PATTERNS = [
    /@edu\.fpt\.vn$/i,
    /@fptschool\.edu\.vn$/i,
    /@student\.fptschool\.edu\.vn$/i
];

function isSchoolEmail(email) {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return SCHOOL_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

module.exports = { isSchoolEmail };
