const SCHOOL_ROLES = [
    'ADMIN',
    'STAFF',
    'HOMEROOM_TEACHER',
    'SUBJECT_TEACHER',
    'DORM_SUPERVISOR',
    'STUDENT'
];

const PARENT_ROLES = ['PARENT'];

const ROLE_DASHBOARD = {
    ADMIN: '/admin',
    STAFF: '/staff',
    HOMEROOM_TEACHER: '/teacher',
    SUBJECT_TEACHER: '/teacher',
    DORM_SUPERVISOR: '/teacher',
    PARENT: '/parent',
    STUDENT: '/student'
};

function getPrimaryRole(roles) {
    const priority = ['ADMIN', 'STAFF', 'HOMEROOM_TEACHER', 'SUBJECT_TEACHER', 'DORM_SUPERVISOR', 'PARENT', 'STUDENT'];
    return priority.find((role) => roles.includes(role)) || roles[0];
}

function getDashboardPath(roles) {
    return ROLE_DASHBOARD[getPrimaryRole(roles)] || '/';
}

module.exports = {
    SCHOOL_ROLES,
    PARENT_ROLES,
    ROLE_DASHBOARD,
    getPrimaryRole,
    getDashboardPath
};
