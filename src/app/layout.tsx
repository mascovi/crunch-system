import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

export const metadata: Metadata = {
  title: 'Crunch Online - Hub Operacional',
  description: 'Central operacional de recebimento, estoque e FULL',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-br">
      <body className="bg-crunch-bg text-crunch-ink min-h-screen">
        <AuthProvider>
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  )
}
