import type { Role } from '../store/auth';

/** Paths that each role can access. Drivers and Clients tabs only for DISPATCHER and ADMIN; DRIVER cannot see them. */
export const ROLE_PATHS: Record<Role, string[]> = {
  ADMIN: [
    '/dashboard', '/wall', '/calendar',
    '/passengers', '/addresses', '/drivers', '/phone-base', '/pendings',
    '/analytics', '/driver-reports', '/cost-control', '/sessions', '/audit',
    '/roles', '/translation', '/white-label', '/health', '/about',
  ],
  DISPATCHER: [
    '/dashboard', '/wall', '/calendar',
    '/passengers', '/addresses', '/drivers', '/phone-base', '/pendings',
    '/analytics', '/driver-reports', '/sessions', '/audit',
    '/translation', '/about',
  ],
  /** Driver: Dashboard, My Reports, Translation, About. */
  DRIVER: ['/dashboard', '/driver-reports', '/translation', '/about'],
};

export function canAccessPath(role: Role | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_PATHS[role];
  if (!allowed) return false;
  return allowed.includes(path) || path === '/';
}

/** Nav items in logical order: Main → People → Tools → Admin → About. */
const FULL_NAV_ORDER: { path: string; key: string; group?: string }[] = [
  // Operations
  { path: '/dashboard', key: 'dashboard', group: 'operations' },
  { path: '/wall', key: 'liveWall', group: 'operations' },
  { path: '/calendar', key: 'calendar', group: 'operations' },

  // Dispatch Center
  { path: '/drivers', key: 'drivers', group: 'dispatch' },
  { path: '/passengers', key: 'passengers', group: 'dispatch' },
  { path: '/addresses', key: 'addresses', group: 'dispatch' },
  { path: '/phone-base', key: 'phoneBase', group: 'dispatch' },
  { path: '/pendings', key: 'pendings', group: 'dispatch' },

  // Business Intelligence
  { path: '/analytics', key: 'analytics', group: 'bi' },
  { path: '/driver-reports', key: 'driverReports', group: 'bi' }, // New
  { path: '/cost-control', key: 'costControl', group: 'bi' },
  { path: '/sessions', key: 'sessions', group: 'bi' },
  { path: '/audit', key: 'audit', group: 'bi' },

  // System Settings
  { path: '/roles', key: 'roles', group: 'system' },
  { path: '/translation', key: 'translation', group: 'system' },
  { path: '/white-label', key: 'whiteLabel', group: 'system' },
  { path: '/health', key: 'health', group: 'system' },
  { path: '/about', key: 'about', group: 'system' },
];

export function getAllowedNavItems(role: Role | null): { path: string; key: string; group?: string }[] {
  if (!role) return [];
  const allowedPaths = ROLE_PATHS[role];
  if (!allowedPaths) return [];
  return FULL_NAV_ORDER.filter((item) => allowedPaths.includes(item.path));
}
