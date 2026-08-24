const PORTAL_KEY = 'smss_last_portal';

export function saveLastPortal(portal) {
    if (portal === 'school' || portal === 'parent') {
        localStorage.setItem(PORTAL_KEY, portal);
    }
}

export function getLoginPath() {
    const portal = localStorage.getItem(PORTAL_KEY);

    if (portal === 'school' || portal === 'parent') {
        return `/login/${portal}`;
    }

    return '/';
}
