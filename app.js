// Comptes — v6.0 (source JSX, compilée en app.js)
const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;
const APP_VERSION = 'v6.2';
const API_URL = 'https://script.google.com/macros/s/AKfycbxyKJD9etJlzioM09crYIGHXqxNGZXq0-jadNDz3YMGMYAoZfeZ4dNmNsdne4vilEtUHw/exec';
const COMPTES = ['Compte courant', 'Épargne France', 'Épargne Espagne'];
const LIENS = {
  nominas: 'https://docs.google.com/spreadsheets/d/1qFAGMnfFkznxkckuF5eGgY0XSo9qWAGao1vi_e5rkfw/edit',
  impots: 'https://docs.google.com/spreadsheets/d/1jThZTb0tiJE__FGkaNk9M_Qflk4QBk3tpwCq7f7z5gg/edit'
};
const CLE_CACHE = 'comptes-v6';
const CLE_ANCIENNE = 'suivi-cours-donnees';
const CLE_THEME = 'comptes-theme';
const PREFIXE_PONCT = 'Ponctuel : ';
function estPonctuel(nom) {
  return String(nom).indexOf(PREFIXE_PONCT) === 0;
}
function libelle(nom) {
  return estPonctuel(nom) ? nom.slice(PREFIXE_PONCT.length) + ' (ponctuel)' : nom;
}
const PAL_REV = ['var(--rev)', 'var(--rev2)', 'var(--rev3)', 'var(--rev4)', 'var(--rev5)'];
const PAL_DEP = ['var(--dep)', 'var(--dep2)', 'var(--dep3)', 'var(--dep4)'];

/* ---------- Dates et nombres ---------- */

const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
function ymDe(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function ymAjoute(m, n) {
  const y = +m.slice(0, 4),
    mm = +m.slice(5, 7);
  return ymDe(new Date(y, mm - 1 + n, 1));
}
function moisNom(m) {
  return MOIS_L[+m.slice(5, 7) - 1];
}
function moisLong(m) {
  return moisNom(m) + ' ' + m.slice(0, 4);
}
function moisTitre(m) {
  const s = moisLong(m);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function moisCourt(m) {
  return MOIS_C[+m.slice(5, 7) - 1];
}
function finDeMois(m) {
  const y = +m.slice(0, 4),
    mm = +m.slice(5, 7);
  return new Date(y, mm, 0).getDate() + ' ' + moisNom(m);
}
function estMois(s) {
  return /^\d{4}-\d{2}$/.test(s);
}
function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(/[\s  €]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function vide(v) {
  return v === '' || v === null || v === undefined;
}
function eur(v) {
  return (Math.round(v * 100) / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}
function eurSigne(v) {
  return (v > 0 ? '+' : v < 0 ? '−' : '') + eur(Math.abs(v));
}
function pourSaisie(v) {
  if (vide(v)) return '';
  if (typeof v === 'number') return v.toFixed(2).replace('.', ',');
  return String(v);
}
function nettoyer(v) {
  return String(v).replace(/[^\d.,-]/g, '');
}
function capital(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- Données ---------- */

function moisTexte(v) {
  if (v instanceof Date) return ymDe(v);
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (estMois(s)) return s;
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(d)) return ymDe(d);
  return s;
}
function analyser(raw) {
  const r = raw || {};
  const lignes = t => (t || []).slice(1).filter(x => x && String(x[0]).trim());
  const cats = lignes(r.finCategories).map(x => ({
    nom: String(x[0]).trim(),
    type: String(x[1]).trim() === 'depense' ? 'depense' : 'revenu',
    actif: x[2] !== false && String(x[2]).toUpperCase() !== 'FALSE'
  }));
  const arch = lignes(r.finArchives).map(x => ({
    mois: moisTexte(x[0]),
    categorie: String(x[1]).trim(),
    montant: num(x[2])
  })).filter(a => estMois(a.mois));
  const sold = lignes(r.finSoldes).map(x => ({
    mois: moisTexte(x[0]),
    compte: String(x[1]).trim(),
    montant: num(x[2])
  })).filter(s => estMois(s.mois));
  const typeDe = {};
  cats.forEach(c => {
    typeDe[c.nom] = c.type;
  });
  arch.forEach(a => {
    if (estPonctuel(a.categorie)) typeDe[a.categorie] = 'depense';
  });
  const parMois = {};
  const fiche = m => parMois[m] || (parMois[m] = {
    rev: 0,
    dep: 0,
    cats: {},
    soldes: null
  });
  arch.forEach(a => {
    const f = fiche(a.mois);
    f.cats[a.categorie] = (f.cats[a.categorie] || 0) + a.montant;
    if ((typeDe[a.categorie] || 'revenu') === 'depense') f.dep += a.montant;else f.rev += a.montant;
  });
  sold.forEach(s => {
    const f = fiche(s.mois);
    if (!f.soldes) f.soldes = {};
    f.soldes[s.compte] = (f.soldes[s.compte] || 0) + s.montant;
  });
  const moisListe = Object.keys(parMois).sort();
  const moisArch = Array.from(new Set(arch.map(a => a.mois))).sort();
  const moisSoldes = moisListe.filter(m => parMois[m].soldes);
  return {
    cats,
    arch,
    sold,
    typeDe,
    parMois,
    moisListe,
    moisArch,
    moisSoldes
  };
}
function dernierAvant(d, cible) {
  let res = null;
  d.moisListe.forEach(m => {
    if (m < cible) res = m;
  });
  return res;
}
function lireCache() {
  try {
    const brut = localStorage.getItem(CLE_CACHE);
    if (brut) {
      const o = JSON.parse(brut);
      if (o && o.raw) return o;
    }
    const ancien = localStorage.getItem(CLE_ANCIENNE);
    if (ancien) {
      const o = JSON.parse(ancien);
      if (o && o.raw && o.raw.finCategories) {
        return {
          raw: {
            finCategories: o.raw.finCategories,
            finArchives: o.raw.finArchives,
            finSoldes: o.raw.finSoldes
          },
          at: o.at
        };
      }
    }
  } catch (e) {/* stockage indisponible */}
  return null;
}
function ecrireCache(raw) {
  try {
    localStorage.setItem(CLE_CACHE, JSON.stringify({
      raw: raw,
      at: Date.now()
    }));
    localStorage.removeItem(CLE_ANCIENNE);
  } catch (e) {/* sans conséquence */}
}
async function apiGet() {
  const res = await fetch(API_URL + '?only=fin');
  const raw = await res.json();
  if (raw.error) throw new Error(raw.error);
  return {
    finCategories: raw.finCategories,
    finArchives: raw.finArchives,
    finSoldes: raw.finSoldes
  };
}
async function apiPost(action, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: action,
      payload: payload
    })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Erreur inconnue');
  return json.result;
}

/* ---------- Virement vers l'Espagne ---------- */

function estLoyersFrance(nom) {
  return /loyer/i.test(nom) && /france/i.test(nom);
}
function CarteVirement({
  loyers,
  dep,
  compact
}) {
  const v = loyers - dep;
  return /*#__PURE__*/React.createElement("section", {
    className: compact ? 'virement compact' : 'carte virement',
    "aria-label": "Virement vers l'Espagne"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v-titre"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.fleche,
    size: 18,
    color: "var(--barOn)"
  }), " À virer en Espagne"), /*#__PURE__*/React.createElement("span", {
    className: "v-mt"
  }, v > 0 ? eur(v) : '0,00 €')), /*#__PURE__*/React.createElement("div", {
    className: "petit"
  }, "Loyers France ", eur(loyers), " − dépenses ", eur(dep), v < 0 ? ' : rien à virer, il manque ' + eur(-v) + ' en France.' : ''));
}

