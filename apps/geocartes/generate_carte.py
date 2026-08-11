#!/usr/bin/env python3
"""
generate_carte.py — Génère une image de carte (Nord + Pas-de-Calais par défaut)
avec des épingles (ou des logos de clubs) placées sur une liste de communes.

Deux modes d'utilisation :

1) Mode "clubs" (avec --teams) : on donne des noms de clubs adverses tels
   qu'ils apparaissent dans un fichier de configuration type teams-reduit.json
   (clé du dictionnaire "adversaires", ou son "nomcourt"). Le script va
   chercher la commune du club puis afficher son LOGO (téléchargé depuis
   l'URL "logo") à cet endroit sur la carte.

       python generate_carte.py "AMICALE BASKET PECQUENCOURT" "BREBIERES BC" \\
           --teams teams-reduit.json -o carte.png

2) Mode "communes" (sans --teams, comportement historique) : on donne
   directement des noms de communes, affichées avec une épingle rouge.

       python generate_carte.py "Pecquencourt, Brebières" -o carte.png

Dans les deux cas, la zone affichée est automatiquement recadrée (zoom) sur
l'emprise minimale contenant tous les points, avec une marge.

Données géographiques attendues dans le même dossier que ce script :
    - departement-<code>-<nom>.geojson
    - communes-<code>-<nom>.geojson
    - departements-france.geojson   (pour le mini-plan de situation)

Ces fichiers proviennent du projet open-data "france-geojson"
(https://github.com/gregoiredavid/france-geojson), sous licence Etalab 2.0.
"""

import argparse
import hashlib
import json
import math
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.offsetbox import AnnotationBbox, DrawingArea, OffsetImage
from matplotlib.patches import Circle, PathPatch, Polygon
from matplotlib.path import Path as MplPath

try:
    from PIL import Image, ImageDraw

    HAS_PIL = True
except ImportError:
    HAS_PIL = False

HERE = Path(__file__).resolve().parent
LOGO_CACHE_DIR = HERE / "logos_cache"

DEFAULT_DEPARTMENTS = [
    ("59", "nord"),
    ("62", "pas-de-calais"),
]

# ---------------------------------------------------------------------------
# Réglages visuels
# ---------------------------------------------------------------------------
COLOR_LAND = "#e9eee3"
COLOR_LAND_EDGE = "#c9d3bd"
COLOR_DEPT_BORDER = "#1a4a8a"
COLOR_SEA = "#cfe3f0"
COLOR_PIN = "#e8412c"
COLOR_PIN_EDGE = "#9c2a1a"
COLOR_TITLE = "#0d3b73"
COLOR_LABEL_TEXT = "#1a1a1a"
COLOR_BADGE_BORDER = "#1a4a8a"
COLOR_BADGE_BG = "#ffffff"

DEFAULT_LOGO_DIAMETER_PT = 54  # taille du badge logo, en points (1/72 pouce)


# ---------------------------------------------------------------------------
# Utilitaires texte
# ---------------------------------------------------------------------------
def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )


def normalize_name(s: str) -> str:
    s = strip_accents(s).lower()
    s = s.replace("-", " ").replace("'", " ")
    s = s.replace(" les ", " lez ")
    s = " ".join(s.split())
    return s


def load_geojson(path: Path) -> dict:
    if not path.exists():
        sys.exit(
            f"Erreur : fichier de données introuvable : {path}\n"
            "Assurez-vous que les fichiers .geojson sont dans le même dossier "
            "que generate_carte.py."
        )
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def iter_polygons(geometry):
    gtype = geometry["type"]
    coords = geometry["coordinates"]
    rings = []
    if gtype == "Polygon":
        rings.append(coords[0])
    elif gtype == "MultiPolygon":
        for poly in coords:
            rings.append(poly[0])
    return rings


def polygon_centroid(rings):
    biggest = max(rings, key=len)
    xs = [p[0] for p in biggest]
    ys = [p[1] for p in biggest]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def build_commune_index(communes_geojson: dict) -> dict:
    index = {}
    for feature in communes_geojson["features"]:
        nom = feature["properties"].get("nom", "")
        index[normalize_name(nom)] = feature
    return index


def find_commune(name: str, index: dict):
    key = normalize_name(name)
    if key in index:
        return index[key]
    candidates = [k for k in index if key in k or k in key]
    if len(candidates) == 1:
        return index[candidates[0]]
    if len(candidates) > 1:
        candidates.sort(key=lambda k: abs(len(k) - len(key)))
        return index[candidates[0]]
    return None


