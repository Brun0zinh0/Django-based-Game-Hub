from django.urls import path

from . import views


app_name = "games"

urlpatterns = [
    path("", views.home, name="home"),
    path("battle-royale/", views.battle_royale, name="battle_royale"),
    path("pokemon-rogue/", views.pokemon_rogue, name="pokemon_rogue"),
    path("terra-boss/", views.terra_boss, name="terra_boss"),
    path("arcade/<slug:game_slug>/", views.arcade_game, name="arcade_game"),
    # Dev only; the view 404s unless DEBUG.
    path("anim-capture/", views.save_anim_capture, name="save_anim_capture"),
]
