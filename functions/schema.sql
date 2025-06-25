create table comics (
  id text primary key,
  title text not null,
  description text,
  shortdescription text,
  author text,
  penciller text,
  genre text,
  source text,
  status text,
  cover text null
);

create table chapters (
  id text,
  comic_id text references comics(id) on delete cascade,
  title text,
  "order" integer,
  primary key (id, comic_id)
);

create table chapter_images (
  id uuid default gen_random_uuid() primary key,
  chapter_id text,
  comic_id text,
  image_url text not null,
  page_number integer,
  foreign key (chapter_id, comic_id) references chapters(id, comic_id) on delete cascade
);

alter table chapter_images 
add constraint unique_chapter_page 
unique (chapter_id, comic_id, page_number);
