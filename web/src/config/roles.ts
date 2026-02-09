import type { Role } from '../store/auth';

/** Paths that each role can access. Drivers and Clients tabs only for DISPATCHER and ADMIN; DRIVER cannot see them. */
export const ROLE_PATHS: Record<Role, string[]> = {
  ADMIN: [
    '/dashboard',
    '/wall',
    '/calendar',
    '/drivers',
    '/pendings',
    '/roles',
    '/about',
    '/support',
    '/chat',
    '/statements',
    '/translation',
    '/my-profile',
    '/addresses',
    '/phone-base',
  ],
  DISPATCHER: [
    '/dashboard',
    '/wall',
    '/calendar',
    '/drivers',
    '/pendings',
    '/about',
    '/support',
    '/chat',
    '/statements',
    '/translation',
    '/my-profile',
    '/addresses',
    '/phone-base',
  ],
  /** Driver: Dashboard (My trips), Translation, Support (Chat + Statements), My Profile; About and Driver reports via My Profile. */
  DRIVER: ['/dashboard', '/translation', '/support', '/chat', '/statements', '/my-profile', '/driver-reports', '/about'],
  CLIENT: [],
};

export function canAccessPath(role: Role | null, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_PATHS[role];
  if (!allowed) return false;
  return allowed.includes(path) || path === '/';
}

/** Driver nav: My trips, Translation, Support (Chat + Statements), My Profile. */
export const DRIVER_NAV_ITEMS: { path: string; key: string }[] = [
  { path: '/dashboard', key: 'myTrips' },
  { path: '/translation', key: 'translation' },
  { path: '/support', key: 'support' },
  { path: '/my-profile', key: 'myProfile' },
];

/** Nav items in logical order: Main → People → Tools → Admin → About. */
const FULL_NAV_ORDER: { path: string; key: string; group?: string }[] = [
  // Operations
  { path: '/dashboard', key: 'dashboard', group: 'operations' },
  { path: '/wall', key: 'liveWall', group: 'operations' },
  { path: '/calendar', key: 'calendar', group: 'operations' },

  // Dispatch Center
  { path: '/drivers', key: 'drivers', group: 'dispatch' },

  // Information (Addresses, Phone base — dispatchers/admins only)
  { path: '/addresses', key: 'addresses', group: 'information' },
  { path: '/phone-base', key: 'phoneBase', group: 'information' },

  // Driver support (Chat, Statements — subcategories)
  { path: '/chat', key: 'chat', group: 'driverSupport' },
  { path: '/statements', key: 'statements', group: 'driverSupport' },

  // System (Roles, Pending drivers, About)
  { path: '/roles', key: 'roles', group: 'system' },
  { path: '/pendings', key: 'pendings', group: 'system' },
  { path: '/about', key: 'about', group: 'system' },
];

export function getAllowedNavItems(
  role: Role | null,
): { path: string; key: string; group?: string }[] {
  if (!role) return [];
  if (role === 'DRIVER') return DRIVER_NAV_ITEMS.map((item) => ({ ...item, group: undefined }));
  const allowedPaths = ROLE_PATHS[role];
  if (!allowedPaths) return [];
  return FULL_NAV_ORDER.filter((item) => allowedPaths.includes(item.path));
}
