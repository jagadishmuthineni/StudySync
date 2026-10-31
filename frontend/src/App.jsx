
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [subjectName, setSubjectName] = useState('')

  useEffect(() => {
    if (loggedInUser) {
      loadSubjects()
    }
  }, [loggedInUser])

  async function loadSubjects() {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/subjects/${loggedInUser.id}`
      )
      const data = await response.json()
      setSubjects(data)
    } catch (error) {
      console.error('Unable to load subjects:', error)
    }
  }

  async function addSubject(event) {
    event.preventDefault()

    if (!subjectName.trim()) return

    try {
      const response = await fetch('http://127.0.0.1:5000/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: loggedInUser.id,
          subject_name: subjectName
        })
      })

      const result = await response.json()
      setMessage(result.message)

      if (response.ok) {
        setSubjectName('')
        loadSubjects()
      }
    } catch (error) {
      setMessage('Unable to add subject.')
    }
  }

  async function deleteSubject(subjectId) {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/subjects/${subjectId}`,
        { method: 'DELETE' }
      )

      const result = await response.json()
      setMessage(result.message)

      if (response.ok) {
        loadSubjects()
      }
    } catch (error) {
      setMessage('Unable to delete subject.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('Please wait...')

    const endpoint = isLogin ? 'login' : 'register'

    const userData = isLogin
      ? { email, password }
      : { name, email, password }

    try {
      const response = await fetch(`http://127.0.0.1:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })

      const result = await response.json()
      setMessage(result.message)

      if (response.ok && isLogin) {
        setLoggedInUser(result.user)
      }
    } catch (error) {
      setMessage('Unable to connect to the server.')
    }
  }

  if (loggedInUser) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <h2>StudySync</h2>
          <nav>
            <p>Dashboard</p>
            <p>My Subjects</p>
            <p>My Tasks</p>
            <p>Progress</p>
          </nav>

          <button onClick={() => {
            setLoggedInUser(null)
            setSubjects([])
            setMessage('')
          }}>
            Logout
          </button>
        </aside>

        <main className="main-content">
          <h1>Welcome, {loggedInUser.name}!</h1>
          <p>Here's an overview of your study activities.</p>

          <div className="dashboard-cards">
            <div className="dashboard-card">
              <h3>My Subjects</h3>
              <h2>{subjects.length}</h2>
              <p>Subjects added</p>
            </div>

            <div className="dashboard-card">
              <h3>Total Tasks</h3>
              <h2>0</h2>
              <p>Tasks created</p>
            </div>

            <div className="dashboard-card">
              <h3>Completed Tasks</h3>
              <h2>0</h2>
              <p>Tasks completed</p>
            </div>
          </div>

          <section className="dashboard-section">
            <h2>My Subjects</h2>

            <form onSubmit={addSubject}>
              <input
                type="text"
                placeholder="Enter subject name"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
              <button type="submit">Add Subject</button>
            </form>

            <p>{message}</p>

            {subjects.length === 0 ? (
              <p>No subjects added yet.</p>
            ) : (
              <ul>
                {subjects.map((subject) => (
                  <li key={subject.subject_id}>
                    {subject.subject_name}
                    <button
                      onClick={() => deleteSubject(subject.subject_id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-section">
            <h2>Upcoming Tasks</h2>
            <p>Your upcoming assignments and deadlines will appear here.</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="auth-card">
        <h1>StudySync</h1>
        <p className="subtitle">
          Organize your studies. Achieve your goals.
        </p>

        <h2>{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <p>{message}</p>

        <p className="switch">
          {isLogin
            ? "Don't have an account?"
            : 'Already have an account?'}

          <span onClick={() => {
            setIsLogin(!isLogin)
            setMessage('')
          }}>
            {isLogin ? ' Register' : ' Login'}
          </span>
        </p>
      </div>
    </div>
  )
}

export default App
