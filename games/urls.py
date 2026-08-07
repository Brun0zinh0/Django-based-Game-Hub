from django.urls import path

from . import views


app_name = "games"

urlpatterns = [
    path("", views.home, name="home"),
    path("battle-royale/", views.battle_royale, name="battle_royale"),
    path("pokemon-rogue/", views.pokemon_rogue, name="pokemon_rogue"),
    path("arcade/<slug:game_slug>/", views.arcade_game, name="arcade_game"),
]
