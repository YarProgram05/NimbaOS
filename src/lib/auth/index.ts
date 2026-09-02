import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { isSessionCurrent, normalizeEmail } from '@/lib/auth/account-security'
import type { UserRole } from '@/types'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizeEmail(credentials.email),
              mode: 'insensitive',
            },
          },
        })

        if (!user || !user.isActive) return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // user.role comes from the authorize() return value
        token.role = (user as { role: UserRole }).role
        token.sessionVersion = user.sessionVersion
        token.invalid = false
        return token
      }

      // Tokens issued before sessionVersion support are intentionally expired once.
      if (!token.id || typeof token.sessionVersion !== 'number') {
        token.invalid = true
        return token
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          email: true,
          name: true,
          role: true,
          isActive: true,
          sessionVersion: true,
        },
      })

      if (!currentUser || !isSessionCurrent(currentUser, token.sessionVersion)) {
        token.invalid = true
        return token
      }

      token.email = currentUser.email
      token.name = currentUser.name
      token.role = currentUser.role
      token.invalid = false
      return token
    },
    async session({ session, token }) {
      if (token.invalid) {
        session.user = undefined as unknown as typeof session.user
        return session
      }

      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
