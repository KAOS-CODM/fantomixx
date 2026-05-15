-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.chapters (
  id text NOT NULL,
  comic_id text NOT NULL,
  title text,
  order integer,
  cbz_url text,
  CONSTRAINT chapters_pkey PRIMARY KEY (id, comic_id),
  CONSTRAINT chapters_comic_id_fkey FOREIGN KEY (comic_id) REFERENCES public.comics(id)
);
CREATE TABLE public.comics (
  id text NOT NULL,
  title text NOT NULL,
  description text,
  shortdescription text,
  author text,
  penciller text,
  genre text,
  source text,
  status text,
  cover text,
  CONSTRAINT comics_pkey PRIMARY KEY (id)
);