/* ---------- Icônes ---------- */

function Ico({
  d,
  size = 22,
  sw = 2,
  children,
  color = 'currentColor'
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      flexShrink: 0
    }
  }, d ? /*#__PURE__*/React.createElement("path", {
    d: d
  }) : children);
}
const I = {
  gauche: 'm15 6-6 6 6 6',
  droite: 'm9 6 6 6-6 6',
  croix: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  oeil: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7 1.8 0 3.4-0.6 4.8-1.4',
  externe: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  lune: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  maison: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  histo: 'M3 20.5h18M6 17v-6M11 17V6M16 17v-4',
  fleche: 'M4 12h15M13 6l6 6-6 6'
};
function IcoMenu() {
  return /*#__PURE__*/React.createElement(Ico, {
    size: 20
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 7h16M4 12h16M4 17h16"
  }));
}
function IcoCal({
  size = 24
}) {
  return /*#__PURE__*/React.createElement(Ico, {
    size: size
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4.5",
    width: "18",
    height: "16",
    rx: "2.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9.5h18M8 3v3M16 3v3"
  }));
}
function IcoInfo({
  color
}) {
  return /*#__PURE__*/React.createElement(Ico, {
    size: 20,
    color: color
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 11v5M12 8h.01"
  }));
}
function IcoTableur() {
  return /*#__PURE__*/React.createElement(Ico, {
    color: "var(--barOn)"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "3",
    width: "16",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 9h16M4 15h16M10 9v12"
  }));
}
function IcoDoc() {
  return /*#__PURE__*/React.createElement(Ico, {
    color: "var(--barOn)"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 3h7l4 4v14H7z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 3v4h4M10 12h5M10 16h5"
  }));
}

/* ---------- Feuille (bottom sheet) ---------- */

function Feuille({
  onClose,
  fond,
  children,
  labelId
}) {
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useEffect(() => {
    function k(e) {
      if (e.key === 'Escape') fermer.current();
    }
    window.addEventListener('keydown', k);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = avant;
    };
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: 'feuille' + (fond ? ' fond' : ''),
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": labelId,
    style: {
      left: 0,
      right: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "poignee"
  }), children));
}

/* ---------- Accueil ---------- */

function Repartition({
  cats,
  pal
}) {
  const total = cats.reduce((a, c) => a + c.v, 0);
  if (total <= 0) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "pile",
    role: "img",
    "aria-label": cats.map(c => libelle(c.nom) + ' ' + eur(c.v)).join(', ')
  }, cats.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: c.nom,
    style: {
      flexGrow: c.v,
      background: pal[i % pal.length]
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "legende"
  }, cats.map((c, i) => /*#__PURE__*/React.createElement("div", {
    className: "it",
    key: c.nom
  }, /*#__PURE__*/React.createElement("span", {
    className: "pt",
    style: {
      background: pal[i % pal.length]
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "nom"
  }, libelle(c.nom)), /*#__PURE__*/React.createElement("span", {
    className: "mt"
  }, eur(c.v)), /*#__PURE__*/React.createElement("span", {
    className: "pc"
  }, (c.v / total * 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }), " %")))));
}
function CarteMois({
  d,
  m,
  onVoir,
  onModifier
}) {
  const f = d.parMois[m] || {
    rev: 0,
    dep: 0,
    cats: {}
  };
  const detail = type => Object.keys(f.cats).filter(c => (d.typeDe[c] || 'revenu') === type && f.cats[c] > 0).map(c => ({
    nom: c,
    v: f.cats[c]
  })).sort((a, b) => b.v - a.v);
  const rev = detail('revenu');
  const dep = detail('depense');
  return /*#__PURE__*/React.createElement("section", {
    className: "carte",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("h2", null, moisTitre(m)), /*#__PURE__*/React.createElement("button", {
    className: "lien",
    onClick: onModifier
  }, "Modifier")), /*#__PURE__*/React.createElement("div", {
    className: "trio"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Revenus"), /*#__PURE__*/React.createElement("div", {
    className: "val c-rev"
  }, eur(f.rev))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Dépenses"), /*#__PURE__*/React.createElement("div", {
    className: "val c-dep"
  }, f.dep ? eur(f.dep) : '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Solde"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, eurSigne(f.rev - f.dep)))), !f.dep && /*#__PURE__*/React.createElement("div", {
    className: "petit"
  }, "Dépenses non saisies pour ce mois."), /*#__PURE__*/React.createElement(CarteVirement, {
    compact: true,
    loyers: Object.keys(f.cats).filter(estLoyersFrance).reduce((a, c) => a + f.cats[c], 0),
    dep: f.dep
  }), rev.length > 0 && /*#__PURE__*/React.createElement(Repartition, {
    cats: rev,
    pal: PAL_REV
  }), dep.length > 0 && /*#__PURE__*/React.createElement(Repartition, {
    cats: dep,
    pal: PAL_DEP
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    className: "lien",
    onClick: onVoir
  }, "Voir l'historique ", /*#__PURE__*/React.createElement(Ico, {
    d: I.droite,
    size: 16
  }))));
}
function Sparkline({
  d,
  fin
}) {
  const mois = [];
  for (let i = 11; i >= 0; i--) mois.push(ymAjoute(fin, -i));
  const vals = mois.map(m => d.parMois[m] ? d.parMois[m].rev : 0);
  const avecDonnees = mois.filter(m => d.parMois[m] && d.parMois[m].rev > 0);
  if (avecDonnees.length < 2) return null;
  const W = 320,
    H = 90,
    P = 6;
  const max = Math.max.apply(null, vals.concat([1]));
  const pts = vals.map((v, i) => [P + i * (W - 2 * P) / 11, H - P - v / max * (H - 2 * P)]);
  const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = P + ',' + (H - P) + ' ' + line + ' ' + (W - P) + ',' + (H - P);
  const moyenne = avecDonnees.reduce((a, m) => a + d.parMois[m].rev, 0) / avecDonnees.length;
  let iMax = 0,
    iMin = -1;
  vals.forEach((v, i) => {
    if (v > vals[iMax]) iMax = i;
    if (v > 0 && (iMin < 0 || v < vals[iMin])) iMin = i;
  });
  const dernier = pts[pts.length - 1];
  return /*#__PURE__*/React.createElement("section", {
    className: "carte",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Revenus sur 12 mois"), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, "De ", moisLong(mois[0]), " à ", moisLong(fin))), /*#__PURE__*/React.createElement("svg", {
    viewBox: '0 0 ' + W + ' ' + H,
    width: "100%",
    height: "90",
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": 'Revenus mensuels de ' + moisLong(mois[0]) + ' à ' + moisLong(fin)
  }, /*#__PURE__*/React.createElement("polygon", {
    points: area,
    fill: "var(--sparkFill)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: line,
    fill: "none",
    stroke: "var(--spark)",
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: dernier[0],
    cy: dernier[1],
    r: "4",
    fill: "var(--spark)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "stats3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Moyenne"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, eur(moyenne))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Plus haut · ", moisCourt(mois[iMax])), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, eur(vals[iMax]))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Plus bas · ", iMin >= 0 ? moisCourt(mois[iMin]) : '—'), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, iMin >= 0 ? eur(vals[iMin]) : '—'))));
}
function PageAccueil({
  d,
  aujourdhui,
  onMenu,
  onGoMois,
  onGoHist,
  horsLigne
}) {
  const courant = ymDe(aujourdhui);
  const dateTxt = JOURS[aujourdhui.getDay()] + ' ' + aujourdhui.getDate() + ' ' + MOIS_L[aujourdhui.getMonth()];
  const mSoldes = d.moisSoldes.length ? d.moisSoldes[d.moisSoldes.length - 1] : null;
  const mPrec = d.moisSoldes.length > 1 ? d.moisSoldes[d.moisSoldes.length - 2] : null;
  const total = m => COMPTES.concat(Object.keys((d.parMois[m] || {}).soldes || {}).filter(c => COMPTES.indexOf(c) < 0)).reduce((a, c) => a + ((d.parMois[m].soldes || {})[c] || 0), 0);
  const courantSaisi = d.moisArch.indexOf(courant) >= 0;
  const dernierArch = d.moisArch.filter(m => m <= courant).pop() || null;
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "entete"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "date"
  }, dateTxt), /*#__PURE__*/React.createElement("h1", null, "Comptes")), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    onClick: onMenu,
    "aria-label": "Ouvrir le menu"
  }, /*#__PURE__*/React.createElement(IcoMenu, null))), horsLigne && /*#__PURE__*/React.createElement("div", {
    className: "hors-ligne"
  }, horsLigne), /*#__PURE__*/React.createElement("section", {
    className: "hero",
    "aria-label": "Patrimoine"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lib"
  }, "Patrimoine total"), mSoldes && /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, "au ", finDeMois(mSoldes))), mSoldes ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "total"
  }, eur(total(mSoldes))), mPrec && /*#__PURE__*/React.createElement("div", {
    className: "varia"
  }, eurSigne(total(mSoldes) - total(mPrec)), " depuis fin ", moisNom(mPrec)), /*#__PURE__*/React.createElement("div", {
    className: "comptes"
  }, COMPTES.map(c => /*#__PURE__*/React.createElement("div", {
    className: "compte",
    key: c
  }, /*#__PURE__*/React.createElement("span", null, c), /*#__PURE__*/React.createElement("span", null, eur((d.parMois[mSoldes].soldes || {})[c] || 0)))))) : /*#__PURE__*/React.createElement("div", {
    className: "vide"
  }, "Aucun solde saisi pour l'instant. Renseigne tes comptes dans l'onglet Mois pour suivre ton patrimoine.")), !courantSaisi && /*#__PURE__*/React.createElement("section", {
    className: "carte",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("h2", null, moisTitre(courant)), /*#__PURE__*/React.createElement("span", {
    className: "chip-etat attente"
  }, "Pas encore saisi")), /*#__PURE__*/React.createElement("div", {
    className: "petit"
  }, dernierAvant(d, courant) ? 'Les montants de ' + moisNom(dernierAvant(d, courant)) + ' seront repris : il te suffira de corriger ce qui change.' : 'Saisis tes revenus, tes dépenses et le solde de tes comptes.'), /*#__PURE__*/React.createElement("button", {
    className: "bouton",
    onClick: () => onGoMois(courant)
  }, "Saisir ", moisNom(courant))), dernierArch && /*#__PURE__*/React.createElement(CarteMois, {
    d: d,
    m: dernierArch,
    onVoir: onGoHist,
    onModifier: () => onGoMois(dernierArch)
  }), dernierArch && /*#__PURE__*/React.createElement(Sparkline, {
    d: d,
    fin: dernierArch
  }));
}

