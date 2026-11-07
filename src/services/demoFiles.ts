// Files the demo backend keeps, e.g. feedback screenshots. localStorage is too small for images, so they go
// in IndexedDB when the browser has it, and only in memory (until reload) when it doesn't.

const DB_NAME = 'careride-demo-files'
const STORE = 'files'
const memory = new Map<string, Blob>()

function openDb(): Promise<IDBDatabase> | undefined {
  if (typeof indexedDB === 'undefined') return undefined
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function putDemoFile(path: string, file: Blob): Promise<void> {
  memory.set(path, file)
  try {
    const db = await openDb()
    if (!db) return
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file, path)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Kept in memory for this visit only
  }
}

export async function getDemoFile(path: string): Promise<Blob | undefined> {
  const kept = memory.get(path)
  if (kept) return kept
  try {
    const db = await openDb()
    if (!db) return undefined
    const file = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(path)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return file
  } catch {
    return undefined
  }
}

export async function deleteDemoFile(path: string): Promise<void> {
  memory.delete(path)
  try {
    const db = await openDb()
    if (!db) return
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(path)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Nothing kept to delete
  }
}
