'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !usuario && pathname !== '/login') {
      router.replace('/login')
    }
  }, [usuario, loading, pathname, router])

  // Página de login não precisa de proteção
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Carregando sessão
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl overflow-hidden animate-pulse">
            <img src="/crunch-logo.png" alt="" className="w-full h-full object-contain" />
          </div>
          <p className="text-crunch-ink-mute text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  // Não autenticado
  if (!usuario) {
    return null
  }

  return <>{children}</>
}
