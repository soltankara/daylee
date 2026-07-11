// File System Access API pieces missing from TypeScript's built-in DOM lib
// (which already ships FileSystemDirectoryHandle, createWritable, removeEntry).

type FileSystemPermissionMode = 'read' | 'readwrite'

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string
    mode?: FileSystemPermissionMode
    startIn?: 'desktop' | 'documents' | 'downloads' | 'home' | 'music' | 'pictures' | 'videos'
  }): Promise<FileSystemDirectoryHandle>
}
