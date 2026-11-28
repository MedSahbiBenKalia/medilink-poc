from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
from uuid import uuid4
import csv
import os

app = FastAPI(title="Faux DossierSoins")

SCENARIOS = Path(__file__).resolve().parent.parent / "scenario"

ENTREE = Path(os.getenv(
    "DOSSIERSOINS_ENTREE",
    "C:/medilink/dossiersoins/entree"
))

FICHIERS = {
    "IPG-0001": "01-nominal.csv",
    "IPG-0003": "02-facture-controle.csv",
    "IPG-0004": "03-rejet-cnam.csv"
}


class ExportRequest(BaseModel):
    ipg: str
    sejourId: str
    stock: bool = False


@app.post("/dossiersoins/export", status_code=201)
def exporter(data: ExportRequest):

    if data.stock and data.ipg == "IPG-0001":
        scenario = "04-stock-sous-seuil.csv"
    else:
        scenario = FICHIERS.get(data.ipg)

    if not scenario:
        raise HTTPException(400, "Scenario non disponible")

    source = SCENARIOS / scenario

    with source.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        lignes = list(reader)
        champs = reader.fieldnames

    for ligne in lignes:
        ligne["ipg"] = data.ipg
        ligne["sejourId"] = data.sejourId

    ENTREE.mkdir(parents=True, exist_ok=True)

    nom = f"export-{uuid4().hex[:10]}.csv"
    destination = ENTREE / nom
    temporaire = ENTREE / (nom + ".tmp")

    with temporaire.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=champs, delimiter=";")
        writer.writeheader()
        writer.writerows(lignes)

    temporaire.replace(destination)

    return {
        "statut": "EXPORTE",
        "fichier": nom,
        "ipg": data.ipg,
        "sejourId": data.sejourId
    }