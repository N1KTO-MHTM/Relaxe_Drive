import type { Role } from '../store/auth';

/** Paths that each role can access. Drivers and Clients tabs only for DISPATCHER and ADMIN; DRIVER cannot see them. */
export const ROLE_PATHS: Record<Role, string[]> = {
  ADMIN: [
    '/dashboard',
    '/calendar',
    '/passengers',
    '/drivers',
    '/translation',
    '/analytics',
    '/roles',
    '/sessions',
    '/cost-control',
    '/white-label',
    '/about',
  ],
  DISPATCHER: [
    '/dashboard',
    '/calendar',
    '/passengers',
    '/drivers',
    '/translation',
    '/sessions',
    '/about',
  ],
  /** Driver: no Passengers, no Drivers — only dashboard, translation, about. */
  DRIVER: ['/dashboard', '/translation', '/about'],
};

export function canAccessPath(role: Role | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_PATHS[role];
  if (!allowed) return false;
  return allowed.includes(path) || path === '/';
}

export function getAllowedNavItems(role: Role | null): { path: string; key: string }[] {
  const fullNav = [
    { path: '/dashboard', key: 'dashboard' },
    { path: '/calendar', key: 'calendar' },
    { path: '/passengers', key: 'passengers' },
    { path: '/drivers', key: 'drivers' },
    { path: '/translation', key: 'translation' },
    { path: '/analytics', key: 'analytics' },
    { path: '/roles', key: 'roles' },
    { path: '/sessions', key: 'sessions' },
    { path: '/cost-control', key: 'costControl' },
    { path: '/white-label', key: 'whiteLabel' },
    { path: '/about', key: 'about' },
  ];
  if (!role) return [];
  const allowedPaths = ROLE_PATHS[role];
  if (!allowedPaths) return [];
  return fullNav.filter((item) => allowedPaths.includes(item.path));
}
