import { useState, useEffect } from 'react'
import { Folder, File, ChevronRight, ChevronDown, Upload, FolderOpen, FileText, RotateCcw, FolderPlus } from 'lucide-react'
import { listFiles, openFile, localFileStore, renameLocalFile, deleteLocalFile } from '../lib/api'

export type FileNode = {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  expanded?: boolean
}

export function Explorer({ onOpen, onOpenSystem }: { onOpen: (path: string, content?: string) => void, onOpenSystem: () => void }) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)

  // Load files from workspace and subscribe to local store changes
  useEffect(() => {
    loadWorkspaceFiles()
    const listener = () => loadWorkspaceFiles()
    localFileStore.addListener(listener)
    return () => localFileStore.removeListener(listener)
  }, [])

  async function loadWorkspaceFiles() {
    try {
      setLoading(true)
      const workspaceFiles = await listFiles()
      // listFiles returns a single FileNode, extract children or use empty array
      setFiles(workspaceFiles?.children || [])
    } catch (error) {
      console.error('Failed to load workspace files:', error)
      setFiles([]) // Start with empty state
    } finally {
      setLoading(false)
    }
  }

  // Open file picker for single file
  async function openFilePicker() {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Code Files',
              accept: {
                'text/x-python': ['.py'],
                'text/javascript': ['.js', '.ts'],
                'text/x-c': ['.c', '.cpp', '.h', '.hpp'],
                'text/x-java-source': ['.java'],
                'text/html': ['.html', '.htm'],
                'text/css': ['.css'],
                'application/json': ['.json'],
                'text/plain': ['.txt', '.md']
              }
            }
          ]
        })
        
        const file = await fileHandle.getFile()
        const content = await file.text()
        // persist into local workspace and open
        localFileStore.addFile(file.name, content)
        onOpen(file.name, content)
      } else {
        // Fallback for browsers without File System Access API
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.py,.js,.ts,.c,.cpp,.h,.hpp,.java,.html,.css,.json,.txt,.md'
        input.onchange = async (e) => {
          const target = e.target as HTMLInputElement
          if (target.files && target.files[0]) {
            const file = target.files[0]
            const content = await file.text()
            localFileStore.addFile(file.name, content)
            onOpen(file.name, content)
          }
        }
        input.click()
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error opening file:', error)
        alert('Failed to open file. Please try again.')
      }
    }
  }

  // Open folder picker
  async function openFolderPicker() {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker()
        
        // Recursively read directory contents
        const folderContents = await readDirectoryRecursively(dirHandle)
        setFiles(folderContents)
        
        // Persist all files into local store
        const filesOnly: Array<{ path: string; content: string }> = []
        for (const node of flatten(folderContents)) {
          if (node.type === 'file') {
            try {
              const fileHandle = await dirHandle.getFileHandle(node.name)
              const file = await fileHandle.getFile()
              const content = await file.text()
              filesOnly.push({ path: node.path, content })
            } catch {
              // ignore
            }
          }
        }
        if (filesOnly.length) localFileStore.addFiles(filesOnly)
        
        // Open the first file automatically
        const first = filesOnly[0]
        if (first) onOpen(first.path, first.content)
      } else {
        // Fallback for browsers without File System Access API
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true
        input.multiple = true
        input.onchange = async (e) => {
          const target = e.target as HTMLInputElement
          if (target.files) {
            const fileList = Array.from(target.files)
            const folderStructure = buildFolderStructure(fileList)
            setFiles(folderStructure)
            
            const entries: Array<{ path: string; content: string }> = []
            for (const f of fileList) {
              try {
                const content = await f.text()
                entries.push({ path: f.webkitRelativePath || f.name, content })
              } catch {}
            }
            if (entries.length) localFileStore.addFiles(entries)
            const first = entries[0]
            if (first) onOpen(first.path, first.content)
          }
        }
        input.click()
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error opening folder:', error)
        alert('Failed to open folder. Please try again.')
      }
    }
  }

  // Recursively read directory contents
  async function readDirectoryRecursively(dirHandle: any, parentPath = ''): Promise<FileNode[]> {
    const nodes: FileNode[] = []
    
    for await (const [name, handle] of dirHandle.entries()) {
      const path = parentPath ? `${parentPath}/${name}` : name
      
      if (handle.kind === 'directory') {
        const children = await readDirectoryRecursively(handle, path)
        nodes.push({
          name,
          path,
          type: 'folder',
          children,
          expanded: false
        })
      } else {
        nodes.push({
          name,
          path,
          type: 'file'
        })
      }
    }
    
    return nodes.sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  function flatten(nodes: FileNode[]): FileNode[] {
    const out: FileNode[] = []
    for (const n of nodes) {
      out.push(n)
      if (n.children) out.push(...flatten(n.children))
    }
    return out
  }

  // Build folder structure from FileList (fallback)
  function buildFolderStructure(fileList: File[]): FileNode[] {
    const structure: { [key: string]: FileNode } = {}
    
    fileList.forEach(file => {
      const pathParts = (file.webkitRelativePath || file.name).split('/')
      let currentPath = ''
      
      pathParts.forEach((part, index) => {
        const isLast = index === pathParts.length - 1
        const fullPath = currentPath ? `${currentPath}/${part}` : part
        
        if (!structure[fullPath]) {
          structure[fullPath] = {
            name: part,
            path: fullPath,
            type: isLast ? 'file' : 'folder',
            children: isLast ? undefined : [],
            expanded: false
          }
        }
        
        if (!isLast && structure[currentPath]) {
          if (!structure[currentPath].children) {
            structure[currentPath].children = []
          }
          structure[currentPath].children!.push(structure[fullPath])
        }
        
        currentPath = fullPath
      })
    })
    
    // Return only root level items
    return Object.values(structure).filter(node => 
      !node.path.includes('/')
    ).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  // Toggle folder expansion
  function toggleFolder(node: FileNode) {
    if (node.type === 'folder') {
      node.expanded = !node.expanded
      setFiles([...files]) // Trigger re-render
    }
  }

  // Handle file/folder click
  function handleNodeClick(node: FileNode) {
    if (node.type === 'folder') {
      toggleFolder(node)
    } else {
      // For files, try to open them from workspace first
      openFileFromWorkspace(node.path)
    }
  }

  // Open file from workspace
  async function openFileFromWorkspace(path: string) {
    try {
      const fileData = await openFile(path)
      onOpen(path, fileData.content)
    } catch (error) {
      console.warn(`Could not open ${path} from workspace:`, error)
      // File might not exist in workspace, that's okay
    }
  }

  // Refresh workspace
  function refreshWorkspace() {
    loadWorkspaceFiles()
  }

  return (
    <div className="h-full flex flex-col" onContextMenu={(e) => e.preventDefault()} onClick={() => setMenu(null)}>
      {/* Explorer Header */}
      <div className="explorer-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--muted)]">EXPLORER</span>
          <button
            onClick={refreshWorkspace}
            className="p-1 text-[var(--muted)] hover:text-[var(--text)] transition-fast"
            title="Refresh"
          >
            <RotateCcw size={14} />
          </button>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={openFilePicker}
            className="vscode-button"
            title="Open File"
          >
            <FileText size={14} />
            File
          </button>
          <button
            onClick={openFolderPicker}
            className="vscode-button"
            title="Open Folder"
          >
            <FolderOpen size={14} />
            Folder
          </button>
          <button
            onClick={() => {
              const name = prompt('New file name (e.g., main.py):', 'untitled.py') || 'untitled.py'
              localFileStore.addFile(name, '')
              onOpen(name, '')
            }}
            className="vscode-button"
            title="New File"
          >
            + New
          </button>
          <button
            onClick={() => {
              const name = prompt('New folder name:', 'folder') || 'folder'
              // Represent folder by adding a placeholder child entry to local store tree
              localFileStore.addFile(`${name}/.placeholder`, '')
              loadWorkspaceFiles()
            }}
            className="vscode-button"
            title="New Folder"
          >
            <FolderPlus size={14} />
            New Folder
          </button>
          <button
            onClick={onOpenSystem}
            className="vscode-button"
            title="Open System Files"
          >
            <Upload size={14} />
            System
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="file-tree flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-center text-[var(--muted)]">
            Loading workspace...
          </div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-[var(--muted)]">
            <Folder size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">No files opened</p>
            <p className="text-xs mt-1">Use the buttons above to open files or folders</p>
          </div>
        ) : (
          <div className="p-2">
            {files.map(node => (
              <Node 
                key={node.path} 
                node={node} 
                onToggle={toggleFolder}
                onClick={handleNodeClick}
                level={0}
              />
            ))}
          </div>
        )}
      </div>

      {menu && menu.node.type === 'file' && (
        <div className="absolute z-50 bg-[var(--panel)] border border-[var(--gutter)] rounded shadow" style={{ left: menu.x, top: menu.y }}>
          <button className="block w-full text-left px-3 py-2 hover:bg-[var(--gutter)]" onClick={async () => { await openFileFromWorkspace(menu.node.path); setMenu(null) }}>Open</button>
          <button className="block w-full text-left px-3 py-2 hover:bg-[var(--gutter)]" onClick={() => { const np = prompt('Rename file to:', menu.node.name); if (np && renameLocalFile(menu.node.path, np)) loadWorkspaceFiles(); setMenu(null) }}>Rename</button>
          <button className="block w-full text-left px-3 py-2 hover:bg-[var(--gutter)] text-[var(--error)]" onClick={() => { if (confirm('Delete file?')) { deleteLocalFile(menu.node.path); loadWorkspaceFiles(); } setMenu(null) }}>Delete</button>
        </div>
      )}
    </div>
  )
}

