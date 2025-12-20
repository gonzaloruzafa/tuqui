import { runPendingTasks } from '@/lib/prometeo/runner'

export const dynamic = 'force-dynamic' // Important for Vercel Cron

export async function GET(req: Request) {
    // Check auth
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.PROMETEO_SECRET}`) {
        // Also allow Vercel Cron signature verification if needed
        // For now simple secret is fine
        return new Response('Unauthorized', { status: 401 })
    }

    // Run async (don't wait for completion if called from cron to avoid timeout?)
    // Vercel functions have timeout. Better to await if it's fast, or offload.
    // For Alpha: await
    await runPendingTasks()

    return Response.json({ ok: true })
}
