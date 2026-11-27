-- BDD Gestion (PC3) : Service Facturation, Commandes & Fournisseurs
-- Donnees de test : interfaces.md section 10
-- Le domaine Gestion ne lit jamais la BDD Soins : les actes arrivent dans l'evenement SortieValidee,
-- d'ou la table tarif propre a cette base.
CREATE DATABASE gestion;
\connect gestion

CREATE TABLE tarif (
    code     VARCHAR(20) PRIMARY KEY,
    libelle  VARCHAR(100) NOT NULL,
    prix     NUMERIC(12,3) NOT NULL
);

CREATE TABLE facture (
    id               VARCHAR(20) PRIMARY KEY,               -- FAC-0001
    ipg              VARCHAR(20) NOT NULL,
    sejour_id        VARCHAR(20) NOT NULL,
    numero_assure    VARCHAR(30) NOT NULL,
    organisme        VARCHAR(50) NOT NULL,                  -- CNAM, STAR...
    date_facture     DATE NOT NULL,
    montant_total    NUMERIC(12,3) NOT NULL,
    part_organisme   NUMERIC(12,3) NOT NULL,                -- 80 %
    part_patient     NUMERIC(12,3) NOT NULL,                -- 20 %
    a_controler      BOOLEAN NOT NULL DEFAULT FALSE,
    anomalie         VARCHAR(200),
    statut           VARCHAR(20) NOT NULL DEFAULT 'CREEE'
);

CREATE TABLE facture_ligne (
    id             SERIAL PRIMARY KEY,
    facture_id     VARCHAR(20) NOT NULL REFERENCES facture(id),
    code_acte      VARCHAR(20) NOT NULL,                    -- pas de FK : un code inconnu doit rester possible (anomalie)
    quantite       INTEGER NOT NULL,
    prix_unitaire  NUMERIC(12,3) NOT NULL,
    montant        NUMERIC(12,3) NOT NULL
);

CREATE TABLE encaissement (
    id            SERIAL PRIMARY KEY,
    facture_id    VARCHAR(20) NOT NULL REFERENCES facture(id),
    montant       NUMERIC(12,3) NOT NULL,
    date_encaiss  TIMESTAMP NOT NULL DEFAULT now()
);

-- Un bordereau garde le meme id ; la correction apres rejet incremente version
CREATE TABLE bordereau (
    id           VARCHAR(20) PRIMARY KEY,                   -- BRD-0001
    facture_id   VARCHAR(20) NOT NULL REFERENCES facture(id),
    version      INTEGER NOT NULL DEFAULT 1,
    statut       VARCHAR(10) NOT NULL DEFAULT 'ENVOYE' CHECK (statut IN ('ENVOYE', 'ACCEPTE', 'REJETE')),
    motif_rejet  VARCHAR(200)
);

-- Fournisseur, prix et quantite habituelle par article (pour proposer une commande)
CREATE TABLE fournisseur_article (
    code_article    VARCHAR(20) PRIMARY KEY,
    fournisseur     VARCHAR(50) NOT NULL,
    prix_unitaire   NUMERIC(12,3) NOT NULL,
    quantite_cmd    INTEGER NOT NULL
);

CREATE TABLE commande (
    id             VARCHAR(20) PRIMARY KEY,                 -- CMD-0001
    code_article   VARCHAR(20) NOT NULL,
    fournisseur    VARCHAR(50) NOT NULL,
    quantite       INTEGER NOT NULL,
    prix_unitaire  NUMERIC(12,3) NOT NULL,
    montant        NUMERIC(12,3) NOT NULL,
    statut         VARCHAR(10) NOT NULL DEFAULT 'PROPOSEE'
                   CHECK (statut IN ('PROPOSEE', 'VALIDEE', 'ENVOYEE', 'LIVREE', 'FACTUREE', 'PAYEE')),
    date_creation  DATE NOT NULL DEFAULT CURRENT_DATE,
    date_livraison DATE
);

-- ---------- Donnees de test ----------
INSERT INTO tarif (code, libelle, prix) VALUES
 ('CONS',   'Consultation',     50.000),
 ('RADIO',  'Radiographie',    120.000),
 ('NUIT',   'Nuitee',          200.000),
 ('CHIR-A', 'Chirurgie simple', 800.000),
 ('CHIR-B', 'Chirurgie lourde', 3500.000);

INSERT INTO fournisseur_article (code_article, fournisseur, prix_unitaire, quantite_cmd) VALUES
 ('PARA500', 'SIPHAT', 2.000, 500),    -- exemple de proposition dans interfaces.md section 3
 ('AMOX1G',  'SAIPH',  5.000, 200);    -- prix et quantite : valeurs a confirmer (non fournies)
