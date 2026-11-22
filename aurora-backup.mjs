// O backup contém um manifesto JSON e os arquivos originais, em sequência.
const SIGNATURE = 'AURORA01';
const HEADER_SIZE = 12;
const TEXTS = 'aurora-books';
const CATEGORIES = 'aurora-txt-categories';
const SHELVES = 'aurora-estantes-personalizadas-v1';
const LEGACY_SHELF = 'aurora-nova-estante-v1';
const ORDER = 'aurora-shelf-order-v1';
const HIDDEN = 'aurora-hidden-books';
const OBJECT_SETTINGS = [
  'aurora-room-v1', 'aurora-environment-v1', 'aurora-epub-settings',
  'aurora-reading-preferences-v2', 'aurora-reader-preferences-v1',
  'aurora-online-reader-settings-v1', 'aurora-txt-reader-settings-v1'
];
const SIMPLE_SETTINGS = [
  'aurora-perfil-nome', 'aurora-goal', 'aurora-page-sound-enabled',
  'aurora-audio-speed', 'aurora-sharp-pdf-v1'
];
const isPosition = key => /^aurora-(?:page(?:-v2)?:[\s\S]+|dom-casmurro-(?:page|full-v2))$/.test(key);
const isLocalKey = key => [TEXTS, CATEGORIES, SHELVES, LEGACY_SHELF, ORDER, HIDDEN,
  ...OBJECT_SETTINGS, ...SIMPLE_SETTINGS].includes(key) || isPosition(key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const dictionary = value => object(value) && Object.values(value).every(item => typeof item === 'string');
const image = value => typeof value === 'string' &&
  /^(?:$|data:image\/(?:jpe?g|png|webp|gif|avif|svg\+xml)[;,]|(?:\.\/)?assets\/|https:\/\/)/i.test(value);
const shelf = value => object(value) && typeof value.id === 'string' && !!value.id &&
  typeof value.name === 'string' && (!Object.hasOwn(value, 'objects') ||
    (Array.isArray(value.objects) && value.objects.every(item => object(item) && image(item.src))));

function invalid() {
  return new Error('O arquivo está incompleto, danificado ou não é um backup compatível da Aurora.');
}

function parse(text) {
  return JSON.parse(text, (key, value) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw invalid();
    return value;
  });
}

function validateLocal(values) {
  if (!object(values)) throw invalid();
  for (const [key, value] of Object.entries(values)) {
    if (!isLocalKey(key) || typeof value !== 'string') throw invalid();
    if (SIMPLE_SETTINGS.includes(key)) continue;
    if (isPosition(key)) {
      if (!/^\d+$/.test(value)) throw invalid();
      continue;
    }
    const data = parse(value);
    if (key === TEXTS || key === CATEGORIES) {
      if (!dictionary(data)) throw invalid();
    } else if (key === SHELVES) {
      if (!Array.isArray(data) || !data.every(shelf)) throw invalid();
    } else if (key === LEGACY_SHELF) {
      if (!shelf(data)) throw invalid();
    } else if (key === HIDDEN) {
      if (!strings(data)) throw invalid();
    } else if (!object(data) || (key === ORDER && !Object.values(data).every(strings))) {
      throw invalid();
    }
  }
}

