import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import multer from 'multer';
import session from 'express-session';
import bodyParser from 'body-parser';

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
  secret: process.env.SESSION_SECRET, // change this
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true if using HTTPS
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 200 } // 200MB
});

const supabaseUrl = process.env.DB_URL;
const supabaseKey = process.env.DB_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Hardcoded admin credentials (or from env variables)
const ADMIN_USERNAME = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASS || '123456';

// ===================== API ROUTES =====================

// Econnerst test
app.get('/api/test', (req,res) => res.json({ ok: true}));

//fetch('/api/test'). then(r => r.json()).then(console.log).catch(console.error);


// Get all comics
app.get('/api/comics', async (req, res) => {
  const { data, error } = await supabase
    .from('comics')
    .select('*');

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Failed to fetch comics' });
  }

  res.json(data);
});

// Get single comic + chapters (CBZ only)
app.get('/api/comics/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch comic
    const { data: comic, error: comicError } = await supabase
      .from('comics')
      .select('*')
      .eq('id', id)
      .single();

    if (comicError) return res.status(404).json({ error: 'Comic not found' });

    // Fetch chapters
    const { data: chapters, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('comic_id', id)
      .order('order', { ascending: true });

    if (chapterError) return res.status(500).json({ error: chapterError.message });

    // Map chapters to include CBZ URL only
    const chaptersWithCBZ = chapters.map(chapter => ({
      ...chapter,
      cbz: chapter.cbz_url || null
    }));

    res.json({ ...comic, chapters: chaptersWithCBZ });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Get genres
app.get('/api/genres', async (req, res) => {
  const { data, error } = await supabase.from('comics').select('*');
  if (error) return res.status(500).json({ error: 'Failed to fetch comics' });

  const genreMap = {};
  for (const comic of data) {
    const genres = (comic.genre || '').split(',').map(g => g.trim()).filter(Boolean);
    for (const genre of genres) {
      if (!genreMap[genre]) genreMap[genre] = [];
      genreMap[genre].push(comic);
    }
  }
  res.json(genreMap);
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

async function uploadCBZBufferToSupabase({ buffer, originalName, comicId }) {
  const safeName = originalName.replace(/\s+/g, '_');
  const storagePath = `${comicId}/${safeName}`;
  const { error } = await supabase.storage
    .from('comics')
    .upload(storagePath, buffer, { contentType: 'application/x-cbz', upsert: true });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data: { publicUrl } } = supabase.storage.from('comics').getPublicUrl(storagePath);
  return { publicUrl, storagePath };
}

async function upsertComicMetadata(payload) {
  try {
    // Get current metadata
    const { data: existing, error: fetchError } = await supabase
      .from('comics')
      .select('*')
      .eq('id', payload.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // ignore "row not found"
      throw fetchError;
    }

    // Merge: keep old values, overwrite only provided ones
    const merged = existing ? { ...existing, ...payload } : payload;

    // Now save
    const { data, error } = await supabase.from('comics').upsert([merged]);

    if (error) {
      console.error('Supabase upsert error:', error);
      throw new Error(error.message);
    }

    console.log('Supabase upsert success:', data);
    return data;
  } catch (e) {
    console.error('upsertComicMetadata failed:', e);
    throw e;
  }
}

async function upsertChapterRecord({ comicId, chapterId, cbzUrl, title }) {
  const chapterRow = {
    id: String(chapterId),
    comic_id: comicId,
    title: title || `Chapter ${chapterId}`,
    order: parseInt(chapterId, 10),
    cbz_url: cbzUrl || null
  };
  const { error } = await supabase.from('chapters').upsert([chapterRow]);
  if (error) throw new Error(error.message);
}

// ===================== ADMIN API =====================

// List comics
app.get('/api/admin/comics', async (req, res) => {
  try {
    const { from = 0, to = 49 } = req.query;
    const { data, error } = await supabase.from('comics').select('*').range(Number(from), Number(to));
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Get single comic for admin
app.get('/api/admin/comics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: comic, error: comicError } = await supabase.from('comics').select('*').eq('id', id).single();
    if (comicError) return res.status(404).json({ error: 'Comic not found' });

    const { data: chapters, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('comic_id', id)
      .order('order', { ascending: true });
    if (chapterError) throw chapterError;

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
    if (!payload?.id) return res.status(400).json({ error: 'Missing comic id' });
    await upsertComicMetadata(payload);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/admin/comics/:id/cover', upload.single('cover'), async (req, res) => {
  try {
    const comicId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Supabase Storage
    const storagePath = `${comicId}/cover${path.extname(file.originalname)}`;
    const { error: uploadError } = await supabase.storage
      .from('comics')
      .upload(storagePath, file.buffer, { upsert: true });

    if (uploadError) throw uploadError;

    // Get public URL of the uploaded file
    const { data } = supabase.storage.from('comics').getPublicUrl(storagePath);
    const coverUrl = data.publicUrl;

    // Update comics table with new cover URL
    const { error: updateError } = await supabase
      .from('comics')
      .update({ cover: coverUrl })
      .eq('id', comicId);

    if (updateError) throw updateError;

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
      let storagePath;

      try {
        // Upload CBZ to Supabase
        const uploadResult = await uploadCBZBufferToSupabase({
          buffer: file.buffer,
          originalName: original,
          comicId: comic_id
        });

        storagePath = uploadResult.storagePath;
        const publicUrl = uploadResult.publicUrl;

        // Save record in DB
        await upsertChapterRecord({
          comicId: comic_id,
          chapterId,
          cbzUrl: publicUrl,
          title
        });

        results.push({ file: original, ok: true, chapterId, url: publicUrl, storagePath });

      } catch (err) {
        console.error('Upload error for', original, err);

        // Cleanup partially uploaded file if any
        if (storagePath) {
          try {
            await supabase.storage.from('comics').remove([storagePath]);
          } catch (cleanupErr) {
            console.error('Failed to remove partial file:', cleanupErr);
          }
        }

        results.push({ file: original, ok: false, error: err.message });
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('Batch upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/comics/:id
app.delete('/api/admin/comics/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch all chapters to get their storage paths
    const { data: chapters, error: chapterErr } = await supabase
      .from('chapters')
      .select('id, cbz_url')
      .eq('comic_id', id);

    if (chapterErr) throw chapterErr;

    // 2. Delete all chapter records
    if (chapters.length) {
      const chapterIds = chapters.map(c => c.id);
      await supabase.from('chapters').delete().in('id', chapterIds);
    }

    // 3. Delete comic record
    await supabase.from('comics').delete().eq('id', id);

    // 4. Delete all files in Supabase Storage
    // List all files under the comic folder
    const { data: files, error: listErr } = await supabase.storage
      .from('comics')
      .list(id, { limit: 1000, offset: 0 });

    if (listErr) console.warn('Failed to list files:', listErr.message);

    const filePaths = files?.map(f => `${id}/${f.name}`) || [];
    if (filePaths.length) {
      const { error: delErr } = await supabase.storage.from('comics').remove(filePaths);
      if (delErr) console.warn('Failed to delete files:', delErr.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete comic failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/comics/:comicId/chapters/:chapterId
app.delete('/api/admin/comics/:comicId/chapters/:chapterId', requireAdmin, async (req, res) => {
  const { comicId, chapterId } = req.params;

  try {
    // 1. Fetch chapter record to get storage path
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('cbz_url')
      .eq('comic_id', comicId)
      .eq('id', chapterId)
      .single();

    if (chErr && chErr.code !== 'PGRST116') throw chErr; // ignore not found

    // 2. Delete chapter record
    await supabase.from('chapters').delete().eq('comic_id', comicId).eq('id', chapterId);

    // 3. Delete CBZ file from Supabase Storage if exists
    if (chapter?.cbz_url) {
      const url = new URL(chapter.cbz_url);
      const filePath = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\/public\/comics\//, ''));
      await supabase.storage.from('comics').remove([filePath]).catch(console.warn);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete chapter failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- LOGIN ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;       // mark session as logged in
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- LOGOUT ---
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

// --- CHECK SESSION (for frontend) ---
app.get('/api/admin/session', (req, res) => {
  if (req.session.isAdmin) {
    res.json({ isAdmin: true });
  } else {
    res.status(401).json({ isAdmin: false });
  }
});

// --- PROTECT ADMIN PAGES ---
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin-login');
}

// --- ADMIN PAGE ROUTE ---
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'admin.html'));
});

// --- ADMIN LOGIN PAGE ROUTE ---
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'admin-login.html'));
});

// ===================== STATIC FILES & FRONTEND FALLBACK =====================
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