# ---------------------------------------------------------------------------
# Chargement des clubs (teams-reduit.json)
# ---------------------------------------------------------------------------
def load_teams(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"Erreur : fichier de clubs introuvable : {path}")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("adversaires", {})


def build_team_index(adversaires: dict) -> dict:
    """Indexe chaque club par son nom de clé ET son nomcourt, normalisés."""
    index = {}
    for key, club in adversaires.items():
        index[normalize_name(key)] = (key, club)
        nomcourt = club.get("nomcourt")
        if nomcourt:
            index.setdefault(normalize_name(nomcourt), (key, club))
    return index


def find_team(name: str, index: dict):
    key = normalize_name(name)
    if key in index:
        return index[key]
    candidates = [k for k in index if key in k or k in key]
    if len(candidates) == 1:
        return index[candidates[0]]
    if len(candidates) > 1:
        candidates.sort(key=lambda k: abs(len(k) - len(key)))
        return index[candidates[0]]
    return None


# ---------------------------------------------------------------------------
# Téléchargement / traitement des logos
# ---------------------------------------------------------------------------
def download_logo_bytes(url: str, timeout: int = 8):
    """Télécharge une image (avec cache disque). Renvoie des bytes ou None."""
    LOGO_CACHE_DIR.mkdir(exist_ok=True)
    cache_key = hashlib.md5(url.encode("utf-8")).hexdigest()
    for existing in LOGO_CACHE_DIR.glob(f"{cache_key}.*"):
        return existing.read_bytes()

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; carte-generator/1.0; "
                "+https://github.com/gregoiredavid/france-geojson)"
            )
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        print(f"  ! échec du téléchargement du logo ({url}) : {exc}", file=sys.stderr)
        return None

    ext = ".png"
    if "jpeg" in content_type or "jpg" in content_type:
        ext = ".jpg"
    elif "svg" in content_type:
        ext = ".svg"  # non rasterisable ici, sera ignoré au chargement PIL
    elif "webp" in content_type:
        ext = ".webp"

    (LOGO_CACHE_DIR / f"{cache_key}{ext}").write_bytes(data)
    return data


def make_circular_logo(raw_bytes: bytes, size_px: int = 240):
    """Renvoie une image PIL RGBA carrée, logo inscrit dans un cercle
    (fond blanc), prête à être affichée. None si le format n'est pas
    exploitable (ex. SVG) ou en cas d'erreur."""
    if not HAS_PIL or raw_bytes is None:
        return None
    try:
        img = Image.open(__import__("io").BytesIO(raw_bytes))
        img.load()
    except Exception:
        return None

    img = img.convert("RGBA")

    # image carrée, logo centré sur fond blanc (évite les logos "coupés"
    # si le fichier source n'est pas carré)
    side = max(img.size)
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    offset = ((side - img.width) // 2, (side - img.height) // 2)
    canvas.paste(img, offset, img)

    canvas = canvas.resize((size_px, size_px), Image.LANCZOS)

    # masque circulaire (avec anti-aliasing via sur-échantillonnage)
    ss = 4
    mask = Image.new("L", (size_px * ss, size_px * ss), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size_px * ss, size_px * ss), fill=255)
    mask = mask.resize((size_px, size_px), Image.LANCZOS)

    out = Image.new("RGBA", (size_px, size_px), (255, 255, 255, 0))
    out.paste(canvas, (0, 0), mask)
    return out


# ---------------------------------------------------------------------------
# Dessin
# ---------------------------------------------------------------------------
def draw_pin(ax, x, y, size, facecolor, edgecolor):
    """Dessine une épingle façon 'Google Maps' (goutte), pointe en (x, y)."""
    h = 0.68 * size
    r = 0.34 * size

    half_angle = math.acos(r / h)
    a1 = -math.pi / 2 + half_angle
    a2 = -math.pi / 2 - half_angle

    cx, cy = x, y + h

    def pt(theta):
        return (cx + r * math.cos(theta), cy + r * math.sin(theta))

    n = 48
    arc_thetas = [a1 + (a2 + 2 * math.pi - a1) * i / n for i in range(n + 1)]

    verts = [(x, y), pt(a1)] + [pt(t) for t in arc_thetas] + [(x, y)]
    codes = (
        [MplPath.MOVETO, MplPath.LINETO]
        + [MplPath.LINETO] * len(arc_thetas)
        + [MplPath.CLOSEPOLY]
    )

    path = MplPath(verts, codes)
    patch = PathPatch(path, facecolor=facecolor, edgecolor=edgecolor, linewidth=1.2, zorder=10)
    ax.add_patch(patch)

    hole = plt.Circle((cx, cy), r * 0.42, facecolor="white", edgecolor="none", zorder=11)
    ax.add_patch(hole)


