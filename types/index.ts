export interface User {
  id: string
  name: string | null
  email: string
  password: string
  emailVerified: Date | null
  image: string | null
  role: string
  createdAt: Date
  updatedAt: Date
  projects: Project[]
  managedProjects: Project[]
  tasks: RecordingTask[]
}

export interface Project {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  users: User[]
  managers: User[]
  tasks: RecordingTask[]
}

export interface Platform {
  id: string
  name: string
  description: string | null
  apiEndpoint?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
  tasks?: RecordingTask[]
}

export interface RecordingTask {
  id: string
  name: string
  description: string | null
  status: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
  streamUrls: string
  platformParams?: string
  userId: string
  projectId: string
  platformId: string
  user: User
  project?: Project
  platform: Platform
  logs: TaskLog[]
}

export interface TaskLog {
  id: string
  message: string
  level: string
  createdAt: Date
  taskId: string
  task: RecordingTask
}

