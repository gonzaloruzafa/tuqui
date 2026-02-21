import { auth } from "./lib/auth/config"

export default auth

export const config = {
    // Protect all routes except public assets, auth endpoints, and internal test endpoints
    // PWA: manifest.json and sw.js must be accessible without auth for install prompt
    matcher: [
        '/((?!api/webhooks/|api/internal/|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.png$|.*\\.svg$).*)',
    ],
}
