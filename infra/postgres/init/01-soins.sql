-- BDD Soins (PC2) : Service Patient, Couverture/Droits, Sejour & Actes
-- Donnees de test : interfaces.md section 10
CREATE DATABASE soins;
\connect soins

CREATE TABLE patient (
    ipg              VARCHAR(20) PRIMARY KEY,               -- IPG-0001
    cin              VARCHAR(20) UNIQUE NOT NULL,
    nom              VARCHAR(100) NOT NULL,
    prenom           VARCHAR(100) NOT NULL,
    date_naissance   DATE NOT NULL,
    telephone        VARCHAR(20),
    email            VARCHAR(150),
    type_couverture  VARCHAR(10) NOT NULL CHECK (type_couverture IN ('CNAM', 'ASSUREUR')),
    numero_assure    VARCHAR(30) NOT NULL,
    assureur         VARCHAR(50)                            -- NULL si CNAM, sinon STAR, COMAR...
);

-- Derniere verification des droits d'un patient (mise a jour par le Service Couverture / Droits)
CREATE TABLE couverture (
    ipg              VARCHAR(20) PRIMARY KEY REFERENCES patient(ipg),
    droits_valides   BOOLEAN NOT NULL,
    date_fin_droits  DATE,
    motif            VARCHAR(200),
    accord_id        VARCHAR(30)                            -- ACC-0001
);

CREATE TABLE tarif (
    code     VARCHAR(20) PRIMARY KEY,
    libelle  VARCHAR(100) NOT NULL,
    prix     NUMERIC(12,3) NOT NULL
);

CREATE TABLE lit (
    id       VARCHAR(10) PRIMARY KEY,                       -- L-12
    service  VARCHAR(50) NOT NULL,
    libre    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sejour (
    id            VARCHAR(20) PRIMARY KEY,                  -- SEJ-0001
    ipg           VARCHAR(20) NOT NULL REFERENCES patient(ipg),
    service       VARCHAR(50) NOT NULL,
    lit_id        VARCHAR(10) NOT NULL REFERENCES lit(id),
    date_entree   DATE NOT NULL,
    date_sortie   DATE,
    statut        VARCHAR(10) NOT NULL DEFAULT 'OUVERT' CHECK (statut IN ('OUVERT', 'SORTI'))
);

CREATE TABLE acte (
    id          SERIAL PRIMARY KEY,
    sejour_id   VARCHAR(20) NOT NULL REFERENCES sejour(id),
    code_acte   VARCHAR(20) NOT NULL REFERENCES tarif(code),
    quantite    INTEGER NOT NULL CHECK (quantite > 0),
    date_acte   DATE NOT NULL
);

-- ---------- Donnees de test ----------
INSERT INTO patient (ipg, cin, nom, prenom, date_naissance, telephone, email, type_couverture, numero_assure, assureur) VALUES
 ('IPG-0001', '08123456', 'Ben Salah', 'Ali',    '1980-04-12', '+21620111222', 'ali@test.tn',    'CNAM',     'CN-100001', NULL),
 ('IPG-0002', '08234567', 'Trabelsi',  'Sarra',  '1992-09-03', '+21620222333', 'sarra@test.tn',  'CNAM',     'CN-100002', NULL),
 ('IPG-0003', '08345678', 'Gharbi',    'Mohamed','1975-01-25', '+21620333444', 'mohamed@test.tn','ASSUREUR', 'ST-300003', 'STAR'),
 ('IPG-0004', '08456789', 'Jlassi',    'Amira',  '1988-11-30', '+21620444555', 'amira@test.tn',  'CNAM',     'CN-100004', NULL);

INSERT INTO couverture (ipg, droits_valides, date_fin_droits, motif, accord_id) VALUES
 ('IPG-0001', TRUE,  '2027-12-31', NULL,             NULL),
 ('IPG-0002', FALSE, '2026-06-30', 'Droits expires', NULL),   -- scenario droits invalides
 ('IPG-0003', TRUE,  '2027-12-31', NULL,             NULL),
 ('IPG-0004', TRUE,  '2027-12-31', NULL,             NULL);

INSERT INTO tarif (code, libelle, prix) VALUES
 ('CONS',   'Consultation',     50.000),
 ('RADIO',  'Radiographie',    120.000),
 ('NUIT',   'Nuitee',          200.000),
 ('CHIR-A', 'Chirurgie simple', 800.000),
 ('CHIR-B', 'Chirurgie lourde', 3500.000);

INSERT INTO lit (id, service, libre) VALUES
 ('L-10', 'CHIRURGIE', TRUE),
 ('L-11', 'CHIRURGIE', TRUE),
 ('L-12', 'CHIRURGIE', TRUE);
