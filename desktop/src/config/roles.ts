import type { Role } from '../store/auth';

/** Desktop paths each role can access. Drivers and Clients tabs only for DISPATCHER and ADMIN; DRIVER cannot see them. */
export const DESKTOP_ROLE_PATHS: Record<Role, string[]> = {
  ADMIN: ['/control', '/wall', '/health', '/logs', '/admin', '/clients', '/drivers', '/calendar', '/about'],
  DISPATCHER: ['/control', '/wall', '/health', '/logs', '/clients', '/drivers', '/calendar', '/about'],
  /** Driver: no Clients, no Drivers, no Calendar — only control and about. */
  DRIVER: ['/control', '/about'],
};

export function canAccessDesktopPath(role: Role | null, path: string): boolean {
  if (!role) return false;
  const allowed = DESKTOP_ROLE_PATHS[role];
  if (!allowed) return false;
  return allowed.includes(path) || path === '/';
}

export function getAllowedDesktopNavItems(role: Role | null): { path: string; key: string }[] {
  const fullNav = [
    { path: '/control', key: 'modes.control' },
    { path: '/wall', key: 'modes.wall' },
    { path: '/health', key: 'modes.health' },
    { path: '/logs', key: 'modes.logs' },
    { path: '/admin', key: 'modes.admin' },
    { path: '/clients', key: 'modes.clients' },
    { path: '/drivers', key: 'modes.drivers' },
    { path: '/calendar', key: 'modes.calendar' },
    { path: '/about', key: 'about.title' },
  ];
  if (!role) return [];
  const allowedPaths = DESKTOP_ROLE_PATHS[role];
  if (!allowedPaths) return [];
  return fullNav.filter((item) => allowedPaths.includes(item.path));
}

/** First allowed path for role; used as redirect when access denied. */
export function getDefaultPathForRole(role: Role | null): string {
  const items = getAllowedDesktopNavItems(role);
  return items.length ? items[0].path : '/control';
}
