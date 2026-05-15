import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import multer from 'multer';
import session from 'express-session';
import bodyParser from 'body-parser';
import { pb } from './pb.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true if using HTTPS
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 200 } // 200MB
});

// ===================== API ROUTES =====================

// Health test
app.get('/api/test', (req, res) => res.json({ ok: true }));

// Get all comics
app.get('/api/comics', async (req, res) => {
  try {
    const comics = await pb.collection('comics').getFullList({
      sort: '-created'
    });
    res.json(comics);
  } catch (error) {
    console.error('PocketBase error:', error);
    return res.status(500).json({ error: 'Failed to fetch comics' });
  }
});

// Get single comic + chapters
app.get('/api/comics/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch comic
    const comic = await pb.collection('comics').getOne(id);
    if (!comic) return res.status(404).json({ error: 'Comic not found' });

    // Fetch chapters
    const chapters = await pb.collection('chapters').getFullList({
      filter: `comic_id = "${id}"`,
      sort: '+order'
    });

    // Map chapters to include CBZ download URL only
    const chaptersWithCBZ = chapters.map(chapter => ({
      ...chapter,
      cbz: chapter.cbz_url ? pb.files.getURL(chapter, chapter.cbz_url) : null
    }));

    res.json({ ...comic, chapters: chaptersWithCBZ });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Get genres
app.get('/api/genres', async (req, res) => {
  try {
    const comics = await pb.collection('comics').getFullList();

    const genreMap = {};
    for (const comic of comics) {
      const genres = (comic.genre || '').split(',').map(g => g.trim()).filter(Boolean);
      for (const genre of genres) {
        if (!genreMap[genre]) genreMap[genre] = [];
        genreMap[genre].push(comic);
      }
    }
    res.json(genreMap);
  } catch (error) {
    console.error('Error fetching comics:', error);
    return res.status(500).json({ error: 'Failed to fetch comics' });
  }
});

// Navigation JSON
app.get('/api/nav', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'nav.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to load nav.' });
    res.json(JSON.parse(data));
  });
});

// Footer JSON
app.get('/api/footer', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'footer.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to load footer.' });
    res.json(JSON.parse(data));
  });
});

// ---------------- ADMIN HELPERS ----------------

async function uploadCBZBufferToPocketBase({ buffer, originalName, comicId, chapterId }) {
  // PocketBase file storage path
  const fileName = originalName.replace(/\s+/g, '_');
  const storagePath = `chapters/${comicId}/${chapterId}/${fileName}`;
  
  try {
    // For PocketBase, files are uploaded as part of record creation/update
    // We'll return the file path to be stored in the record
    return { fileName, storagePath };
  } catch (error) {
    throw new Error(`File path preparation failed: ${error.message}`);
  }
}

async function upsertComicMetadata(payload) {
  try {
    const { id, ...data } = payload;

    // Try to fetch existing comic by record id if one was provided.
    let existing = null;
    if (id) {
      try {
        existing = await pb.collection('comics').getOne(id);
      } catch (err) {
        // Record doesn't exist, which is fine.
      }
    }

    if (existing) {
      const updated = await pb.collection('comics').update(id, data);
      console.log('PocketBase comic updated:', updated);
      return updated;
    }

    // Create a new record without a custom id so PocketBase can generate a valid one.
    const created = await pb.collection('comics').create(data);
    console.log('PocketBase comic created:', created);
    return created;
  } catch (e) {
    console.error('upsertComicMetadata failed:', e);
    throw e;
  }
}

async function upsertChapterRecord({ comicId, chapterId, cbzUrl, title, cbzFile }) {
  const chapterData = {
    comic_id: comicId,
    title: title || `Chapter ${chapterId}`,
    order: parseInt(chapterId, 10),
    cbz_url: cbzUrl || null
  };

  // Add file if provided
  if (cbzFile) {
    chapterData.cbz_file = cbzFile;
  }

  try {
    // PocketBase: create a chapter record with file
    const result = await pb.collection('chapters').create(chapterData);
    return result;
  } catch (error) {
    throw new Error(`Failed to create chapter record: ${error.message}`);
  }
}

// ===================== ADMIN API =====================

