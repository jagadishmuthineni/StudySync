
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let csrfToken = null

async function getCsrfToken() {
  const response = await fetch(`${API_URL}/csrf-token`, {
    method: 'GET',
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error('Unable to get security token.')
  }

  const data = await response.json()
  csrfToken = data.csrf_token

  return csrfToken
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()

  const headers = {
    ...options.headers
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!csrfToken) {
      await getCsrfToken()
    }

    headers['X-CSRF-Token'] = csrfToken
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include'
  })

  if (path === '/login' && response.ok) {
    const data = await response.clone().json()
    csrfToken = data.csrf_token
  }

  if (path === '/logout' && response.ok) {
    csrfToken = null
  }

  return response
}

export async function getCurrentUser() {
  const response = await apiRequest('/me')

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.user
}