/* ---------- Mois ---------- */

function PageMois({
  d,
  mois,
  changerMois,
  dirty,
  setDirty,
  recharger,
  notifier
}) {
  const actives = d.cats.filter(c => c.actif);
  const revenus = actives.filter(c => c.type === 'revenu');
  const depenses = actives.filter(c => c.type === 'depense');
  const [vals, setVals] = useState({});
  const [sold, setSold] = useState({});
  const [reconduit, setReconduit] = useState(null);
  const [edit, setEdit] = useState(null);
  const [ajout, setAjout] = useState(null);
  const [ponct, setPonct] = useState([]);
  const [editPonct, setEditPonct] = useState(null);
  const [saving, setSaving] = useState(false);
  const etat = useRef({
    mois: null,
    dirty: false
  });
  etat.current.dirty = dirty;
  const aDesDonnees = !!d.parMois[mois];
  const source = dernierAvant(d, mois);
  function valeursDe(m) {
    const v = {};
    actives.forEach(c => {
      v[c.nom] = '';
    });
    d.arch.filter(a => a.mois === m).forEach(a => {
      if (a.categorie in v) v[a.categorie] = a.montant;
    });
    const s = {};
    COMPTES.forEach(c => {
      s[c] = '';
    });
    d.sold.filter(x => x.mois === m).forEach(x => {
      if (x.compte in s) s[x.compte] = x.montant;
    });
    return {
      v,
      s
    };
  }
  useEffect(() => {
    const memeMois = etat.current.mois === mois;
    etat.current.mois = mois;
    if (memeMois && etat.current.dirty) {
      // Données rafraîchies pendant une saisie : on garde la saisie, on ajoute les nouvelles lignes
      setVals(old => {
        const n = {};
        actives.forEach(c => {
          n[c.nom] = c.nom in old ? old[c.nom] : '';
        });
        return n;
      });
      return;
    }
    // Les dépenses ponctuelles ne sont jamais reconduites
    setPonct(d.arch.filter(x => x.mois === mois && estPonctuel(x.categorie)).map((x, i) => ({
      id: 'p' + i,
      nom: x.categorie.slice(PREFIXE_PONCT.length),
      montant: x.montant
    })));
    if (aDesDonnees || !source) {
      const r = valeursDe(mois);
      setVals(r.v);
      setSold(r.s);
      setReconduit(null);
    } else {
      const r = valeursDe(source);
      setVals(r.v);
      setSold(r.s);
      setReconduit(source);
    }
  }, [mois, d]);
  const totRev = revenus.reduce((a, c) => a + num(vals[c.nom]), 0);
  const totPonct = ponct.reduce((a, p) => a + num(p.montant), 0);
  const totDep = depenses.reduce((a, c) => a + num(vals[c.nom]), 0) + totPonct;
  const loyersFr = revenus.filter(c => estLoyersFrance(c.nom)).reduce((a, c) => a + num(vals[c.nom]), 0);
  const soldesRemplis = COMPTES.some(c => !vide(sold[c]));
  const patrimoine = COMPTES.reduce((a, c) => a + num(sold[c]), 0);
  function repartirDeZero() {
    const v = {};
    actives.forEach(c => {
      v[c.nom] = '';
    });
    const s = {};
    COMPTES.forEach(c => {
      s[c] = '';
    });
    setVals(v);
    setSold(s);
    setPonct([]);
    setReconduit(null);
    setDirty(true);
  }
  function validerPonct(p) {
    setPonct(l => l.some(x => x.id === p.id) ? l.map(x => x.id === p.id ? p : x) : l.concat([p]));
    setDirty(true);
    setEditPonct(null);
  }
  function supprimerPonct(id) {
    setPonct(l => l.filter(x => x.id !== id));
    setDirty(true);
    setEditPonct(null);
  }
  function reference(e) {
    if (!source) return null;
    if (e.kind === 'compte') {
      const x = d.sold.find(s => s.mois === source && s.compte === e.nom);
      return x ? x.montant : null;
    }
    return d.parMois[source] && d.parMois[source].cats[e.nom] || null;
  }
  function valider(valeur) {
    if (edit.kind === 'compte') setSold(s => Object.assign({}, s, {
      [edit.nom]: valeur
    }));else setVals(v => Object.assign({}, v, {
      [edit.nom]: valeur
    }));
    setDirty(true);
    setEdit(null);
  }
  async function enregistrer() {
    setSaving(true);
    try {
      const lignes = actives.map(c => ({
        categorie: c.nom,
        montant: num(vals[c.nom])
      }));
      // Conserve les montants déjà enregistrés des lignes masquées ou inconnues
      ponct.filter(p => p.nom.trim() && num(p.montant) !== 0).forEach(p => lignes.push({
        categorie: PREFIXE_PONCT + p.nom.trim(),
        montant: num(p.montant)
      }));
      d.arch.filter(a => a.mois === mois && !estPonctuel(a.categorie) && !actives.some(c => c.nom === a.categorie)).forEach(a => lignes.push({
        categorie: a.categorie,
        montant: a.montant
      }));
      await apiPost('saveArchives', {
        mois: mois,
        lignes: lignes
      });
      await apiPost('saveSoldes', {
        mois: mois,
        soldes: COMPTES.filter(c => !vide(sold[c])).map(c => ({
          compte: c,
          montant: num(sold[c])
        }))
      });
      setDirty(false);
      etat.current.dirty = false;
      setReconduit(null);
      notifier(capital(moisLong(mois)) + ' enregistré');
      await recharger(true);
    } catch (e) {
      notifier('Échec de l\'enregistrement : ' + e.message, true);
    } finally {
      setSaving(false);
    }
  }
  async function sauverCategories(liste, msg) {
    setSaving(true);
    try {
      await apiPost('saveCategories', {
        categories: liste
      });
      notifier(msg);
      await recharger(true);
    } catch (e) {
      notifier('Échec : ' + e.message, true);
    } finally {
      setSaving(false);
    }
  }
  function masquer(nom) {
    const aHisto = d.arch.some(a => a.categorie === nom && a.montant !== 0);
    const q = aHisto ? 'Masquer « ' + nom + ' » ?\n\nLes montants déjà enregistrés restent dans l\'historique. Tu pourras la réafficher depuis le menu.' : 'Supprimer « ' + nom + ' » ? Elle n\'a encore aucun montant enregistré.';
    if (!window.confirm(q)) return;
    setEdit(null);
    const liste = aHisto ? d.cats.map(c => c.nom === nom ? Object.assign({}, c, {
      actif: false
    }) : c) : d.cats.filter(c => c.nom !== nom);
    sauverCategories(liste, aHisto ? 'Ligne masquée' : 'Ligne supprimée');
  }
  function ajouter(nom, type) {
    const n = nom.trim();
    if (!n) return;
    if (d.cats.some(c => c.nom.toLowerCase() === n.toLowerCase())) {
      const ex = d.cats.find(c => c.nom.toLowerCase() === n.toLowerCase());
      if (ex.actif) {
        notifier('Cette ligne existe déjà', true);
        return;
      }
      setAjout(null);
      sauverCategories(d.cats.map(c => c === ex ? Object.assign({}, c, {
        actif: true
      }) : c), 'Ligne réaffichée');
      return;
    }
    setAjout(null);
    sauverCategories(d.cats.concat([{
      nom: n,
      type: type,
      actif: true
    }]), 'Ligne ajoutée');
  }
  const aEnregistrer = dirty || !!reconduit;
  let etatTxt = 'Aucune donnée',
    etatCls = '';
  if (saving) {
    etatTxt = 'Enregistrement…';
  } else if (dirty) {
    etatTxt = 'Brouillon non enregistré';
    etatCls = 'attente';
  } else if (reconduit) {
    etatTxt = 'Pré-rempli, non enregistré';
    etatCls = 'attente';
  } else if (aDesDonnees) {
    etatTxt = 'Enregistré';
    etatCls = 'ok';
  }
  function Rang({
    key,
    nom,
    valeur,
    couleur,
    rond,
    onClick,
    premier
  }) {
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      className: "rang",
      onClick: onClick,
      style: premier ? {
        borderTop: 'none'
      } : null
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt",
      style: {
        background: couleur,
        borderRadius: rond ? 5 : 3
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "nom"
    }, nom), /*#__PURE__*/React.createElement("span", {
      className: 'mt' + (vide(valeur) ? ' vide' : '')
    }, vide(valeur) ? '—' : eur(num(valeur))), /*#__PURE__*/React.createElement(Ico, {
      d: I.droite,
      size: 18,
      color: "var(--ink4)"
    }));
  }
  function Section({
    titre,
    total,
    cls,
    liste,
    type,
    couleur
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "section"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-tete"
    }, /*#__PURE__*/React.createElement("h2", null, titre), /*#__PURE__*/React.createElement("span", {
      className: cls
    }, eur(total))), /*#__PURE__*/React.createElement("div", {
      className: "liste"
    }, liste.map((c, i) => Rang({
      key: c.nom,
      nom: c.nom,
      valeur: vals[c.nom],
      couleur: couleur,
      premier: i === 0,
      onClick: () => setEdit({
        kind: 'cat',
        nom: c.nom,
        type: c.type
      })
    })), type === 'depense' && ponct.map((p, i) => /*#__PURE__*/React.createElement("button", {
      key: p.id,
      className: "rang",
      onClick: () => setEditPonct(p),
      style: !liste.length && i === 0 ? {
        borderTop: 'none'
      } : null
    }, /*#__PURE__*/React.createElement("span", {
      className: "pt",
      style: {
        background: 'var(--dep2)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "nom"
    }, p.nom), /*#__PURE__*/React.createElement("span", {
      className: "tag-ponct"
    }, "ponctuel"), /*#__PURE__*/React.createElement("span", {
      className: "mt"
    }, eur(num(p.montant))), /*#__PURE__*/React.createElement(Ico, {
      d: I.droite,
      size: 18,
      color: "var(--ink4)"
    }))), /*#__PURE__*/React.createElement("button", {
      className: "rang ajout",
      onClick: () => setAjout(type),
      style: liste.length || type === 'depense' && ponct.length ? null : {
        borderTop: 'none'
      }
    }, /*#__PURE__*/React.createElement(Ico, {
      d: I.plus,
      size: 18,
      sw: 2.2
    }), "Ajouter une ligne"), type === 'depense' && /*#__PURE__*/React.createElement("button", {
      className: "rang ajout",
      onClick: () => setEditPonct({
        id: 'n' + Date.now(),
        nom: '',
        montant: '',
        nouveau: true
      })
    }, /*#__PURE__*/React.createElement(Ico, {
      d: I.plus,
      size: 18,
      sw: 2.2
    }), "Dépense ponctuelle")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page avec-barre"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-mois"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => changerMois(ymAjoute(mois, -1)),
    "aria-label": "Mois précédent"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.gauche,
    sw: 2.2
  })), /*#__PURE__*/React.createElement("div", {
    className: "centre"
  }, /*#__PURE__*/React.createElement("h1", null, moisTitre(mois)), /*#__PURE__*/React.createElement("span", {
    className: 'etat ' + etatCls
  }, etatTxt)), /*#__PURE__*/React.createElement("button", {
    onClick: () => changerMois(ymAjoute(mois, 1)),
    "aria-label": "Mois suivant"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.droite,
    sw: 2.2
  }))), reconduit && /*#__PURE__*/React.createElement("div", {
    className: "bandeau info"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.refresh,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, "Montants reconduits depuis ", /*#__PURE__*/React.createElement("strong", null, moisLong(reconduit)), ". Vérifie-les puis enregistre."), /*#__PURE__*/React.createElement("button", {
    className: "mini",
    onClick: repartirDeZero
  }, "Repartir de zéro")), /*#__PURE__*/React.createElement("div", {
    className: "carte trio",
    style: {
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Revenus"), /*#__PURE__*/React.createElement("div", {
    className: "val c-rev"
  }, eur(totRev))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Dépenses"), /*#__PURE__*/React.createElement("div", {
    className: "val c-dep"
  }, eur(totDep))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lib"
  }, "Solde"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, eurSigne(totRev - totDep)))), /*#__PURE__*/React.createElement(CarteVirement, {
    loyers: loyersFr,
    dep: totDep
  }), Section({
    titre: 'Revenus',
    total: totRev,
    cls: 'c-rev',
    liste: revenus,
    type: 'revenu',
    couleur: 'var(--rev)'
  }), Section({
    titre: 'Dépenses',
    total: totDep,
    cls: 'c-dep',
    liste: depenses,
    type: 'depense',
    couleur: 'var(--dep)'
  }), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-tete"
  }, /*#__PURE__*/React.createElement("h2", null, "Comptes · fin de mois"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--barOn)'
    }
  }, soldesRemplis ? eur(patrimoine) : '—')), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, COMPTES.map((c, i) => Rang({
    key: c,
    nom: c,
    valeur: sold[c],
    couleur: 'var(--hero)',
    rond: true,
    premier: i === 0,
    onClick: () => setEdit({
      kind: 'compte',
      nom: c
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "barre-save"
  }, /*#__PURE__*/React.createElement("div", {
    className: "in"
  }, /*#__PURE__*/React.createElement("button", {
    className: "bouton",
    onClick: enregistrer,
    disabled: saving || !aEnregistrer
  }, /*#__PURE__*/React.createElement(Ico, {
    d: saving ? I.refresh : I.check,
    size: 18,
    sw: 2.4
  }), saving ? 'Enregistrement…' : aEnregistrer ? 'Enregistrer ' + moisNom(mois) : capital(moisNom(mois)) + ' enregistré'))), edit && /*#__PURE__*/React.createElement(FeuilleSaisie, {
    edit: edit,
    mois: mois,
    valeur: edit.kind === 'compte' ? sold[edit.nom] : vals[edit.nom],
    reference: reference(edit),
    source: source,
    onClose: () => setEdit(null),
    onValider: valider,
    onMasquer: edit.kind === 'cat' ? () => masquer(edit.nom) : null
  }), editPonct && /*#__PURE__*/React.createElement(FeuillePonctuel, {
    p: editPonct,
    mois: mois,
    onClose: () => setEditPonct(null),
    onValider: validerPonct,
    onSupprimer: editPonct.nouveau ? null : () => supprimerPonct(editPonct.id)
  }), ajout && /*#__PURE__*/React.createElement(FeuilleAjout, {
    type: ajout,
    onClose: () => setAjout(null),
    onAjouter: ajouter
  }));
}
function FeuilleSaisie({
  edit,
  mois,
  valeur,
  reference,
  source,
  onClose,
  onValider,
  onMasquer
}) {
  const [txt, setTxt] = useState(pourSaisie(valeur));
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.select();
      }
    }, 60);
    return () => clearTimeout(t);
  }, []);
  const sous = edit.kind === 'compte' ? 'Solde au ' + finDeMois(mois) + ' ' + mois.slice(0, 4) : (edit.type === 'depense' ? 'Dépense' : 'Revenu') + ' · ' + moisLong(mois);
  function ok() {
    onValider(txt.trim() === '' ? '' : txt.trim());
  }
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    labelId: "titre-saisie"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete",
    style: {
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-saisie"
  }, edit.nom), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, sous)), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    style: {
      background: 'var(--surface2)',
      border: 'none'
    },
    onClick: onClose,
    "aria-label": "Fermer"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 18,
    sw: 2.2
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      ok();
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "montant",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Montant"), /*#__PURE__*/React.createElement("div", {
    className: "champ"
  }, /*#__PURE__*/React.createElement("input", {
    id: "montant",
    ref: ref,
    type: "text",
    inputMode: "decimal",
    autoComplete: "off",
    enterKeyHint: "done",
    value: txt,
    onChange: e => setTxt(nettoyer(e.target.value)),
    placeholder: "0,00"
  }), /*#__PURE__*/React.createElement("span", {
    className: "eur"
  }, "€"))), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, reference !== null && reference !== undefined && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTxt(pourSaisie(reference))
  }, "Comme ", moisNom(source), " · ", eur(reference)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTxt('0,00')
  }, "Mettre à 0"), txt !== '' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTxt('')
  }, "Effacer")), /*#__PURE__*/React.createElement("div", {
    className: "deux"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bouton second",
    onClick: onClose
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "bouton"
  }, "Valider"))), onMasquer && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sep"
  }), /*#__PURE__*/React.createElement("button", {
    className: "masquer",
    onClick: onMasquer
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.oeil,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Masquer cette ligne"), /*#__PURE__*/React.createElement("span", {
    className: "petit",
    style: {
      fontSize: 12
    }
  }, "Les montants déjà enregistrés restent dans l'historique.")))));
}
function FeuillePonctuel({
  p,
  mois,
  onClose,
  onValider,
  onSupprimer
}) {
  const [nom, setNom] = useState(p.nom);
  const [txt, setTxt] = useState(pourSaisie(p.montant));
  const refNom = useRef(null),
    refMt = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const el = p.nouveau ? refNom.current : refMt.current;
      if (el) {
        el.focus();
        if (!p.nouveau) el.select();
      }
    }, 60);
    return () => clearTimeout(t);
  }, []);
  const ok = nom.trim() && num(txt) !== 0;
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    labelId: "titre-ponct"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete",
    style: {
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-ponct"
  }, p.nouveau ? 'Dépense ponctuelle' : p.nom), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, "Uniquement en ", moisLong(mois), " · non reconduite")), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    style: {
      background: 'var(--surface2)',
      border: 'none'
    },
    onClick: onClose,
    "aria-label": "Fermer"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 18,
    sw: 2.2
  }))), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (ok) onValider({
        id: p.id,
        nom: nom.trim(),
        montant: txt.trim()
      });
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "nom-ponct",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Libellé"), /*#__PURE__*/React.createElement("input", {
    id: "nom-ponct",
    ref: refNom,
    className: "champ-texte",
    value: nom,
    onChange: e => setNom(e.target.value),
    placeholder: "Ex. : Plomberie",
    autoComplete: "off"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "mt-ponct",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Montant"), /*#__PURE__*/React.createElement("div", {
    className: "champ"
  }, /*#__PURE__*/React.createElement("input", {
    id: "mt-ponct",
    ref: refMt,
    type: "text",
    inputMode: "decimal",
    autoComplete: "off",
    enterKeyHint: "done",
    value: txt,
    onChange: e => setTxt(nettoyer(e.target.value)),
    placeholder: "0,00"
  }), /*#__PURE__*/React.createElement("span", {
    className: "eur"
  }, "€"))), /*#__PURE__*/React.createElement("div", {
    className: "deux"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bouton second",
    onClick: onClose
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "bouton",
    disabled: !ok
  }, "Valider"))), onSupprimer && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "sep"
  }), /*#__PURE__*/React.createElement("button", {
    className: "masquer",
    onClick: onSupprimer
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Supprimer cette dépense"))));
}
function FeuilleAjout({
  type,
  onClose,
  onAjouter
}) {
  const [nom, setNom] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current && ref.current.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    labelId: "titre-ajout"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-ajout"
  }, type === 'depense' ? 'Nouvelle dépense' : 'Nouveau revenu'), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onAjouter(nom, type);
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "nom-ligne",
    className: "petit",
    style: {
      fontWeight: 600,
      color: 'var(--ink2)'
    }
  }, "Nom de la ligne"), /*#__PURE__*/React.createElement("input", {
    id: "nom-ligne",
    ref: ref,
    className: "champ-texte",
    value: nom,
    onChange: e => setNom(e.target.value),
    placeholder: type === 'depense' ? 'Ex. : Assurance habitation' : 'Ex. : Salaire lycée',
    autoComplete: "off"
  }), /*#__PURE__*/React.createElement("div", {
    className: "deux"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bouton second",
    onClick: onClose
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "bouton",
    disabled: !nom.trim()
  }, "Ajouter"))));
}

