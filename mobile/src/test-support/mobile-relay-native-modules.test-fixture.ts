import { vi } from 'vitest'

vi.mock('expo-crypto', async () => import('./expo-crypto-node'))
vi.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: async (key: string) => {
        values.delete(key)
      }
    }
  }
})
