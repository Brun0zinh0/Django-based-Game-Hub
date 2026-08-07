(() => {
    "use strict";

    const SYMBOLS = ["◆", "●", "▲", "■", "✦", "☀", "☾", "♥"];
    const CARD_WIDTH = 160;
    const CARD_HEIGHT = 100;
    const GAP_X = 22;
    const GAP_Y = 18;
    const START_X = 127;
    const START_Y = 73;

    let cards = [];
    let firstCard = null;
    let secondCard = null;
    let mismatchTimer = 0;
    let matchedPairs = 0;
    let moves = 0;
    let elapsed = 0;

    function shuffle(values) {
        for (let index = values.length - 1; index > 0; index -= 1) {
            const target = Math.floor(Math.random() * (index + 1));
            [values[index], values[target]] = [
                values[target],
                values[index],
            ];
        }
        return values;
    }

    function refreshStats(api) {
        api.setStats([
            `${matchedPairs} / 8`,
            moves,
            `${Math.floor(elapsed)} s`,
        ]);
    }

    function cardAtPoint(pointer) {
        return cards.find(
            (card) =>
                pointer.x >= card.x &&
                pointer.x <= card.x + CARD_WIDTH &&
                pointer.y >= card.y &&
                pointer.y <= card.y + CARD_HEIGHT,
        );
    }

    window.ArcadeCore.createGame({
        reset(api) {
            const symbols = shuffle([...SYMBOLS, ...SYMBOLS]);
            cards = symbols.map((symbol, index) => ({
                symbol,
                x: START_X + (index % 4) * (CARD_WIDTH + GAP_X),
                y:
                    START_Y +
                    Math.floor(index / 4) * (CARD_HEIGHT + GAP_Y),
                revealed: false,
                matched: false,
            }));
            firstCard = null;
            secondCard = null;
            mismatchTimer = 0;
            matchedPairs = 0;
            moves = 0;
            elapsed = 0;
            refreshStats(api);
        },

        onPointerDown(pointer, api) {
            if (mismatchTimer > 0 || secondCard) {
                return;
            }

            const card = cardAtPoint(pointer);
            if (!card || card.revealed || card.matched) {
                return;
            }

            card.revealed = true;

            if (!firstCard) {
                firstCard = card;
                return;
            }

            secondCard = card;
            moves += 1;

            if (firstCard.symbol === secondCard.symbol) {
                firstCard.matched = true;
                secondCard.matched = true;
                matchedPairs += 1;
                firstCard = null;
                secondCard = null;
                refreshStats(api);

                if (matchedPairs === SYMBOLS.length) {
                    api.end(
                        "Toutes les paires !",
                        `Terminé en ${moves} coups et ` +
                            `${Math.floor(elapsed)} secondes.`,
                    );
                }
            } else {
                mismatchTimer = 0.75;
                refreshStats(api);
            }
        },

        update(deltaTime, api) {
            elapsed += deltaTime;

            if (mismatchTimer > 0) {
                mismatchTimer -= deltaTime;
                if (mismatchTimer <= 0) {
                    firstCard.revealed = false;
                    secondCard.revealed = false;
                    firstCard = null;
                    secondCard = null;
                }
            }

            refreshStats(api);
        },

        draw(context, api) {
            context.fillStyle = "#151028";
            context.fillRect(0, 0, api.width, api.height);

            context.fillStyle = "rgba(232, 121, 249, 0.05)";
            for (let x = 40; x < api.width; x += 80) {
                for (let y = 30; y < api.height; y += 80) {
                    context.beginPath();
                    context.arc(x, y, 2, 0, Math.PI * 2);
                    context.fill();
                }
            }

            for (const card of cards) {
                const visible = card.revealed || card.matched;
                context.save();
                context.shadowColor = visible ? "#e879f9" : "#000000";
                context.shadowBlur = visible ? 20 : 8;
                context.fillStyle = visible ? "#342254" : "#211c3c";
                context.strokeStyle = visible ? "#e879f9" : "#51466f";
                context.lineWidth = visible ? 3 : 2;
                context.beginPath();
                context.roundRect(
                    card.x,
                    card.y,
                    CARD_WIDTH,
                    CARD_HEIGHT,
                    14,
                );
                context.fill();
                context.stroke();

                context.fillStyle = visible ? "#f8ddff" : "#756c91";
                context.font = visible
                    ? "700 42px system-ui"
                    : "700 30px system-ui";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(
                    visible ? card.symbol : "?",
                    card.x + CARD_WIDTH / 2,
                    card.y + CARD_HEIGHT / 2,
                );
                context.restore();
            }
        },
    });
})();