/* ---------- Historique ---------- */

function PageHistorique({
  d,
  onGoMois
}) {
  const [vue, setVue] = useState('mois');
  const [filtre, setFiltre] = useState('rev');
  const [sel, setSel] = useState(null);
  const [selY, setSelY] = useState(null);
  if (!d.moisArch.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "page"
    }, /*#__PURE__*/React.createElement("header", {
      className: "entete"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Historique"))), /*#__PURE__*/React.createElement("div", {
      className: "carte petit"
    }, "Aucun mois enregistré pour l'instant."));
  }

  // Mois continus du premier au dernier mois saisi
  const premier = d.moisArch[0],
    dernier = d.moisArch[d.moisArch.length - 1];
  const tous = [];
  for (let m = premier; m <= dernier; m = ymAjoute(m, 1)) tous.push(m);
  const catsRev = Array.from(new Set(d.arch.filter(a => (d.typeDe[a.categorie] || 'revenu') === 'revenu' && a.montant).map(a => a.categorie)));
  const aDepenses = d.arch.some(a => d.typeDe[a.categorie] === 'depense' && a.montant);
  const filtres = [['rev', 'Tous revenus']].concat(catsRev.map(c => [c, c]));
  if (aDepenses) filtres.push(['dep', 'Dépenses']);
  const f = filtres.some(x => x[0] === filtre) ? filtre : 'rev';
  const nomFiltre = f === 'rev' ? 'Revenus' : f === 'dep' ? 'Dépenses' : f;
  const val = m => {
    const p = d.parMois[m];
    if (!p) return 0;
    if (f === 'rev') return p.rev;
    if (f === 'dep') return p.dep;
    return p.cats[f] || 0;
  };
  const visibles = tous.slice(-24);
  const iSel = sel !== null && sel < visibles.length ? sel : visibles.length - 1;
  const max = Math.max.apply(null, tous.map(val).concat([1]));
  const annees = Array.from(new Set(tous.map(m => m.slice(0, 4))));
  const parAn = annees.map(y => {
    const ms = tous.filter(m => m.slice(0, 4) === y);
    const saisis = ms.filter(m => d.moisArch.indexOf(m) >= 0);
    return {
      y,
      tot: ms.reduce((a, m) => a + val(m), 0),
      n: saisis.length
    };
  });
  const yCourant = selY && annees.indexOf(selY) >= 0 ? selY : annees[annees.length - 1];
  const aSel = parAn.find(a => a.y === yCourant);
  const maxY = Math.max.apply(null, parAn.map(a => a.tot).concat([1]));
  const groupesAn = [];
  visibles.forEach(m => {
    const y = m.slice(0, 4);
    const g = groupesAn[groupesAn.length - 1];
    if (g && g.y === y) g.n++;else groupesAn.push({
      y,
      n: 1
    });
  });
  const premiereDep = d.moisArch.find(m => d.parMois[m].dep > 0);
  const avertissement = !premiereDep ? 'Aucune dépense n\'a encore été saisie : les soldes mensuels ne tiennent compte que des revenus.' : premiereDep > premier ? 'Avant ' + moisLong(premiereDep) + ', seuls les revenus ont été importés. Les soldes de cette période n\'incluent donc aucune dépense.' : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "entete"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Historique"))), /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "group",
    "aria-label": "Période"
  }, /*#__PURE__*/React.createElement("button", {
    "aria-pressed": vue === 'mois',
    onClick: () => setVue('mois')
  }, "Par mois"), /*#__PURE__*/React.createElement("button", {
    "aria-pressed": vue === 'annee',
    onClick: () => setVue('annee')
  }, "Par année")), avertissement && /*#__PURE__*/React.createElement("div", {
    className: "bandeau warn"
  }, /*#__PURE__*/React.createElement(IcoInfo, {
    color: "var(--warnInk)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, avertissement)), /*#__PURE__*/React.createElement("section", {
    className: "carte",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sur-titre"
  }, nomFiltre, " · ", vue === 'mois' ? 'par mois' : 'par année'), /*#__PURE__*/React.createElement("span", {
    className: "petit",
    style: {
      color: 'var(--ink2)'
    }
  }, vue === 'mois' ? capital(moisLong(visibles[iSel])) : yCourant + (aSel.n < 12 ? ' · ' + aSel.n + ' mois saisis' : '')), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: '-0.01em',
      color: 'var(--barOn)'
    }
  }, eur(vue === 'mois' ? val(visibles[iSel]) : aSel.tot))), vue === 'mois' ? /*#__PURE__*/React.createElement("div", {
    "data-noswipe": "1",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "barres"
  }, visibles.map((m, i) => /*#__PURE__*/React.createElement("button", {
    key: m,
    "aria-pressed": i === iSel,
    "aria-label": moisLong(m) + ', ' + eur(val(m)),
    onClick: () => setSel(i)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: Math.max(3, Math.round(val(m) / max * 146))
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "annees"
  }, groupesAn.map(g => /*#__PURE__*/React.createElement("span", {
    key: g.y,
    style: {
      flex: g.n + ' 1 0'
    }
  }, g.n >= 2 ? g.y : '')))) : /*#__PURE__*/React.createElement("div", {
    className: "barres-an",
    "data-noswipe": "1"
  }, parAn.map(a => /*#__PURE__*/React.createElement("button", {
    key: a.y,
    "aria-pressed": a.y === yCourant,
    "aria-label": a.y + ', ' + eur(a.tot),
    onClick: () => setSelY(a.y)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'center'
    }
  }, a.y), /*#__PURE__*/React.createElement("span", {
    className: "b",
    style: {
      height: Math.max(3, Math.round(a.tot / maxY * 150))
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "chips",
    role: "group",
    "aria-label": "Filtrer"
  }, filtres.map(x => /*#__PURE__*/React.createElement("button", {
    key: x[0],
    "aria-pressed": x[0] === f,
    onClick: () => setFiltre(x[0])
  }, x[1])))), vue === 'mois' ? annees.slice().reverse().map(y => {
    const ms = tous.filter(m => m.slice(0, 4) === y).reverse();
    return /*#__PURE__*/React.createElement("div", {
      className: "section",
      key: y
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-tete"
    }, /*#__PURE__*/React.createElement("h2", null, y), /*#__PURE__*/React.createElement("span", {
      className: f === 'dep' ? 'c-dep' : 'c-rev'
    }, eur(ms.reduce((a, m) => a + val(m), 0)))), /*#__PURE__*/React.createElement("div", {
      className: "liste"
    }, ms.map(m => /*#__PURE__*/React.createElement("button", {
      className: "hist-rang",
      key: m,
      onClick: () => onGoMois(m)
    }, /*#__PURE__*/React.createElement("span", {
      className: "l1"
    }, /*#__PURE__*/React.createElement("span", {
      className: "nom"
    }, capital(moisNom(m))), /*#__PURE__*/React.createElement("span", {
      className: "mt"
    }, val(m) ? eur(val(m)) : '—'), /*#__PURE__*/React.createElement(Ico, {
      d: I.droite,
      size: 16,
      color: "var(--ink4)"
    })), /*#__PURE__*/React.createElement("span", {
      className: "jauge"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: Math.round(val(m) / max * 100) + '%',
        background: f === 'dep' ? 'var(--dep2)' : undefined
      }
    }))))));
  }) : /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, parAn.slice().reverse().map(a => /*#__PURE__*/React.createElement("div", {
    key: a.y,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '14px 16px',
      borderTop: a.y === parAn[parAn.length - 1].y ? 'none' : '1px solid var(--line2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ligne-tete"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800
    }
  }, a.y), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800
    },
    className: f === 'dep' ? 'c-dep' : 'c-rev'
  }, eur(a.tot))), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, a.n, " mois saisis · moyenne ", eur(a.n ? a.tot / a.n : 0), " par mois")))));
}