function validateRecords(books, progress) {
  if (!Array.isArray(books) || !Array.isArray(progress)) throw invalid();
  for (const records of [books, progress]) {
    const ids = new Set();
    for (const record of records) {
      if (!object(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw invalid();
      ids.add(record.id);
    }
  }
  for (const record of books) {
    if (typeof record.name !== 'string' || !['pdf', 'epub', 'audio'].includes(record.format || 'pdf') ||
        !Number.isSafeInteger(record.size) || record.size <= 0 || Object.hasOwn(record, 'data')) throw invalid();
    for (const key of ['cover', 'back', 'spine']) {
      if (Object.hasOwn(record, key) && !image(record[key])) throw invalid();
    }
  }
  for (const record of progress) {
    for (const field of ['page', 'chapter', 'seconds', 'percent', 'bookmark', 'updated']) {
      if (Object.hasOwn(record, field) && record[field] !== null &&
          (!Number.isFinite(record[field]) || record[field] < 0)) throw invalid();
    }
  }
}

export function createBackup({books, progress, local}) {
  const data = [];
  const entries = books.map(({data: contents, ...record}) => {
    if (!(contents instanceof ArrayBuffer || contents instanceof Blob || ArrayBuffer.isView(contents))) throw invalid();
    const file = contents instanceof Blob ? contents : new Blob([contents]);
    data.push(file);
    return {...record, size: file.size};
  });
  validateLocal(local);
  validateRecords(entries, progress);
  const manifest = new Blob([JSON.stringify({books: entries, progress, local})]);
  if (manifest.size > 0xffffffff) throw new Error('Os dados deste backup são grandes demais.');
  const header = new Uint8Array(HEADER_SIZE);
  header.set(new TextEncoder().encode(SIGNATURE));
  new DataView(header.buffer).setUint32(8, manifest.size);
  return new Blob([header, manifest, ...data], {type: 'application/octet-stream'});
}

export async function openBackup(file) {
  const header = await file.slice(0, HEADER_SIZE).arrayBuffer();
  if (header.byteLength !== HEADER_SIZE ||
      new TextDecoder().decode(header.slice(0, 8)) !== SIGNATURE) throw invalid();
  const end = HEADER_SIZE + new DataView(header).getUint32(8);
  if (end > file.size) throw invalid();
  let manifest;
  try {
    manifest = parse(await file.slice(HEADER_SIZE, end).text());
  } catch {
    throw invalid();
  }
  if (!object(manifest)) throw invalid();
  const {books, progress, local} = manifest;
  validateLocal(local);
  validateRecords(books, progress);
  let offset = end;
  const entries = books.map(({size, ...record}) => {
    const next = offset + size;
    if (next > file.size) throw invalid();
    const data = file.slice(offset, next);
    offset = next;
    return {...record, data};
  });
  if (offset !== file.size) throw invalid();
  return {books: entries, progress, local};
}

function sameFile(first, second) {
  if ((first.format || 'pdf') !== (second.format || 'pdf') ||
      first.data.byteLength !== second.data?.byteLength) return false;
  const bytes = new Uint8Array(first.data);
  const candidate = new Uint8Array(second.data);
  return bytes.every((value, index) => value === candidate[index]);
}

function availableKey(key, entries, equivalent = () => false) {
  if (!entries.has(key) || equivalent(entries.get(key))) return key;
  for (let index = 1; ; index++) {
    const candidate = key + ' (backup ' + index + ')';
    if (!entries.has(candidate) || equivalent(entries.get(candidate))) return candidate;
  }
}

const readJSON = (values, key, fallback) => values[key] == null ? fallback : JSON.parse(values[key]);
const positionFields = ['chapter', 'page', 'seconds', 'bookmark', 'percent'];
const samePosition = (a, b) => positionFields.every(key => (a[key] ?? null) === (b[key] ?? null));
function describePosition(position) {
  const details = [];
  if (position.chapter != null) details.push('capítulo ' + (position.chapter + 1));
  if (position.page != null) details.push('página ' + (position.page + 1));
  if (position.seconds != null) {
    const seconds = Math.floor(position.seconds);
    details.push(Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'));
  }
  if (position.bookmark != null) details.push('marcador na página ' + (position.bookmark + 1));
  return details.join(', ') || 'posição salva';
}

export function planRestore(current, incoming, choices = new Map()) {
  const books = new Map(current.books.map(book => [book.id, book]));
  const bookIds = new Map();
  const names = new Map();
  const newBooks = [];
  for (const book of incoming.books) {
    const existing = [...books.values()].find(candidate => sameFile(book, candidate));
    const id = existing?.id ?? availableKey(book.id, books);
    if (!existing) {
      const record = {...book, id};
      books.set(id, record);
      newBooks.push(record);
    }
    bookIds.set(book.id, id);
    names.set(book.id, book.name);
  }

  const local = new Map();
  const conflicts = [];
  function select(key, name, before, after, describe) {
    const id = JSON.stringify([key, name, before, after]);
    conflicts.push({id, name, current: describe(before), backup: describe(after)});
    return choices.get(id) === 'backup';
  }

  const texts = new Map(Object.entries(readJSON(current.local, TEXTS, {})));
  const originalTextCount = texts.size;
  const textNames = new Map();
  const categories = new Map(Object.entries(readJSON(current.local, CATEGORIES, {})));
  const importedCategories = readJSON(incoming.local, CATEGORIES, {});
  for (const [title, text] of Object.entries(readJSON(incoming.local, TEXTS, {}))) {
    const name = availableKey(title, texts, value => value === text);
    texts.set(name, text);
    textNames.set(title, name);
    if (!categories.has(name) && Object.hasOwn(importedCategories, title)) {
      categories.set(name, importedCategories[title]);
    }
  }
  if (incoming.local[TEXTS]) local.set(TEXTS, JSON.stringify(Object.fromEntries(texts)));
  if (incoming.local[CATEGORIES]) local.set(CATEGORIES, JSON.stringify(Object.fromEntries(categories)));

  const storedShelves = readJSON(current.local, SHELVES, []);
  const savedShelf = readJSON(current.local, LEGACY_SHELF, null);
  const shelves = new Map([...storedShelves, ...(savedShelf && !storedShelves.some(item => item.id === savedShelf.id)
    ? [savedShelf] : [])].map(item => [item.id, item]));
  const originalShelfCount = shelves.size;
  const importedShelves = readJSON(incoming.local, SHELVES, []);
  const legacyShelf = readJSON(incoming.local, LEGACY_SHELF, null);
  if (legacyShelf && !importedShelves.some(item => item.id === legacyShelf.id)) importedShelves.push(legacyShelf);
  const shelfContent = ({id, updatedAt, ...item}) => JSON.stringify(item);
  for (const item of importedShelves) {
    const id = availableKey(item.id, shelves, candidate => shelfContent(candidate) === shelfContent(item));
    if (!shelves.has(id)) shelves.set(id, {...item, id});
  }
  if (importedShelves.length) local.set(SHELVES, JSON.stringify([...shelves.values()]));

  const newProgress = new Map();
  const baselineProgress = new Map(current.progress.map(record => [record.id, record]));
  for (const entry of incoming.progress) {
    const textTitle = entry.id.startsWith('txt:') ? textNames.get(entry.id.slice(4)) : undefined;
    const id = bookIds.get(entry.id) ?? (textTitle ? 'txt:' + textTitle : null);
    if (!id) continue;
    const record = {...entry, id};
    const before = baselineProgress.get(id);
    const key = 'progress:' + entry.id;
    if (!before) {
      baselineProgress.set(id, record);
      newProgress.set(id, record);
    } else if (!samePosition(before, record) &&
        select(key, names.get(entry.id) ?? textTitle, before, record, describePosition)) {
      newProgress.set(id, record);
    }
  }

  for (const [key, value] of Object.entries(incoming.local)) {
    if (isPosition(key)) {
      const prefix = key.match(/^aurora-page(?:-v2)?:/)?.[0];
      const title = prefix ? key.slice(prefix.length) : null;
      const dest = prefix ? prefix + (textNames.get(title) ?? title) : key;
      const before = current.local[dest];
      if ((!prefix || textNames.has(title) || !texts.has(title)) && (before === undefined || (before !== value &&
          select(dest, title ?? 'Dom Casmurro', before, value, page => 'página ' + (Number(page) + 1))))) {
        local.set(dest, value);
      }
    } else if ([...SIMPLE_SETTINGS, ...OBJECT_SETTINGS].includes(key) && !Object.hasOwn(current.local, key)) {
      local.set(key, value);
    }
  }
  if (incoming.local[HIDDEN] && !current.local[HIDDEN]) local.set(HIDDEN, incoming.local[HIDDEN]);
  if (incoming.local[ORDER]) {
    const order = readJSON(current.local, ORDER, {});
    for (const [category, keys] of Object.entries(readJSON(incoming.local, ORDER, {}))) {
      const mapped = keys.map(key => {
        if (key.startsWith('pdf:')) return 'pdf:' + (bookIds.get(key.slice(4)) ?? key.slice(4));
        if (key.startsWith('txt:')) return 'txt:' + (textNames.get(key.slice(4)) ?? key.slice(4));
        return key;
      });
      order[category] = [...new Set([...(order[category] ?? []), ...mapped])];
    }
    local.set(ORDER, JSON.stringify(order));
  }
  return {books: newBooks, progress: [...newProgress.values()], local, conflicts,
    duplicates: incoming.books.length - newBooks.length, texts: texts.size - originalTextCount,
    shelves: shelves.size - originalShelfCount};
}

function localSnapshot(storage) {
  const entries = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (isLocalKey(key)) entries.push([key, storage.getItem(key)]);
  }
  return Object.fromEntries(entries);
}

// O plano final é recalculado dentro da transação para considerar gravações de outras abas.
function withLibrary(db, mode, operation, exportFiles = false) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['books', 'progress'], mode);
    const books = tx.objectStore('books');
    const progress = tx.objectStore('progress');
    const bookRequest = exportFiles ? books.openCursor() : books.getAll();
    const progressRequest = progress.getAll();
    const fileEntries = [];
    let bookEntries;
    let progressEntries;
    let result;
    let failure;
    let rollback = () => {};
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => {
      try { rollback(); } catch (error) { reject(error); return; }
      reject(failure ?? tx.error ?? new Error('A operação com a biblioteca foi interrompida.'));
    };
    function processSnapshot() {
      if (!bookEntries || !progressEntries) return;
      try {
        [result, rollback] = operation({
          books: bookEntries, progress: progressEntries, local: localSnapshot(localStorage)
        }, books, progress);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    }
    bookRequest.onsuccess = () => {
      if (exportFiles && bookRequest.result) {
        const cursor = bookRequest.result;
        const {data, ...record} = cursor.value;
        try {
          if (!(data instanceof ArrayBuffer || data instanceof Blob || ArrayBuffer.isView(data))) throw invalid();
          fileEntries.push({...record, data: new Blob([data])});
          cursor.continue();
        } catch (error) {
          failure = error;
          tx.abort();
        }
        return;
      }
      bookEntries = exportFiles ? fileEntries : bookRequest.result;
      processSnapshot();
    };
    progressRequest.onsuccess = () => {
      progressEntries = progressRequest.result;
      processSnapshot();
    };
  });
}

