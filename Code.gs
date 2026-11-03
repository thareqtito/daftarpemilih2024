/**
 * BACKEND — Arsip Model A Daftar Pemilih 2024 (Pemilu & Pilkada)
 * KPU Kabupaten Pacitan · Subbagian Rendatin
 *
 * Fungsi: membaca isi folder Google Drive (PDF Model A yang sudah jadi),
 * mengirim daftar folder/file ke halaman web (GitHub Pages), dan membuat ZIP
 * per desa/kecamatan saat diminta.
 *
 * Deploy: Terapkan > Deployment baru > Aplikasi web
 *   - Jalankan sebagai : Saya (akun pemilik folder)
 *   - Akses            : Siapa saja
 */

const SOURCES = {
  pemilu:  { id: '1F8zWVj4euv84H4GE55p3AONGMVa6Gn3o', label: 'Pemilu 2024' },
  pilkada: { id: '133r4fgUoWLr218QpaxMntBOf49yjwfUY', label: 'Pilkada 2024' }
};

const CACHE_VER   = 'mA24_v1_';
const CHUNK       = 90000;              // batas aman per kunci CacheService (100 KB)
const CACHE_TTL   = 21600;              // 6 jam (maksimum CacheService)
const ZIP_MAX_MB  = 25;                 // batas ukuran ZIP sekali unduh

/* ===================== ROUTER ===================== */
function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    switch (p.action) {
      case 'tree':    out = { ok: true, src: p.src, tree: getTree_(p.src, p.refresh === '1') }; break;
      case 'zip':     out = zipFolder_(p.src, p.folderId); break;
      case 'refresh': out = refreshAll_(); break;
      default:
        out = { ok: true, app: 'Arsip Model A 2024', sources: Object.keys(SOURCES).map(k => ({ key: k, label: SOURCES[k].label })) };
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return respond_(out, p.callback);
}

function respond_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[\w.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== INDEKS FOLDER ===================== */
function src_(key) {
  const s = SOURCES[key];
  if (!s) throw new Error('Sumber data tidak dikenal: ' + key);
  return s;
}

/** Struktur ringkas: folder {i,n,u,f:[folder],d:[file]} · file {i,n,s,m,u} */
function buildNode_(folder) {
  const node = { i: folder.getId(), n: folder.getName(), u: folder.getLastUpdated().getTime(), f: [], d: [] };
  const subs = folder.getFolders();
  while (subs.hasNext()) node.f.push(buildNode_(subs.next()));
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.isTrashed()) continue;
    node.d.push({ i: f.getId(), n: f.getName(), s: f.getSize(), m: f.getMimeType(), u: f.getLastUpdated().getTime() });
  }
  return node;
}

function getTree_(key, forceRefresh) {
  const s = src_(key);
  if (!forceRefresh) {
    const cached = cacheGet_(key) || driveCacheGet_(key);
    if (cached) return JSON.parse(cached);
  }
  const tree = buildNode_(DriveApp.getFolderById(s.id));
  tree.n = s.label;
  tree.builtAt = Date.now();
  const json = JSON.stringify(tree);
  cachePut_(key, json);
  driveCachePut_(key, json);
  return tree;
}

function refreshAll_() {
  const res = {};
  Object.keys(SOURCES).forEach(k => {
    const t = getTree_(k, true);
    res[k] = countFiles_(t);
  });
  return { ok: true, refreshed: res };
}

function countFiles_(node) {
  return node.d.length + node.f.reduce((a, c) => a + countFiles_(c), 0);
}

/* --- CacheService (dipotong per 90 KB) --- */
function cachePut_(key, json) {
  const c = CacheService.getScriptCache();
  const parts = Math.ceil(json.length / CHUNK);
  const map = {};
  map[CACHE_VER + key + '_n'] = String(parts);
  for (let i = 0; i < parts; i++) map[CACHE_VER + key + '_' + i] = json.substr(i * CHUNK, CHUNK);
  try { c.putAll(map, CACHE_TTL); } catch (e) { /* abaikan, masih ada cache Drive */ }
}

function cacheGet_(key) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(CACHE_VER + key + '_n') || 0);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(CACHE_VER + key + '_' + i);
  const got = c.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (got[keys[i]] == null) return null;
    s += got[keys[i]];
  }
  return s;
}

/* --- Cache permanen di Drive (agar tidak membangun ulang tiap 6 jam) --- */
function driveCachePut_(key, json) {
  const props = PropertiesService.getScriptProperties();
  const pk = CACHE_VER + 'file_' + key;
  const id = props.getProperty(pk);
  try {
    if (id) { DriveApp.getFileById(id).setContent(json); return; }
  } catch (e) { /* file hilang, buat baru */ }
  const f = DriveApp.createFile('_cache_model_a_2024_' + key + '.json', json, MimeType.PLAIN_TEXT);
  props.setProperty(pk, f.getId());
}

function driveCacheGet_(key) {
  const id = PropertiesService.getScriptProperties().getProperty(CACHE_VER + 'file_' + key);
  if (!id) return null;
  try {
    const s = DriveApp.getFileById(id).getBlob().getDataAsString();
    cachePut_(key, s);
    return s;
  } catch (e) { return null; }
}

/* ===================== ZIP ===================== */
function findNode_(node, id, path) {
  if (node.i === id) return { node: node, path: path };
  for (const c of node.f) {
    const r = findNode_(c, id, path.concat(c.n));
    if (r) return r;
  }
  return null;
}

function collectFiles_(node, prefix, acc) {
  node.d.forEach(f => acc.push({ i: f.i, name: (prefix ? prefix + ' - ' : '') + f.n, s: f.s }));
  node.f.forEach(c => collectFiles_(c, (prefix ? prefix + ' - ' : '') + c.n, acc));
  return acc;
}

function zipFolder_(key, folderId) {
  const tree = getTree_(key, false);
  // Hanya folder yang ada di dalam folder sumber yang boleh di-ZIP
  const hit = findNode_(tree, folderId, []);
  if (!hit) throw new Error('Folder tidak ditemukan di sumber data. Coba "Muat ulang data".');

  const files = collectFiles_(hit.node, '', []);
  if (!files.length) throw new Error('Folder ini tidak berisi file.');
  const total = files.reduce((a, f) => a + (f.s || 0), 0);
  if (total > ZIP_MAX_MB * 1024 * 1024) {
    throw new Error('Ukuran folder ' + (total / 1048576).toFixed(1) + ' MB melebihi batas ZIP ' + ZIP_MAX_MB +
      ' MB. Silakan unduh per desa/kelurahan.');
  }

  const seen = {};
  const blobs = files.map(f => {
    let name = f.name;
    if (seen[name]) { const k = ++seen[name]; name = name.replace(/(\.[^.]*)?$/, ' (' + k + ')$1'); }
    else seen[name] = 1;
    return DriveApp.getFileById(f.i).getBlob().setName(name);
  });

  const zipName = [SOURCES[key].label].concat(hit.path).join(' - ').replace(/[\\/:*?"<>|]/g, '_') + '.zip';
  const zip = Utilities.zip(blobs, zipName);
  return { ok: true, name: zipName, count: blobs.length, b64: Utilities.base64Encode(zip.getBytes()) };
}

/* ===================== UTILITAS ===================== */
/** Jalankan manual sekali dari editor untuk memberi izin & membangun indeks awal. */
function setupAwal() {
  Logger.log(JSON.stringify(refreshAll_()));
}

/** Opsional: pasang pemicu harian agar indeks selalu segar. */
function pasangPemicuHarian() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'setupAwal') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('setupAwal').timeBased().everyDays(1).atHour(2).create();
}
