(() => {
    "use strict";

    let ship;
    let bullets = [];
    let asteroids = [];
    let stars = [];
    let score = 0;
    let shields = 3;
    let wave = 1;
    let elapsed = 0;
    let spawnTimer = 0;
    let fireCooldown = 0;
    let invulnerability = 0;

    function createStarfield(api) {
        stars = Array.from({ length: 90 }, () => ({
            x: api.random(0, api.width),
            y: api.random(0, api.height),
            size: api.random(0.8, 2.5),
            alpha: api.random(0.25, 0.9),
        }));
    }

    function spawnAsteroid(api) {
        const side = Math.floor(api.random(0, 4));
        const radius = api.random(22, 46);
        let x;
        let y;

        if (side === 0) {
            x = api.random(0, api.width);
            y = -radius;
        } else if (side === 1) {
            x = api.width + radius;
            y = api.random(0, api.height);
        } else if (side === 2) {
            x = api.random(0, api.width);
            y = api.height + radius;
        } else {
            x = -radius;
            y = api.random(0, api.height);
        }

        const targetAngle =
            Math.atan2(ship.y - y, ship.x - x) + api.random(-0.42, 0.42);
        const speed = api.random(85, 135) + wave * 13;
        asteroids.push({
            x,
            y,
            radius,
            velocityX: Math.cos(targetAngle) * speed,
            velocityY: Math.sin(targetAngle) * speed,
            rotation: api.random(0, Math.PI * 2),
            rotationSpeed: api.random(-1.2, 1.2),
            health: Math.ceil(radius / 18),
        });
    }

    function fire(api) {
        if (fireCooldown > 0) {
            return;
        }

        bullets.push({
            x: ship.x + Math.cos(ship.angle) * 24,
            y: ship.y + Math.sin(ship.angle) * 24,
            velocityX: Math.cos(ship.angle) * 650,
            velocityY: Math.sin(ship.angle) * 650,
            life: 1.25,
        });
        fireCooldown = 0.18;
    }

    function refreshStats(api) {
        api.setStats([score, wave, shields]);
    }

    window.ArcadeCore.createGame({
        reset(api) {
            ship = {
                x: api.width / 2,
                y: api.height / 2,
                angle: -Math.PI / 2,
            };
            bullets = [];
            asteroids = [];
            score = 0;
            shields = 3;
            wave = 1;
            elapsed = 0;
            spawnTimer = 0.5;
            fireCooldown = 0;
            invulnerability = 2;
            createStarfield(api);
            for (let index = 0; index < 3; index += 1) {
                spawnAsteroid(api);
            }
            refreshStats(api);
        },

        onPointerDown(pointer, api) {
            ship.angle = Math.atan2(pointer.y - ship.y, pointer.x - ship.x);
            fire(api);
        },

        update(deltaTime, api) {
            elapsed += deltaTime;
            wave = 1 + Math.floor(elapsed / 18);
            fireCooldown = Math.max(0, fireCooldown - deltaTime);
            invulnerability = Math.max(0, invulnerability - deltaTime);

            let movementX = 0;
            let movementY = 0;

            if (
                api.keys.has("arrowleft") ||
                api.keys.has("a") ||
                api.keys.has("q")
            ) {
                movementX -= 1;
            }
            if (api.keys.has("arrowright") || api.keys.has("d")) {
                movementX += 1;
            }
            if (
                api.keys.has("arrowup") ||
                api.keys.has("w") ||
                api.keys.has("z")
            ) {
                movementY -= 1;
            }
            if (api.keys.has("arrowdown") || api.keys.has("s")) {
                movementY += 1;
            }

            const movementLength = Math.hypot(movementX, movementY) || 1;
            ship.x += (movementX / movementLength) * 280 * deltaTime;
            ship.y += (movementY / movementLength) * 280 * deltaTime;
            ship.x = api.clamp(ship.x, 20, api.width - 20);
            ship.y = api.clamp(ship.y, 20, api.height - 20);
            ship.angle = Math.atan2(
                api.pointer.y - ship.y,
                api.pointer.x - ship.x,
            );

            if (api.keys.has(" ") || api.pointer.down) {
                fire(api);
            }

            spawnTimer -= deltaTime;
            if (spawnTimer <= 0) {
                spawnAsteroid(api);
                spawnTimer = Math.max(0.38, 1.15 - wave * 0.08);
            }

            for (const bullet of bullets) {
                bullet.x += bullet.velocityX * deltaTime;
                bullet.y += bullet.velocityY * deltaTime;
                bullet.life -= deltaTime;
            }

            for (const asteroid of asteroids) {
                asteroid.x += asteroid.velocityX * deltaTime;
                asteroid.y += asteroid.velocityY * deltaTime;
                asteroid.rotation += asteroid.rotationSpeed * deltaTime;

                for (const bullet of bullets) {
                    if (
                        bullet.life > 0 &&
                        Math.hypot(
                            bullet.x - asteroid.x,
                            bullet.y - asteroid.y,
                        ) <
                            asteroid.radius + 4
                    ) {
                        bullet.life = 0;
                        asteroid.health -= 1;
                        if (asteroid.health <= 0) {
                            asteroid.destroyed = true;
                            score += Math.round(80 - asteroid.radius);
                            refreshStats(api);
                        }
                    }
                }

                if (
                    !asteroid.destroyed &&
                    invulnerability <= 0 &&
                    Math.hypot(
                        asteroid.x - ship.x,
                        asteroid.y - ship.y,
                    ) <
                        asteroid.radius + 16
                ) {
                    asteroid.destroyed = true;
                    shields -= 1;
                    invulnerability = 1.8;
                    refreshStats(api);

                    if (shields <= 0) {
                        api.end(
                            "Vaisseau détruit",
                            `Score final : ${score}. Tu as atteint la ` +
                                `vague ${wave}.`,
                        );
                        return;
                    }
                }
            }

            bullets = bullets.filter(
                (bullet) =>
                    bullet.life > 0 &&
                    bullet.x > -20 &&
                    bullet.x < api.width + 20 &&
                    bullet.y > -20 &&
                    bullet.y < api.height + 20,
            );
            asteroids = asteroids.filter(
                (asteroid) =>
                    !asteroid.destroyed &&
                    asteroid.x > -120 &&
                    asteroid.x < api.width + 120 &&
                    asteroid.y > -120 &&
                    asteroid.y < api.height + 120,
            );
            refreshStats(api);
        },

        draw(context, api) {
            context.fillStyle = "#07091d";
            context.fillRect(0, 0, api.width, api.height);

            for (const star of stars) {
                context.globalAlpha = star.alpha;
                context.fillStyle = "#dbeafe";
                context.fillRect(star.x, star.y, star.size, star.size);
            }
            context.globalAlpha = 1;

            for (const asteroid of asteroids) {
                context.save();
                context.translate(asteroid.x, asteroid.y);
                context.rotate(asteroid.rotation);
                context.fillStyle = "#5d607d";
                context.strokeStyle = "#9094b8";
                context.lineWidth = 3;
                context.beginPath();
                for (let point = 0; point < 9; point += 1) {
                    const angle = (point / 9) * Math.PI * 2;
                    const radius =
                        asteroid.radius * (point % 2 === 0 ? 1 : 0.82);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (point === 0) {
                        context.moveTo(x, y);
                    } else {
                        context.lineTo(x, y);
                    }
                }
                context.closePath();
                context.fill();
                context.stroke();
                context.restore();
            }

            context.fillStyle = "#f8fafc";
            context.shadowColor = "#a78bfa";
            context.shadowBlur = 18;
            for (const bullet of bullets) {
                context.beginPath();
                context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
                context.fill();
            }

            context.save();
            context.translate(ship.x, ship.y);
            context.rotate(ship.angle);
            context.globalAlpha =
                invulnerability > 0 && Math.floor(elapsed * 12) % 2 === 0
                    ? 0.35
                    : 1;
            context.fillStyle = "#a78bfa";
            context.strokeStyle = "#eee9ff";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(24, 0);
            context.lineTo(-17, -15);
            context.lineTo(-10, 0);
            context.lineTo(-17, 15);
            context.closePath();
            context.fill();
            context.stroke();
            context.restore();
            context.globalAlpha = 1;
            context.shadowBlur = 0;
        },
    });
})();
