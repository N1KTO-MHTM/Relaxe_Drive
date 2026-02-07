import type { Role } from '../store/auth';

/** Paths that each role can access. Drivers and Clients tabs only for DISPATCHER and ADMIN; DRIVER cannot see them. */
export const ROLE_PATHS: Record<Role, string[]> = {
  ADMIN: [
    '/dashboard',
    '/wall',
    '/calendar',
    '/passengers',
    '/addresses',
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
    '/addresses',
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

/** Nav items in logical order: Main → People → Tools → Admin → About. */
const FULL_NAV_ORDER: { path: string; key: string; group?: string }[] = [
  { path: '/dashboard', key: 'dashboard', group: 'main' },
  { path: '/wall', key: 'liveWall', group: 'main' },
  { path: '/calendar', key: 'calendar', group: 'main' },
  { path: '/passengers', key: 'passengers', group: 'people' },
  { path: '/addresses', key: 'addresses', group: 'people' },
  { path: '/drivers', key: 'drivers', group: 'people' },
  { path: '/pendings', key: 'pendings', group: 'people' },
  { path: '/translation', key: 'translation', group: 'tools' },
  { path: '/analytics', key: 'analytics', group: 'tools' },
  { path: '/roles', key: 'roles', group: 'admin' },
  { path: '/sessions', key: 'sessions', group: 'admin' },
  { path: '/cost-control', key: 'costControl', group: 'admin' },
  { path: '/white-label', key: 'whiteLabel', group: 'admin' },
  { path: '/audit', key: 'audit', group: 'admin' },
  { path: '/health', key: 'health', group: 'admin' },
  { path: '/phone-base', key: 'phoneBase', group: 'tools' },
  { path: '/about', key: 'about', group: 'about' },
];

export function getAllowedNavItems(role: Role | null): { path: string; key: string; group?: string }[] {
  if (!role) return [];
  const allowedPaths = ROLE_PATHS[role];
  if (!allowedPaths) return [];
  return FULL_NAV_ORDER.filter((item) => allowedPaths.includes(item.path));
}
