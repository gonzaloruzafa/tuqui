import NextAuth, { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"

// Lazy Supabase client for auth (avoid build-time env issues)
function getSupabaseAuthClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export const authConfig = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    trustHost: true,
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
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                try {
                    // Authenticate with Supabase Auth (lazy init)
                    const supabaseAuth = getSupabaseAuthClient()
                    const { data, error } = await supabaseAuth.auth.signInWithPassword({
                        email: credentials.email as string,
                        password: credentials.password as string,
                    })

                    if (error || !data.user) {
                        console.log("[Auth] Supabase auth failed:", error?.message)
                        return null
                    }

                    return {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
                    }
                } catch (err) {
                    console.error("[Auth] Error during credentials auth:", err)
                    return null
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
                try {
                    const { getClient } = await import("@/lib/supabase/client")
                    const db = getClient()

                    // Single query: get tenant + is_admin in one roundtrip
                    const { data: users } = await db
                        .from('users')
                        .select('tenant_id, is_admin, tenants!inner(id, name, slug)')
                        .eq('email', session.user.email)
                        .limit(1)

                    const user = users?.[0]
                    if (user) {
                        const tenant = Array.isArray(user.tenants) ? user.tenants[0] : user.tenants
                        if (tenant) {
                            session.tenant = { id: tenant.id, name: tenant.name, slug: tenant.slug }
                            session.isAdmin = user.is_admin || false
                        }
                        
                        if (token?.sub) {
                            session.user.id = token.sub
                            // Conditional update — only fires when auth_user_id is null
                            await db
                                .from('users')
                                .update({ auth_user_id: token.sub })
                                .eq('email', session.user.email)
                                .eq('tenant_id', user.tenant_id)
                                .is('auth_user_id', null)
                        }
                    } else {
                        console.warn(`[Auth] No tenant found for ${session.user.email} - user may not exist in public.users`)
                    }
                } catch (err) {
                    console.error('[Auth] Session callback error:', err)
                }
            }
            return session
        },
    },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
