import { signIn } from "@/lib/auth/config"
import Image from "next/image"
import { redirect } from "next/navigation"

async function handleCredentialsLogin(formData: FormData) {
    "use server"
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    
    try {
        await signIn("credentials", { 
            email, 
            password, 
            redirectTo: "/" 
        })
    } catch (error: any) {
        // NextAuth throws NEXT_REDIRECT on success, let it through
        if (error?.digest?.includes('NEXT_REDIRECT')) {
            throw error
        }
        // For other errors, redirect back to login with error
        redirect("/login?error=CredentialsSignin")
    }
}

async function handleGoogleLogin() {
    "use server"
    await signIn("google", { redirectTo: "/" })
}

export default async function LoginPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ error?: string }> 
}) {
    const { error } = await searchParams
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md mx-4">
                {/* Logo Adhoc - más grande */}
                <div className="flex justify-center mb-6">
                    <Image
                        src="/adhoc-logo.png"
                        alt="Adhoc"
                        width={96}
                        height={96}
                        className="object-contain"
                        priority
                    />
                </div>

                {/* Título con New Kansas */}
                <div className="text-center mb-8">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-adhoc-lavender/30 text-adhoc-violet font-bold text-xs uppercase tracking-wider mb-4">
                        Plataforma Alpha
                    </span>
                    <h1 className="text-4xl font-medium text-gray-900 tracking-tight font-display">
                        Tuqui
                    </h1>
                    <p className="mt-3 text-base text-gray-500">
                        Agentes IA para tu negocio
                    </p>
                </div>

                {/* Error message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                        {error === 'CredentialsSignin' 
                            ? 'Email o contraseña incorrectos' 
                            : 'Error al iniciar sesión'}
                    </div>
                )}

                {/* Email/Password form */}
                <form action={handleCredentialsLogin} className="space-y-4 mb-6">
                    <div>
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-adhoc-violet/30 focus:border-adhoc-violet/50 transition-all"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            name="password"
                            placeholder="Contraseña"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-adhoc-violet/30 focus:border-adhoc-violet/50 transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-6 py-3 bg-adhoc-violet text-white font-medium rounded-xl hover:bg-adhoc-violet/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-adhoc-violet/50 transition-all shadow-sm"
                    >
                        Iniciar sesión
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-gray-50 text-gray-400">o continuar con</span>
                    </div>
                </div>

                {/* Google button */}
                <form action={handleGoogleLogin}>
                    <button
                        type="submit"
                        className="w-full flex justify-center items-center gap-3 px-6 py-3 bg-white border border-gray-200 text-base font-medium rounded-xl text-gray-700 hover:bg-gray-50 hover:border-adhoc-violet/30 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-adhoc-violet/30 transition-all shadow-sm"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google
                    </button>
                </form>

                {/* Footer discreto */}
                <p className="mt-10 text-center text-xs text-gray-400">
                    Acceso restringido a usuarios autorizados
                </p>

                {/* Powered by Adhoc */}
                <div className="mt-4 text-center">
                    <span className="text-[10px] text-gray-300 uppercase tracking-widest">
                        Powered by Adhoc
                    </span>
                </div>
            </div>
        </div>
    )
}
