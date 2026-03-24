import type { Session } from 'next-auth'
import type { UserRole } from '@/types'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 3,
  MANAGER: 2,
  VIEWER: 1,
}

/**
 * Returns true if the session user has at least the required role.
 * Works in Server Components, Server Actions, and API Routes.
 */
export function checkRole(
  session: Session | null | undefined,
  requiredRole: UserRole
): boolean {
  if (!session?.user?.role) return false
  return ROLE_HIERARCHY[session.user.role] >= ROLE_HIERARCHY[requiredRole]
}
