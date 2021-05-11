import axios from 'axios'
import { Magic } from 'magic-sdk'

export const api = axios.create()

// eslint-disable-next-line import/no-mutable-exports
export let magic: Magic | null = null

export async function initAPI() {
  const {
    data: { csrf, magic: m }
  } = await api.get('/api/settings')

  api.defaults.headers = api.defaults.headers || {}
  api.defaults.headers['CSRF-Token'] = csrf

  let isAuth = true

  if (m) {
    magic = new Magic(m)

    isAuth = await magic.user
      .getIdToken()
      .then((token) => {
        api.defaults.headers.Authorization = `Bearer ${token}`
        return true
      })
      .catch(() => {
        delete api.defaults.headers.Authorization
        return false
      })
  }

  return isAuth
}
