import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /register (auth pages)
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/static, /_next/image (Next.js internals)
     * - /favicon.ico
     */
    '/((?!login|register|api/auth|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
