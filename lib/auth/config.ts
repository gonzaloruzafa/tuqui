import NextAuth, { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login", // Redirect errors to login instead of error page
    },
    debug: process.env.NODE_ENV === 'development',
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnLogin = nextUrl.pathname === "/login"
            const isAuthCallback = nextUrl.pathname.startsWith("/api/auth")
            
            // Allow auth callbacks to pass through
            if (isAuthCallback) {
                return true
            }
            
            // If on login page and logged in, redirect to home
            if (isOnLogin && isLoggedIn) {
                return Response.redirect(new URL("/", nextUrl))
            }
            
            // If on login page and not logged in, allow
            if (isOnLogin) {
                return true
            }
            
            // All other pages require login
            return isLoggedIn
        },
        async session({ session, token }) {
            if (session.user?.email) {
                // Fetch tenant info
                const { getTenantForUser, isUserAdmin } = await import("@/lib/supabase/client")
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
