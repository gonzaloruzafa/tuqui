import { auth } from "./lib/auth/config"

export default auth

export const config = {
    // Protect all routes except public assets and auth endpoints
    matcher: [
        '/((?!api/whatsapp/webhook|_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$).*)',
    ],
}