/* ---------- Menu ---------- */

function FeuilleMenu({
  d,
  onClose,
  onRefresh,
  theme,
  setTheme,
  maj,
  onRestaurer,
  chargement
}) {
  const [ouvert, setOuvert] = useState(false);
  const masquees = d.cats.filter(c => !c.actif);
  const heure = maj ? maj.toDateString() === new Date().toDateString() ? 'aujourd\'hui à ' + maj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }) : 'le ' + maj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  }) : 'jamais';
  return /*#__PURE__*/React.createElement(Feuille, {
    onClose: onClose,
    fond: true,
    labelId: "titre-menu"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ligne-tete",
    style: {
      padding: '0 4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("h2", {
    id: "titre-menu"
  }, "Comptes"), /*#__PURE__*/React.createElement("span", {
    className: "petit"
  }, "Version ", APP_VERSION.slice(1), " · données mises à jour ", heure)), /*#__PURE__*/React.createElement("button", {
    className: "rond",
    onClick: onClose,
    "aria-label": "Fermer"
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.croix,
    size: 18,
    sw: 2.2
  }))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-rang",
    onClick: onRefresh,
    disabled: chargement
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.refresh,
    color: "var(--barOn)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, chargement ? 'Actualisation…' : 'Actualiser les données'))), /*#__PURE__*/React.createElement("a", {
    className: "menu-rang",
    href: LIENS.nominas,
    target: "_blank",
    rel: "noopener"
  }, /*#__PURE__*/React.createElement(IcoTableur, null), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Nóminas"), /*#__PURE__*/React.createElement("span", {
    className: "t2"
  }, "Feuille Google Sheets")), /*#__PURE__*/React.createElement(Ico, {
    d: I.externe,
    size: 18,
    color: "var(--ink4)"
  })), /*#__PURE__*/React.createElement("a", {
    className: "menu-rang",
    href: LIENS.impots,
    target: "_blank",
    rel: "noopener"
  }, /*#__PURE__*/React.createElement(IcoDoc, null), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Impôts"), /*#__PURE__*/React.createElement("span", {
    className: "t2"
  }, "Feuille Google Sheets")), /*#__PURE__*/React.createElement(Ico, {
    d: I.externe,
    size: 18,
    color: "var(--ink4)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "liste"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-rang",
    onClick: () => setOuvert(!ouvert),
    "aria-expanded": ouvert,
    disabled: !masquees.length
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.oeil,
    color: "var(--barOn)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Lignes masquées"), /*#__PURE__*/React.createElement("span", {
    className: "t2"
  }, masquees.length ? masquees.map(c => c.nom).join(', ') : 'Aucune')), masquees.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      transform: ouvert ? 'rotate(90deg)' : 'none',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.droite,
    size: 18,
    color: "var(--ink4)"
  }))), ouvert && masquees.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "menu-sous"
  }, masquees.map(c => /*#__PURE__*/React.createElement("div", {
    className: "it",
    key: c.nom
  }, /*#__PURE__*/React.createElement("span", null, c.nom), /*#__PURE__*/React.createElement("button", {
    onClick: () => onRestaurer(c.nom)
  }, "Réafficher")))), /*#__PURE__*/React.createElement("div", {
    className: "menu-rang",
    style: {
      flexWrap: 'wrap',
      paddingTop: 12,
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    d: I.lune,
    color: "var(--barOn)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "t1"
  }, "Apparence")), /*#__PURE__*/React.createElement("div", {
    className: "seg",
    role: "group",
    "aria-label": "Apparence",
    style: {
      width: '100%'
    }
  }, [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(x => /*#__PURE__*/React.createElement("button", {
    key: x[0],
    "aria-pressed": theme === x[0],
    onClick: () => setTheme(x[0])
  }, x[1]))))));
}