def draw_logo_badge(ax, x, y, pil_image, diameter_pt, fallback_text=None):
    """Dessine un badge rond (logo du club) avec une pointe en bas, la pointe
    touchant exactement (x, y) — même ancrage qu'une épingle classique.

    Implémenté en deux couches superposées (limitation de matplotlib :
    une image ne peut pas être ajoutée proprement à l'intérieur d'un
    DrawingArea) :
      1) un DrawingArea (pointeur + disque de fond + bordure, et le texte
         de repli s'il n'y a pas d'image) ancré par le bas sur (x, y) ;
      2) si une image est disponible, un second AnnotationBbox contenant
         l'OffsetImage, centré exactement sur le disque du badge.
    """
    pointer_h = diameter_pt * 0.32
    pad = 3
    W = diameter_pt + 2 * pad
    H = diameter_pt + pointer_h + 2 * pad
    r = diameter_pt / 2
    cx = W / 2
    cy_circle = pad + pointer_h + r

    da = DrawingArea(W, H, 0, 0)

    tip_w = diameter_pt * 0.22
    triangle = Polygon(
        [(cx - tip_w / 2, pad + pointer_h), (cx + tip_w / 2, pad + pointer_h), (cx, pad)],
        closed=True, facecolor=COLOR_BADGE_BORDER, edgecolor=COLOR_BADGE_BORDER, linewidth=0, zorder=1,
    )
    da.add_artist(triangle)

    bg = Circle((cx, cy_circle), r, facecolor=COLOR_BADGE_BG, edgecolor=COLOR_BADGE_BORDER, linewidth=1.6, zorder=2)
    da.add_artist(bg)

    if pil_image is None and fallback_text:
        da.add_artist(
            plt.Text(
                cx, cy_circle, fallback_text, ha="center", va="center",
                fontsize=diameter_pt * 0.32, fontweight="bold", color=COLOR_BADGE_BORDER,
            )
        )

    ab_badge = AnnotationBbox(
        da, (x, y), xycoords="data", box_alignment=(0.5, 0), frameon=False, pad=0, zorder=10,
    )
    ax.add_artist(ab_badge)

    if pil_image is not None:
        # légèrement plus petit que le cercle, pour laisser voir la bordure
        img_diameter_pt = diameter_pt - 4
        zoom = img_diameter_pt / pil_image.size[0]
        oi = OffsetImage(pil_image, zoom=zoom)
        # décalage vertical du centre du disque par rapport à (x, y), en points
        offset_pts = pad + pointer_h + r
        ab_img = AnnotationBbox(
            oi, (x, y), xycoords="data",
            xybox=(0, offset_pts), boxcoords="offset points",
            box_alignment=(0.5, 0.5), frameon=False, pad=0, zorder=11,
        )
        ax.add_artist(ab_img)


def draw_label(ax, x, y, text, size):
    ax.annotate(
        text,
        xy=(x, y),
        xytext=(0, -12),
        textcoords="offset points",
        ha="center",
        va="top",
        fontsize=11,
        fontweight="bold",
        color=COLOR_LABEL_TEXT,
        zorder=12,
        bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor="#888888", linewidth=0.8),
    )


def draw_inset_locator(fig, departements_path: Path, dept_codes):
    if not departements_path.exists():
        return
    data = load_geojson(departements_path)

    ax_inset = fig.add_axes([0.78, 0.78, 0.20, 0.20])
    ax_inset.set_aspect("equal")
    ax_inset.axis("off")

    for feature in data["features"]:
        code = feature["properties"].get("code")
        rings = iter_polygons(feature["geometry"])
        is_target = code in dept_codes
        for ring in rings:
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            ax_inset.fill(
                xs, ys,
                facecolor=COLOR_DEPT_BORDER if is_target else "#e6e6e6",
                edgecolor="white", linewidth=0.3, zorder=2 if is_target else 1,
            )


def dept_file_paths(code: str, slug: str):
    dept_path = HERE / f"departement-{code}-{slug}.geojson"
    communes_path = HERE / f"communes-{code}-{slug}.geojson"
    return dept_path, communes_path


# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Génère une carte (Nord + Pas-de-Calais par défaut) avec des épingles "
        "ou des logos de clubs sur une liste de communes."
    )
    parser.add_argument(
        "items",
        nargs="*",
        help="Noms de communes (mode par défaut), ou noms de clubs si --teams est fourni "
        "(séparés par des espaces, ou une seule chaîne séparée par des virgules).",
    )
    parser.add_argument("--file", "-f", type=Path, help="Fichier texte, un nom par ligne.")
    parser.add_argument(
        "--teams", "-t", type=Path, default=None,
        help="Chemin vers un fichier type teams-reduit.json. Si fourni, les items "
        "sont interprétés comme des noms de clubs (clé ou 'nomcourt' du dictionnaire "
        "'adversaires') et leur LOGO est affiché à l'emplacement de leur commune, "
        "au lieu d'une épingle.",
    )
    parser.add_argument(
        "--logo-size", type=float, default=DEFAULT_LOGO_DIAMETER_PT,
        help=f"Diamètre des badges-logo, en points (défaut : {DEFAULT_LOGO_DIAMETER_PT}).",
    )
    parser.add_argument("--output", "-o", type=Path, default=Path("carte.png"))
    parser.add_argument("--title", default=None)
    parser.add_argument("--no-inset", action="store_true")
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--no-autozoom", action="store_true")
    parser.add_argument("--zoom-margin", type=float, default=0.25)
    parser.add_argument(
        "--departements", default=None,
        help="Départements à charger, format 'code:slug' séparés par des virgules "
        "(défaut : '59:nord,62:pas-de-calais').",
    )
    args = parser.parse_args()

    if args.teams and not HAS_PIL:
        sys.exit(
            "Le mode --teams nécessite Pillow pour traiter les logos.\n"
            "Installez-le avec : pip install Pillow"
        )

    # -- départements à charger --------------------------------------------
    if args.departements:
        dept_specs = []
        for part in args.departements.split(","):
            code, slug = part.strip().split(":")
            dept_specs.append((code.strip(), slug.strip()))
    else:
        dept_specs = DEFAULT_DEPARTMENTS

    # -- liste finale des items demandés ------------------------------------
    items_requested = []
    for item in args.items:
        items_requested.extend([c.strip() for c in item.split(",") if c.strip()])
    if args.file:
        if not args.file.exists():
            sys.exit(f"Erreur : fichier introuvable : {args.file}")
        with open(args.file, encoding="utf-8") as f:
            items_requested.extend([line.strip() for line in f if line.strip()])

    if not items_requested:
        sys.exit(
            "Aucun élément fourni. Exemple :\n"
            '  python generate_carte.py "AMICALE BASKET PECQUENCOURT, BREBIERES BC" '
            "--teams teams-reduit.json -o carte.png"
        )

    # -- charge les données géographiques ------------------------------------
    depts_data = []
    for code, slug in dept_specs:
        dept_path, communes_path = dept_file_paths(code, slug)
        dept_geo = load_geojson(dept_path)
        communes_geo = load_geojson(communes_path)
        index = build_commune_index(communes_geo)
        depts_data.append((code, slug, dept_geo, communes_geo, index))

    def locate_commune(commune_name):
        for code, slug, dept_geo, communes_geo, index in depts_data:
            feature = find_commune(commune_name, index)
            if feature is not None:
                rings = iter_polygons(feature["geometry"])
                cx, cy = polygon_centroid(rings)
                return feature["properties"].get("nom", commune_name), cx, cy
        return None

    # -- résout les items en (nom affiché, x, y, logo_bytes_or_None) --------
    found = []       # (nom, x, y, pil_image_or_None)
    not_found = []

    if args.teams:
        adversaires = load_teams(args.teams)
        team_index = build_team_index(adversaires)
        for name in items_requested:
            match = find_team(name, team_index)
            if match is None:
                not_found.append(f"{name} (club introuvable dans {args.teams.name})")
                continue
            club_key, club = match
            display_name = club.get("nomcourt", club_key)
            commune_name = club.get("commune")
            if not commune_name:
                not_found.append(f"{name} (aucune commune renseignée pour ce club)")
                continue
            loc = locate_commune(commune_name)
            if loc is None:
                not_found.append(f"{name} (commune '{commune_name}' introuvable dans les départements chargés)")
                continue
            _, cx, cy = loc
            logo_url = club.get("logo")
            pil_image = None
            if logo_url:
                raw = download_logo_bytes(logo_url)
                pil_image = make_circular_logo(raw, size_px=int(args.logo_size * 4))
                if raw is not None and pil_image is None:
                    print(f"  ! logo non exploitable pour {display_name} (format non supporté)", file=sys.stderr)
            found.append((display_name, cx, cy, pil_image))
    else:
        for name in items_requested:
            loc = locate_commune(name)
            if loc is None:
                not_found.append(name)
                continue
            nom, cx, cy = loc
            found.append((nom, cx, cy, None))

    if not_found:
        print("Attention : élément(s) non résolu(s) :\n  - " + "\n  - ".join(not_found), file=sys.stderr)
    if not found:
        sys.exit("Aucun élément valide trouvé, arrêt.")

    # -- dessine la carte -----------------------------------------------------
    fig, ax = plt.subplots(figsize=(12, 10))
    fig.patch.set_facecolor(COLOR_SEA)
    ax.set_facecolor(COLOR_SEA)

    all_dept_x, all_dept_y = [], []
    for code, slug, dept_geo, communes_geo, index in depts_data:
        for feature in communes_geo["features"]:
            for ring in iter_polygons(feature["geometry"]):
                xs = [p[0] for p in ring]
                ys = [p[1] for p in ring]
                ax.fill(xs, ys, facecolor=COLOR_LAND, edgecolor=COLOR_LAND_EDGE, linewidth=0.4, zorder=1)

        for ring in iter_polygons(dept_geo["geometry"]):
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            ax.plot(xs, ys, color=COLOR_DEPT_BORDER, linewidth=2.2, zorder=3)
            all_dept_x.extend(xs)
            all_dept_y.extend(ys)

    # -- emprise de la carte --------------------------------------------------
    pins_x = [p[1] for p in found]
    pins_y = [p[2] for p in found]

    ASPECT = 1.55
    FIG_W, FIG_H = 12, 10

    if args.no_autozoom:
        min_x, max_x = min(all_dept_x), max(all_dept_x)
        min_y, max_y = min(all_dept_y), max(all_dept_y)
        margin_x = (max_x - min_x) * 0.06
        margin_y = (max_y - min_y) * 0.06
        half_x = (max_x - min_x) / 2 + margin_x
        half_y = (max_y - min_y) / 2 + margin_y
        cx0, cy0 = (max_x + min_x) / 2, (max_y + min_y) / 2
    else:
        span_x = max(pins_x) - min(pins_x)
        span_y = max(pins_y) - min(pins_y)
        min_span = max((max(all_dept_x) - min(all_dept_x)) * 0.08, 0.03)
        span_x = max(span_x, min_span)
        span_y = max(span_y, min_span)
        half_x = span_x / 2 * (1 + args.zoom_margin)
        half_y = span_y / 2 * (1 + args.zoom_margin)
        cx0, cy0 = (max(pins_x) + min(pins_x)) / 2, (max(pins_y) + min(pins_y)) / 2

    target_ratio = (FIG_W * ASPECT) / FIG_H
    current_ratio = half_x / half_y if half_y else target_ratio
    if current_ratio < target_ratio:
        half_x = half_y * target_ratio
    else:
        half_y = half_x / target_ratio

    ax.set_xlim(cx0 - half_x, cx0 + half_x)
    ax.set_ylim(cy0 - half_y, cy0 + half_y)
    ax.set_aspect(ASPECT, adjustable="box")
    ax.axis("off")

    xlim = ax.get_xlim()
    ylim = ax.get_ylim()
    span_shown = max(xlim[1] - xlim[0], ylim[1] - ylim[0])
    pin_size = span_shown * 0.045

    for nom, cx, cy, pil_image in found:
        if args.teams:
            initials = "".join(w[0] for w in nom.split()[:2]).upper()
            draw_logo_badge(ax, cx, cy, pil_image, args.logo_size, fallback_text=initials)
        else:
            draw_pin(ax, cx, cy, pin_size, COLOR_PIN, COLOR_PIN_EDGE)
        draw_label(ax, cx, cy, nom, pin_size)

    title = args.title
    if title is None:
        title = " & ".join(f"{slug.replace('-', ' ').title()} ({code})" for code, slug, *_ in depts_data)
    ax.text(0.02, 0.97, title, transform=ax.transAxes, fontsize=20, fontweight="bold", color=COLOR_TITLE, va="top", ha="left")

    if not args.no_inset:
        draw_inset_locator(fig, HERE / "departements-france.geojson", {c for c, s, *_ in depts_data})

    fig.savefig(args.output, dpi=args.dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    print(f"Carte générée : {args.output}")
    if not_found:
        print("(éléments ignorés, voir avertissements ci-dessus)")


if __name__ == "__main__":
    main()
