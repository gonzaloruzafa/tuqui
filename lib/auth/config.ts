import NextAuth, { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnDashboard = nextUrl.pathname.startsWith("/") && nextUrl.pathname !== "/login"

            if (isOnDashboard) {
                if (isLoggedIn) return true
                return false // Redirect unauthenticated users to login page
            } else if (isLoggedIn) {
                return Response.redirect(new URL("/", nextUrl))
            }
            return true
        },
        async session({ session, token }) {
            if (session.user?.email) {
                // Fetch tenant info
                const { getTenantForUser, isUserAdmin } = await import("@/lib/supabase/tenant")
                const tenant = await getTenantForUser(session.user.email)

                if (tenant) {
                    session.tenant = tenant
                    session.isAdmin = await isUserAdmin(session.user.email)
                }
            }
            return session
        },
    },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
