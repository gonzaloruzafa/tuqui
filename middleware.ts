import { auth } from "./lib/auth/config"

export default auth

export const config = {
    // Protect all routes except public assets and auth endpoints
    matcher: [
        '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$).*)',
    ],
}