// Recursive Node component
function Node({ 
  node, 
  onToggle, 
  onClick, 
  level 
}: { 
  node: FileNode
  onToggle: (node: FileNode) => void
  onClick: (node: FileNode) => void
  level: number
}) {
  const isFolder = node.type === 'folder'
  const hasChildren = isFolder && node.children && node.children.length > 0
  const isExpanded = isFolder && node.expanded

  const fileEmoji = (name: string) => {
    const n = name.toLowerCase()
    if (n.endsWith('.py')) return '🐍'
    if (n.endsWith('.js')) return '🟨'
    if (n.endsWith('.ts')) return '🟦'
    if (n.endsWith('.jsx') || n.endsWith('.tsx')) return '⚛️'
    if (n.endsWith('.html')) return '🌐'
    if (n.endsWith('.css') || n.endsWith('.scss') || n.endsWith('.sass')) return '🎨'
    if (n.endsWith('.json')) return '🧾'
    if (n.endsWith('.md')) return '📝'
    if (n.endsWith('.c')) return '🔧'
    if (n.endsWith('.cpp') || n.endsWith('.cc') || n.endsWith('.cxx')) return '🧩'
    if (n.endsWith('.h') || n.endsWith('.hpp')) return '📘'
    if (n.endsWith('.java')) return '☕'
    if (n.endsWith('.go')) return '🐹'
    if (n.endsWith('.rs')) return '🦀'
    if (n.endsWith('.php')) return '🐘'
    if (n.endsWith('.rb')) return '💎'
    if (n.endsWith('.sql')) return '🗄️'
    return '📄'
  }

  return (
    <div>
      <div 
        className={`file-item ${isFolder ? 'folder' : 'file'}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onClick(node)}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, node }) }}
      >
        {isFolder && (
          <span className="file-icon">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        <span className="file-icon">
          {isFolder ? <Folder size={14} /> : <span>{fileEmoji(node.name)}</span>}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      
      {isFolder && isExpanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <Node
              key={child.path}
              node={child}
              onToggle={onToggle}
              onClick={onClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
