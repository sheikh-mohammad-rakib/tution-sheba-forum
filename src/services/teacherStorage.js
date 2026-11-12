const DB_NAME = 'TuitionSebaTeachersDB';
const DB_VERSION = 1;
const STORE_TEACHERS = 'teachers';
const STORE_META = 'metadata';

/**
 * Open (or create) the IndexedDB database
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_TEACHERS)) {
        db.createObjectStore(STORE_TEACHERS, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve cached teachers and sync metadata from IndexedDB
 */
export async function getCachedTeachers() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEACHERS, STORE_META], 'readonly');
      const teacherStore = tx.objectStore(STORE_TEACHERS);
      const metaStore = tx.objectStore(STORE_META);

      const teachersReq = teacherStore.getAll();
      const metaReq = metaStore.get('sync_info');

      tx.oncomplete = () => {
        const teachers = teachersReq.result || [];
        const meta = metaReq.result || null;
        resolve({
          teachers,
          lastUpdated: meta?.lastUpdated ? new Date(meta.lastUpdated) : null,
          total: teachers.length,
        });
      };

      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to get cached teachers from IndexedDB:', err);
    return { teachers: [], lastUpdated: null, total: 0 };
  }
}

/**
 * Save teachers array and update metadata in IndexedDB
 */
export async function saveTeachers(teachers) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TEACHERS, STORE_META], 'readwrite');
    const teacherStore = tx.objectStore(STORE_TEACHERS);
    const metaStore = tx.objectStore(STORE_META);

    teacherStore.clear();
    for (const teacher of teachers) {
      if (teacher && teacher._id) {
        teacherStore.put(teacher);
      }
    }

    metaStore.put({
      key: 'sync_info',
      lastUpdated: new Date().toISOString(),
      totalTeachers: teachers.length,
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let currentSyncAbortController = null;

/**
 * Abort any in-flight background sync operation immediately
 */
export function abortOngoingSync() {
  if (currentSyncAbortController) {
    try {
      currentSyncAbortController.abort();
    } catch {
      // ignore
    }
    currentSyncAbortController = null;
  }
}

/**
 * Clear the teachers cache completely
 */
export async function clearTeachersCache() {
  abortOngoingSync();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TEACHERS, STORE_META], 'readwrite');
    tx.objectStore(STORE_TEACHERS).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Fetch a single page from internal serverless proxy
 */
async function fetchTeacherPage(page, limit = 1000, signal) {
  const endpoint = `/.netlify/functions/teachers?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(endpoint, {
    credentials: 'include',
    signal,
  });

  if (res.status === 401) {
    throw new Error('Session expired or unauthorized. Please re-login.');
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Fetch all teachers across all pages in batches and save to IndexedDB
 * @param {Function} onProgress Callback: ({ loaded, total, percent, page, totalPages })
 * @param {AbortSignal} signal Optional AbortSignal
 */
export async function fetchAndSyncAllTeachers(onProgress = () => {}, signal) {
  abortOngoingSync();
  const controller = new AbortController();
  currentSyncAbortController = controller;

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const effectiveSignal = controller.signal;

  try {
    const limit = 1000;
    // 1. Fetch first page to learn total pages & total count
    const firstPageData = await fetchTeacherPage(1, limit, effectiveSignal);
    if (effectiveSignal.aborted) throw new Error('Sync aborted');

    const totalTeachers = firstPageData.totalTeachers || (firstPageData.teachers ? firstPageData.teachers.length : 0);
    const totalPages = firstPageData.totalPages || Math.ceil(totalTeachers / limit) || 1;

    let allTeachers = [...(firstPageData.teachers || [])];
    onProgress({
      loaded: allTeachers.length,
      total: totalTeachers,
      percent: Math.round((allTeachers.length / totalTeachers) * 100),
      page: 1,
      totalPages,
    });

    if (totalPages > 1) {
      const remainingPages = [];
      for (let p = 2; p <= totalPages; p++) {
        remainingPages.push(p);
      }

      // Process in concurrent pools of 3 to avoid throttling while staying fast
      const CONCURRENCY = 3;
      for (let i = 0; i < remainingPages.length; i += CONCURRENCY) {
        if (effectiveSignal.aborted) {
          throw new Error('Sync aborted');
        }
        const batchPages = remainingPages.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batchPages.map(page => fetchTeacherPage(page, limit, effectiveSignal))
        );

        if (effectiveSignal.aborted) {
          throw new Error('Sync aborted');
        }

        for (const pageData of results) {
          if (pageData.teachers && Array.isArray(pageData.teachers)) {
            allTeachers = allTeachers.concat(pageData.teachers);
          }
        }

        onProgress({
          loaded: Math.min(allTeachers.length, totalTeachers),
          total: totalTeachers,
          percent: Math.min(100, Math.round((allTeachers.length / totalTeachers) * 100)),
          page: Math.min(i + CONCURRENCY + 1, totalPages),
          totalPages,
        });
      }
    }

    if (effectiveSignal.aborted) {
      throw new Error('Sync aborted');
    }

    // Deduplicate by _id just in case
    const uniqueMap = new Map();
    for (const t of allTeachers) {
      if (t && t._id) {
        uniqueMap.set(t._id, t);
      }
    }
    const deduplicatedTeachers = Array.from(uniqueMap.values());

    if (effectiveSignal.aborted) {
      throw new Error('Sync aborted');
    }

    // Save to IndexedDB
    await saveTeachers(deduplicatedTeachers);

    return deduplicatedTeachers;
  } finally {
    if (currentSyncAbortController === controller) {
      currentSyncAbortController = null;
    }
  }
}

