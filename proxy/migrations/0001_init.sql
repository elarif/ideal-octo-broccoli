-- D1 schema for the Litteratureaudio catalogue mirror

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_url TEXT,
  duration_total INTEGER DEFAULT 0,
  published_at TEXT,
  modified_at TEXT,
  legacy_url TEXT,
  views INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  download_url TEXT,
  text_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_published_at ON books(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_views ON books(views DESC);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  count INTEGER DEFAULT 0,
  portrait_url TEXT,
  portrait_alt TEXT
);

CREATE TABLE IF NOT EXISTS voices (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS licences (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS book_authors (
  book_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS book_voices (
  book_id INTEGER NOT NULL,
  voice_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, voice_id)
);

CREATE TABLE IF NOT EXISTS book_genres (
  book_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, genre_id)
);

CREATE TABLE IF NOT EXISTS book_periods (
  book_id INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, period_id)
);

CREATE TABLE IF NOT EXISTS book_regions (
  book_id INTEGER NOT NULL,
  region_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, region_id)
);

CREATE TABLE IF NOT EXISTS book_licences (
  book_id INTEGER NOT NULL,
  licence_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, licence_id)
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  b2_url TEXT,
  duration INTEGER DEFAULT 0,
  size INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tracks_book_id ON tracks(book_id);
