export type Platform = {
  id: string
  name: string
  description: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  managers?: User[]
  users?: User[]
}

export type User = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: string
  updatedAt: string
}

export type TaskLog = {
  id: string
  message: string
  level: string
  createdAt: string
  taskId: string
}

export type RecordingTask = {
  id: string
  name: string
  description: string | null
  status: string
  enabled: boolean
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
  streamUrls: string
  platformParams: string | null
  userId: string
  projectId: string
  platformId: string
  platform?: Platform
  project?: Project
  user?: User
  logs?: TaskLog[]
}

export type RecordingPeriod = {
  id: string
  taskId: string
  startedAt: string
  endedAt: string
  createdAt: string
  updatedAt: string
  streamUrls?: string | null
  platformParams?: string | null
  workerData?: string | null
} 