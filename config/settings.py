"""Configuration du projet Mini-jeux."""

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

# Cette clé convient uniquement à l'apprentissage en local.
SECRET_KEY = "django-insecure-mini-jeux-apprentissage-local"

DEBUG = True

ALLOWED_HOSTS = []

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "games",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# En memoire, pas dans un fichier. Ce projet ne se sert jamais d'une base :
# aucun modele, aucune migration, et les sessions vivent dans un cookie signe
# (voir SESSION_ENGINE plus bas). Le fichier db.sqlite3 n'existait donc que
# pour etre cree au demarrage -- et sur un poste ou le dossier du depot n'est
# pas inscriptible, SQLite echoue avec "unable to open database file" et le
# serveur refuse de demarrer, pour une base dont personne ne lit rien.
#
# Si un jour un modele apparait, il faudra repasser a BASE_DIR / "db.sqlite3" :
# une base en memoire est videe a chaque arret du serveur.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Les données du jeu sont conservées dans un cookie signé. Cela permet
# d'apprendre les sessions sans avoir besoin de créer une table en base.
SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [
    ("sounds", BASE_DIR / "sounds"),
]