export async function readLibrary(exportFiles = false) {
  const db = await window.AuroraFormats.database();
  try {
    return await withLibrary(db, 'readonly', snapshot => [snapshot, () => {}], exportFiles);
  } finally {
    db.close();
  }
}

export async function applyBackup(incoming, expected, choices) {
  const db = await window.AuroraFormats.database();
  try {
    return await withLibrary(db, 'readwrite', (snapshot, books, progress) => {
      const plan = planRestore(snapshot, incoming, choices);
      if (JSON.stringify(plan.conflicts) !== JSON.stringify(expected.conflicts) ||
          plan.books.length !== expected.books.length || plan.duplicates !== expected.duplicates ||
          plan.texts !== expected.texts || plan.shelves !== expected.shelves) {
        throw new Error('A biblioteca mudou desde a prévia. Selecione o backup novamente.');
      }
      for (const book of plan.books) books.add(book);
      for (const record of plan.progress) progress.put(record);
      const applied = [];
      function rollback() {
        for (const [key, before, value] of applied.reverse()) {
          if (localStorage.getItem(key) !== value) continue;
          if (before === undefined) localStorage.removeItem(key);
          else localStorage.setItem(key, before);
        }
      }
      try {
        for (const [key, value] of plan.local) {
          const before = snapshot.local[key];
          if (before !== value) {
            localStorage.setItem(key, value);
            applied.push([key, before, value]);
          }
        }
      } catch (error) {
        rollback();
        throw error;
      }
      return [plan, rollback];
    });
  } finally {
    db.close();
  }
}
