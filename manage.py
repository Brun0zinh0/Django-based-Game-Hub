#!/usr/bin/env python
"""Outil en ligne de commande du projet Django."""

import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as error:
        raise ImportError(
            "Django est introuvable. Active l'environnement virtuel puis "
            "exécute : python -m pip install -r requirements.txt"
        ) from error

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

