# Prerequis : pip install moviepy pillow
from moviepy import TextClip, ImageClip, CompositeVideoClip, concatenate_videoclips, ColorClip, vfx, AudioFileClip, afx
from PIL import Image
import numpy as np
import os

# Configuration de base
DURATION_PER_MATCH = 4  # secondes par match
FADE_DURATION = 0.5  # durée du fondu d'apparition/disparition de chaque match
GAP_DURATION = 0.5  # durée de l'écran vide entre deux matchs
VIDEO_WIDTH = 800
VIDEO_HEIGHT = 600
BG_COLOR = (15, 23, 42)  # Couleur de fond (intro)
BG_MATCH_COLOR = (5, 150, 105)  # Vert émeraude (clips de match)
RESSOURCES_DIR = os.path.join(os.path.dirname(__file__), '..', 'ressources', 'clubs')
CLUB_LOGO_PATH = os.path.join(RESSOURCES_DIR, 'AMICALE BASKET PECQUENCOURT.png')

# Musique de fond
MUSIC_PATH = os.path.join(os.path.dirname(__file__), '..', 'ressources', 'audio', 'musique_fond.mp3')
MUSIC_VOLUME = 0.3  # 30% du volume d'origine, pour rester discrète
MUSIC_FADE_OUT = 1.0  # fondu de sortie en fin de vidéo (secondes)

def load_and_resize_logo(image_path, target_width=300):
    """Charge une image et la redimensionne (largeur cible, hauteur proportionnelle)"""
    try:
        img = Image.open(image_path)
        # Calculer la hauteur proportionnelle
        ratio = target_width / img.width
        new_height = int(img.height * ratio)
        # Redimensionner
        img_resized = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
        # Convertir en numpy array pour moviepy
        img_array = np.array(img_resized)
        # Charger dans moviepy
        clip = ImageClip(img_array)
        return clip
    except Exception as e:
        print(f"Erreur redimensionnement image: {image_path} - {e}")
        return None


def create_intro(logo_path):
    """Crée le clip d'introduction avec le logo du club en fondu derrière le texte"""
    duration = 3
    fade_duration = 2  # durée du fondu d'apparition du logo

    bg = ColorClip(size=(VIDEO_WIDTH, VIDEO_HEIGHT), color=BG_COLOR).with_duration(duration)

    # Logo du club en fond, en fondu progressif
    logo_bg = None
    try:
        logo_bg = load_and_resize_logo(logo_path, target_width=300)
        if logo_bg:
            logo_bg = (
                logo_bg
                .with_duration(duration)
                .with_position('center')
                .with_effects([vfx.FadeIn(fade_duration)])
            )
    except Exception as e:
        print(f"Erreur chargement logo intro: {logo_path} - {e}")

    # Zone de texte élargie (700x150) pour éviter toute troncature du texte sur 2 lignes
    # Position calculée explicitement (plutôt que 'center') pour pouvoir décaler l'ombre
    text_box_size = (700, 200)
    text_x = (VIDEO_WIDTH - text_box_size[0]) // 2
    text_y = (VIDEO_HEIGHT - text_box_size[1]) // 2
    shadow_offset = 4  # décalage de l'ombre en pixels

    txt_shadow = TextClip(
        text="Les rencontres\ndu week-end", font_size=70, color='black', size=text_box_size, text_align='center'
    ).with_duration(duration).with_position((text_x + shadow_offset, text_y + shadow_offset))

    txt = TextClip(
        text="Les rencontres\ndu week-end", font_size=70, color='orange', size=text_box_size, text_align='center'
    ).with_duration(duration).with_position((text_x, text_y))

    clips_to_compose = [bg]
    if logo_bg:
        clips_to_compose.append(logo_bg)
    clips_to_compose.append(txt_shadow)
    clips_to_compose.append(txt)

    return CompositeVideoClip(clips_to_compose, size=(VIDEO_WIDTH, VIDEO_HEIGHT))


def create_blank_clip():
    """Crée un écran vide utilisé en transition entre deux matchs"""
    return ColorClip(size=(VIDEO_WIDTH, VIDEO_HEIGHT), color=BG_COLOR).with_duration(GAP_DURATION)


