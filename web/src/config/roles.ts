import type { Role } from '../store/auth';

/** Paths that each role can access. Drivers and Clients tabs only for DISPATCHER and ADMIN; DRIVER cannot see them. */
export const ROLE_PATHS: Record<Role, string[]> = {
  ADMIN: [
    '/dashboard',
    '/wall',
    '/calendar',
    '/passengers',
    '/drivers',
    '/pendings',
    '/translation',
    '/analytics',
    '/roles',
    '/sessions',
    '/cost-control',
    '/white-label',
    '/audit',
    '/health',
    '/about',
  ],
  DISPATCHER: [
    '/dashboard',
    '/wall',
    '/calendar',
    '/passengers',
    '/drivers',
    '/pendings',
    '/translation',
    '/sessions',
    '/audit',
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
    { path: '/wall', key: 'liveWall' },
    { path: '/calendar', key: 'calendar' },
    { path: '/passengers', key: 'passengers' },
    { path: '/drivers', key: 'drivers' },
    { path: '/pendings', key: 'pendings' },
    { path: '/translation', key: 'translation' },
    { path: '/analytics', key: 'analytics' },
    { path: '/roles', key: 'roles' },
    { path: '/sessions', key: 'sessions' },
    { path: '/cost-control', key: 'costControl' },
    { path: '/white-label', key: 'whiteLabel' },
    { path: '/audit', key: 'audit' },
    { path: '/health', key: 'health' },
    { path: '/about', key: 'about' },
  ];
  if (!role) return [];
  const allowedPaths = ROLE_PATHS[role];
  if (!allowedPaths) return [];
  return fullNav.filter((item) => allowedPaths.includes(item.path));
}
