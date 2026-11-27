-- BDD Pharmacie (PC2) : Service Stock Pharmacie
-- Donnees de test : interfaces.md section 10
CREATE DATABASE pharmacie;
\connect pharmacie

CREATE TABLE article (
    code         VARCHAR(20) PRIMARY KEY,                   -- PARA500
    libelle      VARCHAR(100) NOT NULL,
    seuil        INTEGER NOT NULL,
    fournisseur  VARCHAR(50) NOT NULL
);

CREATE TABLE stock (
    code_article  VARCHAR(20) PRIMARY KEY REFERENCES article(code),
    quantite      INTEGER NOT NULL CHECK (quantite >= 0)
);

-- Historique des consommations (POST /consommations)
CREATE TABLE consommation (
    id            SERIAL PRIMARY KEY,
    sejour_id     VARCHAR(20) NOT NULL,                     -- reference logique, pas de FK : autre base
    code_article  VARCHAR(20) NOT NULL REFERENCES article(code),
    quantite      INTEGER NOT NULL CHECK (quantite > 0),
    date_conso    TIMESTAMP NOT NULL DEFAULT now()
);

-- Entrees en stock apres livraison (POST /receptions, processus 2)
CREATE TABLE reception (
    id            SERIAL PRIMARY KEY,
    commande_id   VARCHAR(20),                              -- CMD-0001
    code_article  VARCHAR(20) NOT NULL REFERENCES article(code),
    quantite      INTEGER NOT NULL CHECK (quantite > 0),
    date_reception TIMESTAMP NOT NULL DEFAULT now()
);

-- Table Outbox : patron transactionnel pour publier les événements RabbitMQ de manière fiable.
-- Un enregistrement est créé dans la même transaction que la consommation ;
-- le service lit cette table pour publier et marque publie=TRUE après confirmation.
CREATE TABLE stock_event_outbox (
    id       SERIAL PRIMARY KEY,
    payload  JSONB NOT NULL,
    publie   BOOLEAN NOT NULL DEFAULT FALSE,
    cree_le  TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------- Donnees de test ----------
INSERT INTO article (code, libelle, seuil, fournisseur) VALUES
 ('PARA500', 'Paracetamol 500 mg', 100, 'SIPHAT'),
 ('AMOX1G',  'Amoxicilline 1 g',    80, 'SAIPH');

INSERT INTO stock (code_article, quantite) VALUES
 ('PARA500', 105),   -- consommer 10 -> 95 < seuil 100 -> declenche le processus 2
 ('AMOX1G',  300);
