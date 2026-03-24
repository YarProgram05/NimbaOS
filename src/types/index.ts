export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
}

// Generic paginated response
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// Generic server action result
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
