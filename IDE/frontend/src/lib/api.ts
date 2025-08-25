export type FileNode = {
  type: 'folder' | 'file'
  name: string
  path: string
  children?: FileNode[]
}

// Frontend-only file storage for system files
class LocalFileStore {
  private files: Map<string, string> = new Map()
  private listeners: Set<() => void> = new Set()

  addFile(path: string, content: string): void {
    this.files.set(path, content)
    this.notifyListeners()
  }

  addFiles(entries: Array<{ path: string; content: string }>): void {
    for (const { path, content } of entries) {
      this.files.set(path, content)
    }
    this.notifyListeners()
  }

  getFile(path: string): string | undefined {
    return this.files.get(path)
  }

  getAllFiles(): Array<{ path: string; content: string }> {
    return Array.from(this.files.entries()).map(([path, content]) => ({ path, content }))
  }

  deleteFile(path: string): void {
    this.files.delete(path)
    this.notifyListeners()
  }

  addListener(callback: () => void): void {
    this.listeners.add(callback)
  }

  removeListener(callback: () => void): void {
    this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback())
  }

  // Convert to FileNode tree structure
  toFileTree(): FileNode {
    const files = this.getAllFiles()
    
    if (files.length === 0) {
      return {
        type: 'folder',
        name: 'workspace',
        path: '',
        children: []
      }
    }

    const children: FileNode[] = files.map(({ path }) => ({
      type: 'file',
      name: path,
      path: path
    }))

    return {
      type: 'folder',
      name: 'workspace',
      path: '',
      children
    }
  }
}

export const localFileStore = new LocalFileStore()

export function addLocalFile(path: string, content: string): void {
  localFileStore.addFile(path, content)
}

export function addLocalFiles(entries: Array<{ path: string; content: string }>): void {
  localFileStore.addFiles(entries)
}

export function renameLocalFile(oldPath: string, newPath: string): boolean {
  const content = localFileStore.getFile(oldPath)
  if (content === undefined) return false
  localFileStore.deleteFile(oldPath)
  localFileStore.addFile(newPath, content)
  return true
}

export function deleteLocalFile(path: string): boolean {
  const content = localFileStore.getFile(path)
  if (content === undefined) return false
  localFileStore.deleteFile(path)
  return true
}

export async function listFiles(): Promise<FileNode> {
  try {
    // Try to get backend files
    const response = await fetch('http://localhost:8000/files')
    if (response.ok) {
      const backendFiles = await response.json()
      
      // Combine with local files
      const localFiles = localFileStore.toFileTree()
      
      // Merge the children arrays
      const allChildren = [
        ...(backendFiles.children || []),
        ...(localFiles.children || [])
      ]
      
      return {
        type: 'folder',
        name: 'workspace',
        path: '',
        children: allChildren
      }
    }
  } catch (error) {
    console.log('Backend not available, using local files only')
  }
  
  // Fallback to local files only
  return localFileStore.toFileTree()
}

export async function openFile(path: string): Promise<{ path: string; content: string }> {
  // Check local files first
  const localContent = localFileStore.getFile(path)
  if (localContent !== undefined) {
    return { path, content: localContent }
  }
  
  // Try backend if not in local storage
  try {
    const response = await fetch('http://localhost:8000/files/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    if (response.ok) {
      return response.json()
    }
  } catch (error) {
    console.log('Backend not available for file:', path)
  }
  
  throw new Error(`File not found: ${path}`)
}

export async function saveFile(path: string, content: string): Promise<void> {
  const response = await fetch('http://localhost:8000/files/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content })
  })
  if (!response.ok) throw new Error('Failed to save file')
}

export async function uploadFiles(files: FileList | File[]): Promise<void> {
  const formData = new FormData()
  Array.from(files).forEach(file => formData.append('files', file))
  
  const response = await fetch('http://localhost:8000/files/upload', {
    method: 'POST',
    body: formData
  })
  if (!response.ok) throw new Error('Failed to upload files')
}

export async function runCode(language: string, code: string): Promise<{ stdout: string; stderr: string }> {
  const response = await fetch('http://localhost:8000/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code })
  })
  if (!response.ok) throw new Error('Failed to run code')
  return response.json()
}

export async function runPythonCode(code: string, stdin?: string, timeout?: number): Promise<{ stdout: string; stderr: string }> {
  const response = await fetch('http://localhost:8000/run/python', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, stdin, timeout })
  })
  if (!response.ok) throw new Error('Failed to run Python code')
  return response.json()
}

export function connectPythonTerminal(onMessage: (data: string) => void, onOpen: () => void, onClose: () => void): WebSocket {
  const ws = new WebSocket('ws://localhost:8000/ws/python')
  ws.onopen = onOpen
  ws.onmessage = (event) => onMessage(event.data)
  ws.onclose = onClose
  ws.onerror = (error) => console.error('WebSocket error:', error)
  return ws
}

// Terminal-specific functions
export async function runPython(code: string, stdin?: string, timeout?: number): Promise<{ stdout: string; stderr: string }> {
  return runPythonCode(code, stdin, timeout)
}

export function openPythonSocket(): WebSocket {
  return new WebSocket('ws://localhost:8000/ws/python')
}

