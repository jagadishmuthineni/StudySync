
import { useState, useEffect, useRef } from 'react'
import './App.css'
import { apiRequest, getCurrentUser } from './api'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [subjectMessage, setSubjectMessage] = useState('')
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [subjects, setSubjects] = useState([])
  const [subjectName, setSubjectName] = useState('')

  const [tasks, setTasks] = useState([])
  const [taskName, setTaskName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')

  const [taskFilter, setTaskFilter] = useState('All')

  const dashboardRef = useRef(null)
  const subjectsRef = useRef(null)
  const tasksRef = useRef(null)
  const progressRef = useRef(null)

  function scrollToSection(sectionRef) {
    sectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  // Restore the login session when the page opens or refreshes.
  useEffect(() => {
    async function restoreSession() {
      try {
        const user = await getCurrentUser()
        setLoggedInUser(user)
      } catch (error) {
        console.error('Unable to restore session:', error)
      } finally {
        setCheckingSession(false)
      }
    }

    restoreSession()
  }, [])

  // Load subjects and tasks after login.
  useEffect(() => {
    if (loggedInUser) {
      loadSubjects()
      loadTasks()
    }
  }, [loggedInUser])

  async function loadSubjects() {
    try {
      const response = await apiRequest(
        `/subjects/${loggedInUser.id}`
      )

      const data = await response.json()

      if (response.ok) {
        setSubjects(data)
      } else {
        setMessage(data.message || 'Unable to load subjects.')
      }
    } catch (error) {
      console.error('Unable to load subjects:', error)
      setMessage('Unable to load subjects.')
    }
  }

  async function loadTasks() {
    try {
      const response = await apiRequest(
        `/tasks/${loggedInUser.id}`
      )

      const data = await response.json()

      if (response.ok) {
        setTasks(data)
      } else {
        setMessage(data.message || 'Unable to load tasks.')
      }
    } catch (error) {
      console.error('Unable to load tasks:', error)
      setMessage('Unable to load tasks.')
    }
  }

  // Add a subject and show its message below the subject form.
  async function addSubject(event) {
    event.preventDefault()
    setSubjectMessage('')

    if (!subjectName.trim()) {
      setSubjectMessage('Please enter a subject name.')
      return
    }

    try {
      const response = await apiRequest('/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_name: subjectName
        })
      })

      const result = await response.json()
      setSubjectMessage(result.message)

      if (response.ok) {
        setSubjectName('')
        loadSubjects()
      }
    } catch (error) {
      setSubjectMessage('Unable to add subject. Please try again.')
    }
  }

  async function deleteSubject(subjectId) {
    try {
      const response = await apiRequest(
        `/subjects/${subjectId}`,
        { method: 'DELETE' }
      )

      const result = await response.json()
      setSubjectMessage(result.message)

      if (response.ok) {
        loadSubjects()
        loadTasks()
      }
    } catch (error) {
      setSubjectMessage('Unable to delete subject.')
    }
  }

  async function addTask(event) {
    event.preventDefault()

    if (!taskName.trim() || !deadline || !selectedSubject) {
      setMessage('Please fill in all task details.')
      return
    }

    try {
      const response = await apiRequest('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: Number(selectedSubject),
          task_name: taskName,
          deadline: deadline
        })
      })

      const result = await response.json()
      setMessage(result.message)

      if (response.ok) {
        setTaskName('')
        setDeadline('')
        setSelectedSubject('')
        loadTasks()
      }
    } catch (error) {
      setMessage('Unable to add task.')
    }
  }

  async function updateTask(taskId, completed) {
    try {
      const response = await apiRequest(
        `/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completed: completed
          })
        }
      )

      const result = await response.json()
      setMessage(result.message)

      if (response.ok) {
        loadTasks()
      }
    } catch (error) {
      setMessage('Unable to update task.')
    }
  }

  async function deleteTask(taskId) {
    try {
      const response = await apiRequest(
        `/tasks/${taskId}`,
        { method: 'DELETE' }
      )

      const result = await response.json()
      setMessage(result.message)

      if (response.ok) {
        loadTasks()
      }
    } catch (error) {
      setMessage('Unable to delete task.')
    }
  }

  async function handleLogout() {
    try {
      const response = await apiRequest('/logout', {
        method: 'POST'
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result.message || 'Unable to log out.')
        return
      }

      setMessage('')
      setSubjectMessage('')
      setLoggedInUser(null)
      setSubjects([])
      setTasks([])
      setTaskFilter('All')
    } catch (error) {
      setMessage('Unable to connect to the server.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('Please wait...')

    const endpoint = isLogin ? '/login' : '/register'

    const userData = isLogin
      ? { email, password }
      : { name, email, password }

    try {
      const response = await apiRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })

      const result = await response.json()
      setMessage(result.message)

      if (response.ok && isLogin) {
        setLoggedInUser(result.user)
        setPassword('')
      }

      if (response.ok && !isLogin) {
        setIsLogin(true)
        setName('')
        setPassword('')
      }
    } catch (error) {
      setMessage('Unable to connect to the server.')
    }
  }

  // Progress calculations
  const completedTasks = tasks.filter(
    (task) => Number(task.completed) === 1
  ).length

  const pendingTasks = tasks.length - completedTasks

  const progressPercentage = tasks.length > 0
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === 'Completed') {
      return Number(task.completed) === 1
    }

    if (taskFilter === 'Pending') {
      return Number(task.completed) === 0
    }

    return true
  })

  // Subject-wise progress
  const subjectProgress = subjects.map((subject) => {
    const subjectTasks = tasks.filter(
      (task) => Number(task.subject_id) === Number(subject.subject_id)
    )

    const subjectCompleted = subjectTasks.filter(
      (task) => Number(task.completed) === 1
    ).length

    const percentage = subjectTasks.length > 0
      ? Math.round((subjectCompleted / subjectTasks.length) * 100)
      : 0

    return {
      ...subject,
      total: subjectTasks.length,
      completed: subjectCompleted,
      percentage
    }
  })

  // Tasks due within the next 7 days
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  const upcomingTasks = tasks.filter((task) => {
    if (Number(task.completed) === 1) return false

    const dueDate = new Date(`${task.deadline}T00:00:00`)

    return dueDate >= today && dueDate <= nextWeek
  })

  // Automatic progress message
  let progressMessage = 'Start adding tasks to track your study progress!'

  if (tasks.length > 0) {
    if (progressPercentage === 100) {
      progressMessage = 'Excellent! You have completed all your tasks!'
    } else if (progressPercentage >= 75) {
      progressMessage = 'Great work! You are almost done. Keep going!'
    } else if (progressPercentage >= 40) {
      progressMessage = 'Good progress! Keep working towards your goals.'
    } else {
      progressMessage = 'Keep going! Every completed task is progress.'
    }
  }

  // Show loading while restoring the login session.
  if (checkingSession) {
    return (
      <div className="container">
        <div className="auth-card">
          <h2>Loading StudySync...</h2>
        </div>
      </div>
    )
  }

  if (loggedInUser) {
    return (
      <div className="dashboard">
        <aside className="sidebar">
          <h2>StudySync</h2>

          <nav>
            <button
              type="button"
              onClick={() => scrollToSection(dashboardRef)}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => scrollToSection(subjectsRef)}
            >
              My Subjects
            </button>

            <button
              type="button"
              onClick={() => scrollToSection(tasksRef)}
            >
              My Tasks
            </button>

            <button
              type="button"
              onClick={() => scrollToSection(progressRef)}
            >
              Progress
            </button>
          </nav>

          <button onClick={handleLogout}>
            Logout
          </button>
        </aside>

        <main className="main-content">

          {/* Dashboard */}
          <section ref={dashboardRef} id="dashboard">
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
                <h2>{tasks.length}</h2>
                <p>Tasks created</p>
              </div>

              <div className="dashboard-card">
                <h3>Completed Tasks</h3>
                <h2>{completedTasks}</h2>
                <p>Tasks completed</p>
              </div>
            </div>
          </section>

          {/* My Subjects */}
          <section
            ref={subjectsRef}
            id="subjects"
            className="dashboard-section"
          >
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

            <p role="status" aria-live="polite">
              {subjectMessage}
            </p>

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

          {/* Add New Task */}
          <section className="dashboard-section">
            <h2>Add New Task</h2>

            {subjects.length === 0 ? (
              <p>Add a subject before creating a task.</p>
            ) : (
              <form onSubmit={addTask}>
                <input
                  type="text"
                  placeholder="Enter task name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  required
                />

                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />

                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  required
                >
                  <option value="">Select Subject</option>

                  {subjects.map((subject) => (
                    <option
                      key={subject.subject_id}
                      value={subject.subject_id}
                    >
                      {subject.subject_name}
                    </option>
                  ))}
                </select>

                <button type="submit">Add Task</button>
              </form>
            )}
          </section>

          {/* My Tasks */}
          <section
            ref={tasksRef}
            id="tasks"
            className="dashboard-section"
          >
            <h2>My Tasks</h2>

            <p>{message}</p>

            <div className="filter-buttons">
              {['All', 'Completed', 'Pending'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTaskFilter(filter)}
                  style={{
                    backgroundColor: taskFilter === filter
                      ? '#2563eb'
                      : '#e5e7eb',
                    color: taskFilter === filter ? 'white' : '#222'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <p>No {taskFilter.toLowerCase()} tasks found.</p>
            ) : (
              <ul>
                {filteredTasks.map((task) => (
                  <li key={task.task_id}>
                    <div>
                      <strong>{task.task_name}</strong>
                      <p>Subject: {task.subject_name}</p>
                      <p>Deadline: {task.deadline}</p>
                      <p>
                        Status: {Number(task.completed) === 1
                          ? 'Completed'
                          : 'Pending'}
                      </p>
                    </div>

                    <button
                      onClick={() => updateTask(
                        task.task_id,
                        Number(task.completed) === 1 ? 0 : 1
                      )}
                    >
                      {Number(task.completed) === 1
                        ? 'Mark Pending'
                        : 'Mark Completed'}
                    </button>

                    <button
                      onClick={() => deleteTask(task.task_id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Progress Dashboard */}
          <section
            ref={progressRef}
            id="progress"
            className="dashboard-section"
          >
            <h2>My Study Progress</h2>
            <p>Track your study performance and completion status.</p>

            <div className="dashboard-cards">
              <div className="dashboard-card">
                <h3>Total Tasks</h3>
                <h2>{tasks.length}</h2>
                <p>All tasks</p>
              </div>

              <div className="dashboard-card">
                <h3>Completed</h3>
                <h2>{completedTasks}</h2>
                <p>Finished tasks</p>
              </div>

              <div className="dashboard-card">
                <h3>Pending</h3>
                <h2>{pendingTasks}</h2>
                <p>Tasks remaining</p>
              </div>
            </div>

            <div className="progress-panel">
              <h3>Overall Completion</h3>
              <h2>{progressPercentage}%</h2>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <p>
                {completedTasks} out of {tasks.length} tasks completed.
              </p>
            </div>

            <div className="progress-panel">
              <h3>Subject-wise Progress</h3>

              {subjectProgress.length === 0 ? (
                <p>Add subjects to view your progress.</p>
              ) : (
                subjectProgress.map((subject) => (
                  <div className="subject-progress" key={subject.subject_id}>
                    <div className="subject-progress-heading">
                      <strong>{subject.subject_name}</strong>
                      <span>
                        {subject.completed}/{subject.total} completed
                      </span>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-fill subject-fill"
                        style={{ width: `${subject.percentage}%` }}
                      />
                    </div>

                    <p>{subject.percentage}% completed</p>
                  </div>
                ))
              )}
            </div>

            <div className="progress-panel">
              <h3>Upcoming Deadlines</h3>

              {upcomingTasks.length === 0 ? (
                <p>No pending tasks due in the next 7 days.</p>
              ) : (
                <ul>
                  {upcomingTasks.map((task) => (
                    <li key={task.task_id}>
                      <strong>{task.task_name}</strong>
                      <p>Subject: {task.subject_name}</p>
                      <p>Deadline: {task.deadline}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="progress-panel">
              <h3>Your Study Insights</h3>
              <p>{progressMessage}</p>

              <p>
                You have {pendingTasks} pending task(s) and{' '}
                {completedTasks} completed task(s).
              </p>
            </div>
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
