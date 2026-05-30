'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

interface Usuario {
  id: string
  nome: string
}

interface AuthContextType {
  usuario: Usuario | null
  loading: boolean
  login: (usuario: Usuario) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  loading: true,
  login: () => {},
  logout: () => {},
})

const STORAGE_KEY = 'crunch_usuario'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setUsuario(JSON.parse(stored))
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback((user: Usuario) => {
    setUsuario(user)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }, [])

  const logout = useCallback(() => {
    setUsuario(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
