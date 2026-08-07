(() => {
    "use strict";

    function createGame(configuration) {
        const canvas = document.getElementById("arcade-canvas");
        if (!canvas) {
            return null;
        }

        const context = window.GameGpuRuntime
            ? window.GameGpuRuntime.create2DContext(canvas)
            : canvas.getContext("2d", {
                alpha: false,
                desynchronized: true,
            });
        if (!context) {
            return null;
        }
        const overlay = document.getElementById("arcade-overlay");
        const overlayTitle = document.getElementById("arcade-overlay-title");
        const overlayMessage = document.getElementById(
            "arcade-overlay-message",
        );
        const startButton = document.getElementById("arcade-start");
        const statusElement = document.getElementById("arcade-status");
        const statElements = [1, 2, 3].map((index) =>
            document.getElementById(`arcade-stat-${index}`),
        );

        const keys = new Set();
        const pointer = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            down: false,
        };

        let active = false;
        let lastFrame = performance.now();

        const clamp = (value, minimum, maximum) =>
            Math.max(minimum, Math.min(maximum, value));

        const random = (minimum, maximum) =>
            minimum + Math.random() * (maximum - minimum);

        const api = {
            canvas,
            context,
            keys,
            pointer,
            width: canvas.width,
            height: canvas.height,
            clamp,
            random,
            get active() {
                return active;
            },
            setStats(values) {
                values.slice(0, 3).forEach((value, index) => {
                    statElements[index].textContent = String(value);
                });
            },
            announce(message) {
                statusElement.textContent = message;
            },
            end(title, message) {
                if (!active) {
                    return;
                }

                active = false;
                pointer.down = false;
                keys.clear();
                overlayTitle.textContent = title;
                overlayMessage.textContent = message;
                startButton.textContent = "Rejouer";
                overlay.classList.remove("hidden");
                statusElement.textContent = message;
            },
        };

        function updatePointer(event) {
            const bounds = canvas.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) *
                canvas.width;
            pointer.y = ((event.clientY - bounds.top) / bounds.height) *
                canvas.height;
        }

        function startGame() {
            keys.clear();
            pointer.down = false;
            active = true;
            configuration.reset(api);
            overlay.classList.add("hidden");
            statusElement.textContent = "La partie a commencé.";
            canvas.focus();
            lastFrame = performance.now();
        }

        const controlledKeys = new Set([
            "arrowleft",
            "arrowright",
            "arrowup",
            "arrowdown",
            " ",
            "a",
            "d",
            "q",
            "s",
            "w",
            "z",
        ]);

        window.addEventListener("keydown", (event) => {
            const key = event.key.toLowerCase();
            if (active && controlledKeys.has(key)) {
                event.preventDefault();
            }
            keys.add(key);

            if (active && configuration.onKeyDown) {
                configuration.onKeyDown(key, api);
            }
        });

        window.addEventListener("keyup", (event) => {
            const key = event.key.toLowerCase();
            keys.delete(key);

            if (active && configuration.onKeyUp) {
                configuration.onKeyUp(key, api);
            }
        });

        window.addEventListener("blur", () => {
            keys.clear();
            pointer.down = false;
        });

        canvas.addEventListener("pointermove", (event) => {
            updatePointer(event);
            if (active && configuration.onPointerMove) {
                configuration.onPointerMove(pointer, api);
            }
        });

        canvas.addEventListener("pointerdown", (event) => {
            if (!active || event.button !== 0) {
                return;
            }

            updatePointer(event);
            pointer.down = true;
            canvas.setPointerCapture(event.pointerId);

            if (configuration.onPointerDown) {
                configuration.onPointerDown(pointer, api);
            }
        });

        canvas.addEventListener("pointerup", (event) => {
            pointer.down = false;
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }

            if (active && configuration.onPointerUp) {
                configuration.onPointerUp(pointer, api);
            }
        });

        canvas.addEventListener("pointercancel", () => {
            pointer.down = false;
        });

        canvas.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });

        startButton.addEventListener("click", startGame);

        function frame(timestamp) {
            const deltaTime = Math.min(
                Math.max((timestamp - lastFrame) / 1000, 0),
                0.04,
            );
            lastFrame = timestamp;

            if (active) {
                configuration.update(deltaTime, api);
            }

            configuration.draw(context, api);
            requestAnimationFrame(frame);
        }

        configuration.reset(api);
        active = false;
        requestAnimationFrame(frame);
        return api;
    }

    window.ArcadeCore = {
        createGame,
    };
})();