// List comics (paginated)
app.get('/api/admin/comics', async (req, res) => {
  try {
    const { from = 0, to = 49 } = req.query;
    const page = Math.floor(Number(from) / 50) + 1;
    const perPage = Number(to) - Number(from) + 1;
    
    const data = await pb.collection('comics').getList(page, perPage, {
      sort: '-created'
    });
    
    res.json(data.items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Get single comic for admin (with chapters)
app.get('/api/admin/comics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const comic = await pb.collection('comics').getOne(id);
    if (!comic) return res.status(404).json({ error: 'Comic not found' });

    const chapters = await pb.collection('chapters').getFullList({
      filter: `comic_id = "${id}"`,
      sort: '+order'
    });

    res.json({ ...comic, chapters });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Create/update comic metadata
app.post('/api/admin/comics', async (req, res) => {
  try {
    const payload = req.body;
    const result = await upsertComicMetadata(payload);
    res.json({ ok: true, record: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Upload cover image and save the generated URL to cover_url
app.post('/api/admin/comics/:id/cover', upload.single('cover'), async (req, res) => {
  try {
    const comicId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload the cover file into the comics collection file field named 'cover'.
    const formData = new FormData();
    const coverBlob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('cover', coverBlob, file.originalname);

    const updated = await pb.collection('comics').update(comicId, formData);
    const coverUrl = pb.files.getUrl(updated, updated.cover);

    if (!coverUrl) {
      return res.status(500).json({ error: 'Failed to generate cover URL' });
    }

    // Save the generated URL into the cover_url text field.
    await pb.collection('comics').update(comicId, { cover_url: coverUrl });

    res.json({ coverUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cover upload failed' });
  }
});

// Batch upload chapters (CBZ)
app.post('/api/admin/chapters/upload', upload.array('chapters', 50), async (req, res) => {
  try {
    const { comic_id } = req.body;
    if (!comic_id) return res.status(400).json({ error: 'comic_id is required' });
    if (!req.files?.length) return res.status(400).json({ error: 'No chapter files uploaded' });

    // Parse metadata safely
    let meta = {};
    if (req.body.chaptersMeta) {
      try {
        meta = JSON.parse(req.body.chaptersMeta);
      } catch {
        meta = {}; // fallback if invalid JSON
      }
    }

    const results = [];

    for (const file of req.files) {
      const original = file.originalname;
      const hint = meta[original] || {};

      // Determine chapterId
      let chapterId = String(hint.chapterId || '').trim();
      if (!chapterId) {
        const match = original.match(/(\d+)/);
        chapterId = match ? match[1] : null;
      }
      if (!chapterId) {
        results.push({ file: original, ok: false, error: 'Cannot determine chapterId' });
        continue;
      }

      const title = hint.title || `Chapter ${chapterId}`;

      try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('comic_id', comic_id);
        formData.append('title', title);
        formData.append('order', String(Number(chapterId)));
        const cbzBlob = new Blob([file.buffer], { type: 'application/x-cbz' });
        formData.append('cbz_url', cbzBlob, original);

        // Create chapter record with file in PocketBase
        const chapter = await pb.collection('chapters').create(formData);
        
        // Get the file URL
        const cbzUrl = pb.files.getURL(chapter, chapter.cbz_url);
        results.push({ file: original, ok: true, chapter, cbzUrl });
      } catch (err) {
        console.error('Upload error for', original, err);
        results.push({ file: original, ok: false, error: err.message });
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('Batch upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE comic
app.delete('/api/admin/comics/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch all chapters to delete them first
    const chapters = await pb.collection('chapters').getFullList({
      filter: `comic_id = "${id}"`
    });

    // Delete all chapter records
    for (const chapter of chapters) {
      await pb.collection('chapters').delete(chapter.id);
    }

    // Delete the comic record
    await pb.collection('comics').delete(id);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete comic failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE chapter
app.delete('/api/admin/comics/:comicId/chapters/:chapterId', requireAdmin, async (req, res) => {
  const { comicId, chapterId } = req.params;

  try {
    // Delete the chapter record (PocketBase will handle file cleanup)
    await pb.collection('chapters').delete(chapterId);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete chapter failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECT ADMIN PAGES ---
function requireAdmin(req, res, next) {
  // Check if admin is authenticated with PocketBase
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token && pb.authStore.isValid && pb.authStore.token) {
    return next();
  }
  
  // Fallback: check session
  if (req.session.isAdmin) {
    return next();
  }
  
  res.status(401).json({ error: 'Unauthorized' });
}

// --- ADMIN LOGIN ---
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Authenticate with PocketBase admin auth
    const authData = await pb.collection('admins').authWithPassword(email, password);

    if (!authData.record.active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    // Store in session
    req.session.isAdmin = true;
    req.session.adminId = authData.record.id;

    res.json({ 
      success: true, 
      token: pb.authStore.token,
      admin: {
        id: authData.record.id,
        email: authData.record.email,
        role: authData.record.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- ADMIN LOGOUT ---
app.post('/api/admin/logout', (req, res) => {
  pb.authStore.clear();
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

// --- CHECK SESSION (for frontend) ---
app.get('/api/admin/session', (req, res) => {
  if (req.session.isAdmin || (pb.authStore.isValid && pb.authStore.token)) {
    res.json({ 
      isAdmin: true,
      token: pb.authStore.token 
    });
  } else {
    res.status(401).json({ isAdmin: false });
  }
});

// --- ADMIN PAGE ROUTE ---
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../admin', 'admin.html'));
});

// --- ADMIN LOGIN PAGE ROUTE ---
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin', 'admin-login.html'));
});

// ===================== STATIC FILES & FRONTEND FALLBACK =====================

// Serve admin assets
app.use('/admin-assets', express.static(path.join(__dirname, '../admin')));

app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const htmlPath = path.join(__dirname, '../public', `${req.path}.html`);
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Global API error handler
app.use('/api', (err, req, res, next) => {
  console.error('API error:', err);
  res.status(500).json({ error: String(err.message) });
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));