/* ---------- Application ---------- */

const ONGLETS = [{
  id: 'accueil',
  label: 'Accueil'
}, {
  id: 'mois',
  label: 'Mois'
}, {
  id: 'historique',
  label: 'Historique'
}];
function lireTheme() {
  try {
    const t = localStorage.getItem(CLE_THEME);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch (e) {
    return 'auto';
  }
}
function App() {
  const cache = useMemo(lireCache, []);
  const [raw, setRaw] = useState(cache ? cache.raw : null);
  const [maj, setMaj] = useState(cache && cache.at ? new Date(cache.at) : null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [page, setPage] = useState('accueil');
  const [mois, setMois] = useState(ymDe(new Date()));
  const [dirty, setDirty] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setThemeState] = useState(lireTheme);
  const [aujourdhui] = useState(new Date());
  const d = useMemo(() => analyser(raw), [raw]);
  const toastT = useRef(null);
  function notifier(txt, err) {
    clearTimeout(toastT.current);
    setToast({
      txt,
      err: !!err
    });
    toastT.current = setTimeout(() => setToast(null), err ? 4500 : 2200);
  }
  async function recharger(silencieux) {
    setChargement(true);
    try {
      const r = await apiGet();
      ecrireCache(r);
      setRaw(r);
      setMaj(new Date());
      setErreur(null);
      if (!silencieux) notifier('Données à jour');
    } catch (e) {
      setErreur(e.message);
      if (!silencieux || !raw) notifier('Impossible de charger les données : ' + e.message, true);
    } finally {
      setChargement(false);
    }
  }
  useEffect(() => {
    recharger(true);
  }, []);
  useEffect(() => {
    function avant(e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [dirty]);
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-theme', theme);
    try {
      if (theme === 'auto') localStorage.removeItem(CLE_THEME);else localStorage.setItem(CLE_THEME, theme);
    } catch (e) {/* rien */}
    const meta = document.querySelector('meta[name="theme-color"]');
    const sombre = theme === 'dark' || theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (meta) meta.setAttribute('content', sombre ? '#111317' : '#F3F1EC');
  }, [theme]);
  function quitterSaisie() {
    if (!dirty) return true;
    if (!window.confirm('Des montants saisis n\'ont pas été enregistrés.\n\nLes abandonner ?')) return false;
    setDirty(false);
    return true;
  }
  function allerVers(id) {
    if (id === page) return;
    if (page === 'mois' && !quitterSaisie()) return;
    setPage(id);
    window.scrollTo(0, 0);
  }
  function ouvrirMois(m) {
    if (page === 'mois' && m !== mois && !quitterSaisie()) return;
    setMois(m);
    setPage('mois');
    window.scrollTo(0, 0);
  }
  function changerMois(m) {
    if (!quitterSaisie()) return;
    setMois(m);
    window.scrollTo(0, 0);
  }
  async function restaurer(nom) {
    try {
      await apiPost('saveCategories', {
        categories: d.cats.map(c => c.nom === nom ? Object.assign({}, c, {
          actif: true
        }) : c)
      });
      notifier('« ' + nom + ' » réaffichée');
      await recharger(true);
    } catch (e) {
      notifier('Échec : ' + e.message, true);
    }
  }

  // Balayage horizontal entre onglets
  const touche = useRef(null);
  function debut(e) {
    if (menu || document.querySelector('.feuille')) {
      touche.current = null;
      return;
    }
    if (e.target.closest && e.target.closest('[data-noswipe]')) {
      touche.current = null;
      return;
    }
    const t = e.touches[0];
    touche.current = {
      x: t.clientX,
      y: t.clientY
    };
  }
  function fin(e) {
    if (!touche.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touche.current.x,
      dy = t.clientY - touche.current.y;
    touche.current = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const i = ONGLETS.findIndex(o => o.id === page);
    const j = dx < 0 ? i + 1 : i - 1;
    if (j >= 0 && j < ONGLETS.length) allerVers(ONGLETS[j].id);
  }
  if (!raw) {
    return /*#__PURE__*/React.createElement("div", {
      id: "loading"
    }, erreur ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, "Impossible de charger les données."), /*#__PURE__*/React.createElement("div", {
      className: "err"
    }, erreur), /*#__PURE__*/React.createElement("button", {
      className: "bouton",
      style: {
        marginTop: 20,
        maxWidth: 240
      },
      onClick: () => recharger(false)
    }, "Réessayer")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "spin"
    }), /*#__PURE__*/React.createElement("div", null, "Chargement des comptes…")));
  }
  const horsLigne = erreur && maj ? 'Hors ligne : données du ' + maj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  }) + '.' : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "app",
    onTouchStart: debut,
    onTouchEnd: fin
  }, /*#__PURE__*/React.createElement("main", null, page === 'accueil' && /*#__PURE__*/React.createElement(PageAccueil, {
    d: d,
    aujourdhui: aujourdhui,
    horsLigne: horsLigne,
    onMenu: () => setMenu(true),
    onGoMois: ouvrirMois,
    onGoHist: () => allerVers('historique')
  }), page === 'mois' && /*#__PURE__*/React.createElement(PageMois, {
    d: d,
    mois: mois,
    changerMois: changerMois,
    dirty: dirty,
    setDirty: setDirty,
    recharger: recharger,
    notifier: notifier
  }), page === 'historique' && /*#__PURE__*/React.createElement(PageHistorique, {
    d: d,
    onGoMois: ouvrirMois
  })), /*#__PURE__*/React.createElement("nav", {
    className: "onglets",
    "aria-label": "Navigation principale"
  }, /*#__PURE__*/React.createElement("div", {
    className: "in"
  }, ONGLETS.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.id,
    "aria-current": page === o.id ? 'page' : undefined,
    onClick: () => o.id === 'mois' && page !== 'mois' ? ouvrirMois(ymDe(aujourdhui)) : allerVers(o.id)
  }, o.id === 'accueil' && /*#__PURE__*/React.createElement(Ico, {
    d: I.maison,
    size: 24
  }), o.id === 'mois' && /*#__PURE__*/React.createElement(IcoCal, null), o.id === 'historique' && /*#__PURE__*/React.createElement(Ico, {
    d: I.histo,
    size: 24
  }), o.label)))), menu && /*#__PURE__*/React.createElement(FeuilleMenu, {
    d: d,
    onClose: () => setMenu(false),
    onRefresh: () => recharger(false),
    theme: theme,
    setTheme: setThemeState,
    maj: maj,
    onRestaurer: restaurer,
    chargement: chargement
  }), toast && /*#__PURE__*/React.createElement("div", {
    className: 'toast' + (toast.err ? ' err' : ''),
    role: "status"
  }, toast.txt));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
