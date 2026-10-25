const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'database.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const initialData = {
  registrations: [],
  documents: [],
  news: [
    { id: 'welcome', title: 'Welcome to the ECOWAS Statistics Meeting', body: 'The Directors General of Statistics Annual Meeting will bring together national statistical offices from ECOWAS Member States.', date: '2026-10-09' }
  ],
  agenda: [
    { id: 'agenda-coming-soon', day: 'To be announced', time: 'Coming soon', title: 'Official agenda', description: 'The detailed programme will be published here when confirmed.' }
  ]
};
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return structuredClone(initialData); }
}
function writeDb(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function clean(value, max = 200) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 150, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(ROOT, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|png|jpg|jpeg)$/i.test(file.originalname);
    cb(allowed ? null : new Error('File type not allowed. Upload PDF, Office, CSV or image files.'), allowed);
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'ECOWAS Statistics Meeting API' }));
app.get('/api/agenda', (_req, res) => res.json(readDb().agenda));
app.get('/api/news', (_req, res) => res.json(readDb().news));
app.get('/api/documents', (_req, res) => {
  const docs = readDb().documents.map(({ id, originalName, size, uploadedAt }) => ({ id, originalName, size, uploadedAt }));
  res.json(docs);
});

app.post('/api/register', (req, res) => {
  const fullName = clean(req.body.fullName, 120);
  const email = clean(req.body.email, 180).toLowerCase();
  const organization = clean(req.body.organization, 160);
  const country = clean(req.body.country, 80);
  if (!fullName || !validEmail(email) || !organization || !country) {
    return res.status(400).json({ error: 'Please complete every field with a valid email address.' });
  }
  const db = readDb();
  if (db.registrations.some(r => r.email === email)) {
    return res.status(409).json({ error: 'This email address has already been registered.' });
  }
  const record = { id: crypto.randomUUID(), fullName, email, organization, country, registeredAt: new Date().toISOString() };
  db.registrations.push(record);
  writeDb(db);
  res.status(201).json({ message: 'Registration received successfully.', registrationId: record.id });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
  const db = readDb();
  const doc = {
    id: crypto.randomUUID(),
    originalName: path.basename(req.file.originalname).slice(0, 180),
    storedName: req.file.filename,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  };
  db.documents.push(doc);
  writeDb(db);
  res.status(201).json({ message: 'File uploaded successfully.', document: { id: doc.id, originalName: doc.originalName, size: doc.size, uploadedAt: doc.uploadedAt } });
});

app.get('/api/documents/:id/download', (req, res) => {
  const doc = readDb().documents.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const filePath = path.join(UPLOAD_DIR, path.basename(doc.storedName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'The stored file is missing.' });
  res.download(filePath, doc.originalName);
});

// Optional protected administration endpoints. Set ADMIN_TOKEN in the environment.
function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'Admin API is disabled. Set ADMIN_TOKEN to enable it.' });
  const supplied = req.get('x-admin-token') || '';
  const a = Buffer.from(supplied), b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid admin token.' });
  next();
}
app.get('/api/admin/registrations', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json(db.registrations.map(({ id, fullName, email, organization, country, registeredAt }) => ({ id, fullName, email, organization, country, registeredAt })));
});
app.post('/api/admin/agenda', requireAdmin, (req, res) => {
  const title = clean(req.body.title, 180);
  const day = clean(req.body.day, 80);
  const time = clean(req.body.time, 80);
  const description = clean(req.body.description, 500);
  if (!title || !day || !time) return res.status(400).json({ error: 'Title, day and time are required.' });
  const db = readDb();
  const item = { id: crypto.randomUUID(), title, day, time, description };
  db.agenda.push(item);
  writeDb(db);
  res.status(201).json(item);
});
app.post('/api/admin/news', requireAdmin, (req, res) => {
  const title = clean(req.body.title, 180);
  const body = clean(req.body.body, 1000);
  if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
  const db = readDb();
  const item = { id: crypto.randomUUID(), title, body, date: new Date().toISOString().slice(0, 10) };
  db.news.unshift(item);
  writeDb(db);
  res.status(201).json(item);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Maximum upload size is 10 MB.' : err.message });
  res.status(400).json({ error: err.message || 'Request could not be processed.' });
});

app.listen(PORT, () => console.log(`ECOWAS Statistics Meeting website running at http://localhost:${PORT}`));