def create_match_clip(category, logo_home_path, logo_away_path, date_time):
    """Crée un clip pour un match"""
    duration = DURATION_PER_MATCH

    # Fond vert émeraude
    bg = ColorClip(size=(VIDEO_WIDTH, VIDEO_HEIGHT), color=BG_MATCH_COLOR).with_duration(duration)

    # Chargement et positionnement des logos (300px de large, disposés de part et d'autre)
    # Les logos sont centrés verticalement dans une zone commune (LOGO_AREA_TOP -> +LOGO_AREA_HEIGHT),
    # car certains logos ont un ratio différent et ne font pas tous la même hauteur une fois redimensionnés.
    LOGO_AREA_TOP = 110
    LOGO_AREA_HEIGHT = 300

    logo_home = None
    try:
        logo_home = load_and_resize_logo(logo_home_path, target_width=300)
        if logo_home:
            logo_home_y = LOGO_AREA_TOP + (LOGO_AREA_HEIGHT - logo_home.h) // 2
            logo_home = logo_home.with_position((20, logo_home_y)).with_duration(duration)
    except Exception as e:
        print(f"Erreur chargement logo home: {logo_home_path} - {e}")
    
    logo_away = None
    try:
        logo_away = load_and_resize_logo(logo_away_path, target_width=300)
        if logo_away:
            logo_away_y = LOGO_AREA_TOP + (LOGO_AREA_HEIGHT - logo_away.h) // 2
            logo_away = logo_away.with_position((VIDEO_WIDTH - 300 - 20, logo_away_y)).with_duration(duration)
    except Exception as e:
        print(f"Erreur chargement logo away: {logo_away_path} - {e}")
    
    # Textes (Catégorie, VS, Date/Heure) - zones élargies, repositionnées autour des logos agrandis
    txt_cat = TextClip(text="Rencontre "+category, font="C:/Windows/Fonts/arialbd.ttf", font_size=45, color='yellow', size=(700, 90)).with_duration(duration).with_position(('center', 10))
    txt_vs = TextClip(text="VS", font_size=28, color='white', size=(200, 60)).with_duration(duration).with_position(('center', 220))
    txt_time = TextClip(text=date_time, font_size=45, color='white', size=(700, 90)).with_duration(duration).with_position(('center', 430))
    
    # Assemblage du clip pour ce match
    clips_to_compose = [bg, txt_cat, txt_vs, txt_time]
    if logo_home:
        clips_to_compose.insert(2, logo_home)
    if logo_away:
        clips_to_compose.insert(4, logo_away)
    
    return CompositeVideoClip(clips_to_compose, size=(VIDEO_WIDTH, VIDEO_HEIGHT))

# Liste des rencontres
matches = [
    {"cat": "U11F", "home": "AMICALE BASKET PECQUENCOURT.png", "away": "ONNAING JA.png", "time": "Samedi - 14h00"},
    {"cat": "U9M", "home": "AMICALE BASKET PECQUENCOURT.png", "away": "TEMPLEUVE L P.png", "time": "Samedi - 09h00"}
]

# Assemblage de la vidéo complète
clips = [create_intro(CLUB_LOGO_PATH)]
for i, m in enumerate(matches):
    home_path = os.path.join(RESSOURCES_DIR, m["home"])
    away_path = os.path.join(RESSOURCES_DIR, m["away"])
    match_clip = create_match_clip(m["cat"], home_path, away_path, m["time"])
    # Fondu d'apparition/disparition sur chaque clip de match
    match_clip = match_clip.with_effects([vfx.FadeIn(FADE_DURATION), vfx.FadeOut(FADE_DURATION)])

    if i > 0:
        clips.append(create_blank_clip())  # écran vide entre deux matchs
    clips.append(match_clip)

# Créer le répertoire de sortie s'il n'existe pas
output_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'rencontres')
os.makedirs(output_dir, exist_ok=True)

final_video = concatenate_videoclips(clips)

# Ajout de la musique de fond (bouclée pour couvrir toute la durée, volume réduit, fondu de sortie)
if os.path.exists(MUSIC_PATH):
    try:
        music = AudioFileClip(MUSIC_PATH)
        music = music.with_effects([
            afx.AudioLoop(duration=final_video.duration),
            afx.MultiplyVolume(MUSIC_VOLUME),
            afx.AudioFadeOut(MUSIC_FADE_OUT),
        ])
        final_video = final_video.with_audio(music)
    except Exception as e:
        print(f"Erreur chargement musique de fond: {MUSIC_PATH} - {e}")
else:
    print(f"Musique de fond introuvable, vidéo générée sans son: {MUSIC_PATH}")

output_path = os.path.join(output_dir, 'rencontres_weekend.mp4')
final_video.write_videofile(output_path, fps=24, audio=(final_video.audio is not None))