import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../public')));
app.use((req, res, next) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname  = parsedUrl.pathname;

  if(!path.extname(pathname)){
    const htmlPath = path.join(__dirname, '../public', `${pathname}.html`);
    if(fs.existsSync(htmlPath)){
      return res.sendFile(htmlPath);
    }
  }
  next();
})
app.use(cors());


const supabaseUrl = process.env.DB_URL;
const supabaseKey = process.env.DB_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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


app.get('/api/comics/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: comic, error: comicError } = await supabase
      .from('comics')
      .select('*')
      .eq('id', id)
      .single();

    if (comicError) return res.status(404).json({ error: 'Comic not found' });

    const { data: chapters, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('comic_id', id)
      .order('order', { ascending: true });

    if (chapterError) return res.status(500).json({ error: chapterError.message });

    const chapterIds = chapters.map(ch => ch.id);
    let images = [];

    if (chapterIds.length > 0) {
      const { data: imgData, error: imgError } = await supabase
      .from('chapter_images')
      .select('*')
      .eq('comic_id', id)
      .in('chapter_id', chapterIds);

      if (imgError) return res.status(500).json({ error: imgError.message });

      images = imgData;
    }

    const imagesByChapter = {};
    for (const img of images) {
      if (!imagesByChapter[img.chapter_id]) imagesByChapter[img.chapter_id] = [];
      imagesByChapter[img.chapter_id].push(img);
    }

    const chaptersWithImages = chapters.map(chapter => ({
      ...chapter,
      images: (imagesByChapter[chapter.id] || [])
        .sort((a, b) => a.page_number - b.page_number)
        .map(img => img.image_url.startsWith("http") ? img.image_url : `/uploads/${img.image_url}`)
    }));

    return res.json({
      ...comic,
      chapters: chaptersWithImages,
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.get('/api/genres', async (req, res) => {
  const { data, error } = await supabase
  .from('comics')
  .select('*');

  if (error){
    console.error('Error fetching comics:', error);
    return res.status(500).json({error: 'Failed to fetch comics'});
  }

  const genreMap = {};

  for (const comic of data){
    const genres = (comic.genre || '').split(',').map(g => g.trim()).filter(Boolean);

    for (const genre of genres){
      if(!genreMap[genre]) genreMap[genre] = [];
      genreMap[genre].push(comic);
    }
  }

  res.json(genreMap);
});

app.get('/api/nav', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'nav.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading nav.json:', err);
      return res.status(500).json({ error: 'Failed to load nav.' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});


app.get('/api/footer', (req,res) => {
  const filePath = path.join(__dirname, 'data', 'footer.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading footer.json:', err);
      return res.status(500).json({ error: 'Failed to load footer.' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
})

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
