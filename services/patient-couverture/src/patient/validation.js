// Conversion base <-> JSON et regles de validation de l'objet Patient (interfaces.md §2).

// Correspondance champ JSON (camelCase) -> colonne SQL (snake_case).
// L'IPG n'est pas modifiable : il est genere a la creation et sert d'identifiant.
const COLONNES = {
  cin: 'cin',
  nom: 'nom',
  prenom: 'prenom',
  dateNaissance: 'date_naissance',
  telephone: 'telephone',
  email: 'email',
  typeCouverture: 'type_couverture',
  numeroAssure: 'numero_assure',
  assureur: 'assureur',
};
const CHAMPS = Object.keys(COLONNES);

// Ligne SQL -> objet Patient du contrat.
function versJson(ligne) {
  return {
    ipg: ligne.ipg,
    cin: ligne.cin,
    nom: ligne.nom,
    prenom: ligne.prenom,
    dateNaissance: ligne.date_naissance,
    telephone: ligne.telephone,
    email: ligne.email,
    typeCouverture: ligne.type_couverture,
    numeroAssure: ligne.numero_assure,
    assureur: ligne.assureur,
  };
}

// Ne garde du corps de la requete que les champs connus (les autres sont ignores).
function extraireChamps(corps) {
  const resultat = {};
  for (const champ of CHAMPS) {
    if (corps && Object.prototype.hasOwnProperty.call(corps, champ)) resultat[champ] = corps[champ];
  }
  return resultat;
}

const estTexte = (v) => typeof v === 'string' && v.trim() !== '';

function estDateIso(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

// Verifie un patient complet ; renvoie la liste des erreurs (vide si tout est correct).
function validerPatient(p) {
  const erreurs = [];
  if (typeof p.cin !== 'string' || !/^\d{8}$/.test(p.cin)) erreurs.push('cin doit contenir 8 chiffres');
  if (!estTexte(p.nom)) erreurs.push('nom obligatoire');
  if (!estTexte(p.prenom)) erreurs.push('prenom obligatoire');
  if (!estDateIso(p.dateNaissance)) erreurs.push('dateNaissance obligatoire au format AAAA-MM-JJ');
  if (p.telephone != null && typeof p.telephone !== 'string') erreurs.push('telephone doit etre un texte');
  if (p.email != null && (typeof p.email !== 'string' || !p.email.includes('@'))) erreurs.push('email invalide');
  if (!estTexte(p.numeroAssure)) erreurs.push('numeroAssure obligatoire');

  if (p.typeCouverture === 'CNAM') {
    if (p.assureur != null) erreurs.push('assureur doit etre null si typeCouverture = CNAM');
  } else if (p.typeCouverture === 'ASSUREUR') {
    if (!estTexte(p.assureur)) erreurs.push('assureur obligatoire si typeCouverture = ASSUREUR');
  } else {
    erreurs.push('typeCouverture doit valoir CNAM ou ASSUREUR');
  }
  return erreurs;
}

module.exports = { COLONNES, CHAMPS, versJson, extraireChamps, validerPatient };
