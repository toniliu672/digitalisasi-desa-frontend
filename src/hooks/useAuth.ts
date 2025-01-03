// src/hooks/useAuth.ts
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@/api/authApi'

export function useAuth(requireAdmin: boolean = false) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const userDataString = localStorage.getItem('userData')
    if (userDataString) {
      try {
        const userData: User = JSON.parse(userDataString)
        setUser(userData)
        if (requireAdmin && userData.role !== 'ADMIN') {
          router.push('/unauthorized')
        }
      } catch (error) {
        console.error('Error parsing user data:', error)
        localStorage.removeItem('userData')
        router.push('/login')
      }
    } else if (requireAdmin) {
      router.push('/login')
    }
    setLoading(false)
  }, [router, requireAdmin])

  return { user, loading }
}