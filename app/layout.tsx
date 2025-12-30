import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const newKansas = localFont({
    src: [
        { path: '../public/fonts/fonnts.com-New-Kansas-Light.otf', weight: '300', style: 'normal' },
        { path: '../public/fonts/fonnts.com-New-Kansas-.otf', weight: '400', style: 'normal' },
        { path: '../public/fonts/fonnts.com-New-Kansas-Medium.otf', weight: '500', style: 'normal' },
        { path: '../public/fonts/fonnts.com-New-Kansas-Semi-Bold.otf', weight: '600', style: 'normal' },
        { path: '../public/fonts/fonnts.com-New-Kansas-Bold.otf', weight: '700', style: 'normal' },
        { path: '../public/fonts/fonnts.com-New-Kansas-Heavy.otf', weight: '800', style: 'normal' },
        { path: '../public/fonts/fonnts.com-New-Kansas-Black.otf', weight: '900', style: 'normal' },
    ],
    variable: '--font-new-kansas',
    display: 'swap',
})

const apercu = localFont({
    src: [
        { path: '../public/fonts/apercu_regular_pro.otf', weight: '400', style: 'normal' },
        { path: '../public/fonts/apercu_regular_italic_pro.otf', weight: '400', style: 'italic' },
        { path: '../public/fonts/apercu_medium_pro.otf', weight: '500', style: 'normal' },
        { path: '../public/fonts/apercu_medium_italic_pro.otf', weight: '500', style: 'italic' },
        { path: '../public/fonts/apercu_bold_pro.otf', weight: '700', style: 'normal' },
        { path: '../public/fonts/apercu_bold_italic_pro.otf', weight: '700', style: 'italic' },
    ],
    variable: '--font-apercu',
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'Tuqui Agents Alpha',
    description: 'AI Agents Platform',
    icons: {
        icon: '/favicon.png',
        shortcut: '/favicon.png',
        apple: '/favicon.png',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
            <body className={`${newKansas.variable} ${apercu.variable} font-sans antialiased`} suppressHydrationWarning>{children}</body>
        </html>
    )
}
