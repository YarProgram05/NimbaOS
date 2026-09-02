import { withAuth } from 'next-auth/middleware'

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ token }) => !!token && token.invalid !== true,
  },
})

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /register (auth pages)
     * - /api/auth/* (NextAuth endpoints), /api/health (public healthcheck)
     * - /_next/static, /_next/image (Next.js internals)
     * - /favicon.ico
     */
    '/((?!login|register|api/auth|api/health|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
