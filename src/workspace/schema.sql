-- Candidats and Veilles are copied from data/config.json at every launch: the config is
-- their source of truth, never edit these rows.
CREATE TABLE IF NOT EXISTS candidat (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS veille (
  id TEXT PRIMARY KEY,
  candidat_id TEXT NOT NULL REFERENCES candidat (id),
  source TEXT NOT NULL,
  -- JSON, shaped by the Source
  criteria TEXT NOT NULL,
  zone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offre (
  id INTEGER PRIMARY KEY,
  candidat_id TEXT NOT NULL REFERENCES candidat (id),
  source TEXT NOT NULL,
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  published_at TEXT,
  date_limite TEXT,
  employer TEXT,
  workplace TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  application_email TEXT,
  contact_1 TEXT,
  contact_2 TEXT,
  status TEXT NOT NULL DEFAULT 'a_traiter' CHECK (status IN ('a_traiter', 'postulee', 'archivee')),
  republication_of INTEGER REFERENCES offre (id),
  detected_at TEXT NOT NULL,
  is_in_zone INTEGER NOT NULL CHECK (is_in_zone IN (0, 1)),
  UNIQUE (candidat_id, source, reference)
);

-- A Version of the lettre Artefact holds a pair: the Brouillon, never changed, and the Lettre.
CREATE TABLE IF NOT EXISTS version (
  id INTEGER PRIMARY KEY,
  offre_id INTEGER NOT NULL REFERENCES offre (id),
  artefact TEXT NOT NULL CHECK (artefact IN ('recherche', 'lettre', 'fiche_entretien', 'visualisation')),
  number INTEGER NOT NULL,
  is_retenue INTEGER NOT NULL DEFAULT 0 CHECK (is_retenue IN (0, 1)),
  state TEXT NOT NULL CHECK (state IN ('running', 'ready', 'failed')),
  consignes TEXT NOT NULL,
  -- JSON array of the version ids this Version read as input
  input_version_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE (offre_id, artefact, number)
);

CREATE TABLE IF NOT EXISTS job (
  id INTEGER PRIMARY KEY,
  module TEXT NOT NULL,
  offre_id INTEGER NOT NULL REFERENCES offre (id),
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'done', 'failed')),
  log TEXT NOT NULL DEFAULT '',
  session_id TEXT
);
