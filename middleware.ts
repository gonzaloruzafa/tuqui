import { auth } from "./lib/auth/config"

export default auth

export const config = {
    // Protect all routes except public assets, auth endpoints, and internal test endpoints
    matcher: [
        '/((?!api/whatsapp/webhook|api/internal/|_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$).*)',
    ],
}
