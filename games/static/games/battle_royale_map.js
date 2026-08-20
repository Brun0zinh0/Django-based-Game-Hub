// Génère les arènes structurées (salles, couloirs, murs) du Rogue Like
// Battle Royale. Module pur : aucune dépendance au canvas ni au DOM.
(function () {
    "use strict";

    const ARENA_PROFILES = {
        forest: {
            roomCount: [5, 7],
            roomSide: [700, 1100],
            corridorWidth: 320,
            openness: 0.45,
            extraEdges: 2,
        },
        badlands: {
            roomCount: [7, 9],
            roomSide: [500, 850],
            corridorWidth: 260,
            openness: 0.3,
            extraEdges: 3,
        },
        frost: {
            roomCount: [8, 11],
            roomSide: [450, 750],
            corridorWidth: 220,
            openness: 0.1,
            extraEdges: 3,
        },
        ruins: {
            roomCount: [4, 6],
            roomSide: [900, 1400],
            corridorWidth: 400,
            openness: 0.2,
            extraEdges: 2,
        },
    };

    const CIRCLE_MARGIN = 60;
    const ROOM_SEPARATION = 120;
    const MAX_PROPOSALS = 200;
    const MAX_ATTEMPTS = 8;
    const MINIMUM_CORRIDOR_WIDTH = 62;
    const MINIMUM_ROOMS = 3;
    const WALL_THICKNESS = 26;
    const WALL_INSET_RATIO = 0.35;

    function randomBetween(minimum, maximum) {
        return minimum + Math.random() * (maximum - minimum);
    }

    function randomInteger(minimum, maximum) {
        return Math.floor(randomBetween(minimum, maximum + 1));
    }

    function rectangleInsideCircle(rect, centerX, centerY, radius) {
        const halfWidth = rect.width / 2;
        const halfHeight = rect.height / 2;
        const corners = [
            [rect.x - halfWidth, rect.y - halfHeight],
            [rect.x + halfWidth, rect.y - halfHeight],
            [rect.x - halfWidth, rect.y + halfHeight],
            [rect.x + halfWidth, rect.y + halfHeight],
        ];
        return corners.every(
            (corner) =>
                Math.hypot(corner[0] - centerX, corner[1] - centerY) <=
                radius - CIRCLE_MARGIN,
        );
    }

    function rectanglesOverlap(first, second, separation) {
        return (
            Math.abs(first.x - second.x) * 2 <
                first.width + second.width + separation * 2 &&
            Math.abs(first.y - second.y) * 2 <
                first.height + second.height + separation * 2
        );
    }

    function pointInsideRectangle(x, y, rect) {
        return (
            x >= rect.x - rect.width / 2 &&
            x <= rect.x + rect.width / 2 &&
            y >= rect.y - rect.height / 2 &&
            y <= rect.y + rect.height / 2
        );
    }

    function placeRooms(centerX, centerY, radius, profile) {
        const target = randomInteger(
            profile.roomCount[0],
            profile.roomCount[1],
        );
        const spawnSide = randomBetween(
            profile.roomSide[0],
            profile.roomSide[1],
        );
        const rooms = [{
            id: 0,
            x: centerX,
            y: centerY,
            width: spawnSide,
            height: randomBetween(profile.roomSide[0], profile.roomSide[1]),
            isSpawn: true,
        }];

        while (rooms.length < target) {
            let placed = false;
            for (
                let attempt = 0;
                attempt < MAX_PROPOSALS && !placed;
                attempt += 1
            ) {
                const angle = randomBetween(0, Math.PI * 2);
                const distance = Math.sqrt(Math.random()) * radius;
                const candidate = {
                    id: rooms.length,
                    x: centerX + Math.cos(angle) * distance,
                    y: centerY + Math.sin(angle) * distance,
                    width: randomBetween(
                        profile.roomSide[0],
                        profile.roomSide[1],
                    ),
                    height: randomBetween(
                        profile.roomSide[0],
                        profile.roomSide[1],
                    ),
                    isSpawn: false,
                };
                if (
                    !rectangleInsideCircle(candidate, centerX, centerY, radius)
                ) {
                    continue;
                }
                const collides = rooms.some((room) =>
                    rectanglesOverlap(candidate, room, ROOM_SEPARATION),
                );
                if (collides) {
                    continue;
                }
                rooms.push(candidate);
                placed = true;
            }
            if (!placed) {
                break;
            }
        }

        return rooms;
    }

    function connectRooms(rooms, extraEdges) {
        const connected = [0];
        const pending = rooms.map((room) => room.id).slice(1);
        const edges = [];

        while (pending.length > 0) {
            let bestInside = 0;
            let bestOutsideIndex = 0;
            let bestDistance = Infinity;
            for (const insideId of connected) {
                for (let index = 0; index < pending.length; index += 1) {
                    const distance = Math.hypot(
                        rooms[insideId].x - rooms[pending[index]].x,
                        rooms[insideId].y - rooms[pending[index]].y,
                    );
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestInside = insideId;
                        bestOutsideIndex = index;
                    }
                }
            }
            const chosen = pending.splice(bestOutsideIndex, 1)[0];
            connected.push(chosen);
            edges.push([bestInside, chosen]);
        }

        const candidates = [];
        for (let first = 0; first < rooms.length; first += 1) {
            for (
                let second = first + 1;
                second < rooms.length;
                second += 1
            ) {
                const exists = edges.some(
                    (edge) =>
                        (edge[0] === first && edge[1] === second) ||
                        (edge[0] === second && edge[1] === first),
                );
                if (exists) {
                    continue;
                }
                candidates.push({
                    pair: [first, second],
                    distance: Math.hypot(
                        rooms[first].x - rooms[second].x,
                        rooms[first].y - rooms[second].y,
                    ),
                });
            }
        }
        candidates.sort((a, b) => a.distance - b.distance);
        for (
            let index = 0;
            index < Math.min(extraEdges, candidates.length);
            index += 1
        ) {
            edges.push(candidates[index].pair);
        }

        return edges;
    }

    function segmentBetween(fromX, fromY, toX, toY, width) {
        if (fromX === toX) {
            return {
                x: fromX,
                y: (fromY + toY) / 2,
                width,
                height: Math.abs(toY - fromY) + width,
            };
        }
        return {
            x: (fromX + toX) / 2,
            y: fromY,
            width: Math.abs(toX - fromX) + width,
            height: width,
        };
    }

    function carveCorridors(rooms, edges, width, centerX, centerY, radius) {
        const corridors = [];

        for (const edge of edges) {
            const from = rooms[edge[0]];
            const to = rooms[edge[1]];
            const elbows = [
                { x: to.x, y: from.y },
                { x: from.x, y: to.y },
            ];
            const elbow = rectangleInsideCircle(
                { x: elbows[0].x, y: elbows[0].y, width, height: width },
                centerX,
                centerY,
                radius,
            )
                ? elbows[0]
                : elbows[1];

            const legs = [
                segmentBetween(from.x, from.y, elbow.x, elbow.y, width),
                segmentBetween(elbow.x, elbow.y, to.x, to.y, width),
            ];
            for (const leg of legs) {
                if (leg.width > width || leg.height > width) {
                    corridors.push({
                        x: leg.x,
                        y: leg.y,
                        width: leg.width,
                        height: leg.height,
                        fromRoom: edge[0],
                        toRoom: edge[1],
                    });
                }
            }
        }

        return corridors;
    }

    function subtractIntervals(start, end, cuts) {
        let segments = [[start, end]];
        for (const cut of cuts) {
            const next = [];
            for (const segment of segments) {
                if (cut[1] <= segment[0] || cut[0] >= segment[1]) {
                    next.push(segment);
                    continue;
                }
                if (cut[0] > segment[0]) {
                    next.push([segment[0], cut[0]]);
                }
                if (cut[1] < segment[1]) {
                    next.push([cut[1], segment[1]]);
                }
            }
            segments = next;
        }
        return segments.filter((segment) => segment[1] - segment[0] > 8);
    }

    function buildWalls(rooms, corridors, openness) {
        const walls = [];
        const doors = [];

        for (const room of rooms) {
            const left = room.x - room.width / 2;
            const right = room.x + room.width / 2;
            const top = room.y - room.height / 2;
            const bottom = room.y + room.height / 2;
            const sides = [
                { axis: "x", fixed: top, from: left, to: right },
                { axis: "x", fixed: bottom, from: left, to: right },
                { axis: "y", fixed: left, from: top, to: bottom },
                { axis: "y", fixed: right, from: top, to: bottom },
            ];

            // Une porte ne s'ouvre que là où le couloir mord vraiment la
            // paroi : il doit croiser la ligne du côté ET recouvrir son
            // étendue. Sans la seconde condition, un couloir situé ailleurs
            // dans l'arène, mais aligné sur la ligne du mur prolongée à
            // l'infini, ouvre une porte fantôme rabattue sur un coin de la
            // salle, en pleine paroi pleine.
            for (const side of sides) {
                const cuts = [];
                for (const corridor of corridors) {
                    const corridorLeft = corridor.x - corridor.width / 2;
                    const corridorRight = corridor.x + corridor.width / 2;
                    const corridorTop = corridor.y - corridor.height / 2;
                    const corridorBottom = corridor.y + corridor.height / 2;
                    if (side.axis === "x") {
                        if (
                            side.fixed >= corridorTop &&
                            side.fixed <= corridorBottom &&
                            corridorRight > left &&
                            corridorLeft < right
                        ) {
                            cuts.push([corridorLeft, corridorRight]);
                            doors.push({
                                x: Math.max(
                                    left,
                                    Math.min(right, corridor.x),
                                ),
                                y: side.fixed,
                                roomId: room.id,
                                fromRoom: corridor.fromRoom,
                                toRoom: corridor.toRoom,
                            });
                        }
                    } else if (
                        side.fixed >= corridorLeft &&
                        side.fixed <= corridorRight &&
                        corridorBottom > top &&
                        corridorTop < bottom
                    ) {
                        cuts.push([corridorTop, corridorBottom]);
                        doors.push({
                            x: side.fixed,
                            y: Math.max(top, Math.min(bottom, corridor.y)),
                            roomId: room.id,
                            fromRoom: corridor.fromRoom,
                            toRoom: corridor.toRoom,
                        });
                    }
                }

                for (const segment of subtractIntervals(
                    side.from,
                    side.to,
                    cuts,
                )) {
                    if (Math.random() < openness) {
                        continue;
                    }
                    const length = segment[1] - segment[0];
                    const middle = (segment[0] + segment[1]) / 2;
                    walls.push(
                        side.axis === "x"
                            ? {
                                x: middle,
                                y: side.fixed,
                                width: length,
                                height: WALL_THICKNESS,
                                orientation: "horizontal",
                            }
                            : {
                                x: side.fixed,
                                y: middle,
                                width: WALL_THICKNESS,
                                height: length,
                                orientation: "vertical",
                            },
                    );
                }
            }
        }

        return { walls, doors };
    }

    function buildGraph(rooms, doors, edges) {
        const nodes = rooms.map((room) => ({
            id: `room-${room.id}`,
            kind: "room",
            x: room.x,
            y: room.y,
            roomId: room.id,
        }));
        const graphEdges = [];

        doors.forEach((door, index) => {
            const doorId = `door-${index}`;
            nodes.push({
                id: doorId,
                kind: "door",
                x: door.x,
                y: door.y,
                roomId: door.roomId,
                fromRoom: door.fromRoom,
                toRoom: door.toRoom,
            });
            graphEdges.push([`room-${door.roomId}`, doorId]);
        });

        for (const edge of edges) {
            const belongsToEdge = (node) =>
                (node.fromRoom === edge[0] && node.toRoom === edge[1]) ||
                (node.fromRoom === edge[1] && node.toRoom === edge[0]);
            const fromDoors = nodes.filter(
                (node) =>
                    node.kind === "door" &&
                    node.roomId === edge[0] &&
                    belongsToEdge(node),
            );
            const toDoors = nodes.filter(
                (node) =>
                    node.kind === "door" &&
                    node.roomId === edge[1] &&
                    belongsToEdge(node),
            );
            if (fromDoors.length === 0 || toDoors.length === 0) {
                continue;
            }
            let best = null;
            let bestDistance = Infinity;
            for (const fromDoor of fromDoors) {
                for (const toDoor of toDoors) {
                    const distance = Math.hypot(
                        fromDoor.x - toDoor.x,
                        fromDoor.y - toDoor.y,
                    );
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = [fromDoor.id, toDoor.id];
                    }
                }
            }
            if (best) {
                graphEdges.push(best);
            }
        }

        return { nodes, edges: graphEdges };
    }

    function findPath(graph, fromNodeId, toNodeId) {
        if (fromNodeId === toNodeId) {
            return [];
        }
        const neighbours = new Map();
        for (const edge of graph.edges) {
            if (!neighbours.has(edge[0])) {
                neighbours.set(edge[0], []);
            }
            if (!neighbours.has(edge[1])) {
                neighbours.set(edge[1], []);
            }
            neighbours.get(edge[0]).push(edge[1]);
            neighbours.get(edge[1]).push(edge[0]);
        }

        const previous = new Map([[fromNodeId, null]]);
        const queue = [fromNodeId];
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === toNodeId) {
                const path = [];
                let step = current;
                while (step && step !== fromNodeId) {
                    path.unshift(
                        graph.nodes.find((node) => node.id === step),
                    );
                    step = previous.get(step);
                }
                return path;
            }
            for (const next of neighbours.get(current) || []) {
                if (!previous.has(next)) {
                    previous.set(next, current);
                    queue.push(next);
                }
            }
        }

        return null;
    }

    function validateLayout(layout, centerX, centerY, profile) {
        if (layout.rooms.length < MINIMUM_ROOMS) {
            return "moins de trois salles";
        }
        if (profile.corridorWidth < MINIMUM_CORRIDOR_WIDTH) {
            return "couloirs trop étroits";
        }
        const spawn = layout.rooms[0];
        if (!pointInsideRectangle(centerX, centerY, spawn)) {
            return "le centre de zone est hors de la salle de départ";
        }
        for (let first = 0; first < layout.rooms.length; first += 1) {
            for (
                let second = first + 1;
                second < layout.rooms.length;
                second += 1
            ) {
                if (
                    rectanglesOverlap(
                        layout.rooms[first],
                        layout.rooms[second],
                        0,
                    )
                ) {
                    return "deux salles se chevauchent";
                }
            }
        }
        for (const room of layout.rooms) {
            if (room.id === 0) {
                continue;
            }
            if (!findPath(layout.graph, "room-0", `room-${room.id}`)) {
                return `salle ${room.id} inaccessible`;
            }
        }
        return null;
    }

    function generateArena(centerX, centerY, radius, profileId) {
        const profile = ARENA_PROFILES[profileId] || ARENA_PROFILES.forest;
        let lastFailure = "aucune tentative";

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            const rooms = placeRooms(centerX, centerY, radius, profile);
            const edges = connectRooms(rooms, profile.extraEdges);
            const corridors = carveCorridors(
                rooms,
                edges,
                profile.corridorWidth,
                centerX,
                centerY,
                radius,
            );
            const built = buildWalls(rooms, corridors, profile.openness);
            const layout = {
                rooms,
                corridors,
                walls: built.walls,
                graph: buildGraph(rooms, built.doors, edges),
            };
            const failure = validateLayout(layout, centerX, centerY, profile);
            if (!failure) {
                return layout;
            }
            lastFailure = failure;
        }

        console.warn(
            `Génération d'arène abandonnée après ${MAX_ATTEMPTS} essais : ` +
            `${lastFailure}. Retour à la disposition dispersée.`,
        );
        return null;
    }

    function findRoomAt(layout, x, y) {
        if (!layout) {
            return null;
        }
        return (
            layout.rooms.find((room) => pointInsideRectangle(x, y, room)) ||
            null
        );
    }

    // La marge est un retrait proportionnel aux murs : une grande marge ne
    // doit jamais réduire une petite salle à une boîte centrale minuscule.
    function insetExtent(halfExtent, margin) {
        return Math.max(
            20,
            halfExtent - Math.min(margin, halfExtent * WALL_INSET_RATIO),
        );
    }

    function randomPointInRoom(room, margin) {
        const insetWidth = insetExtent(room.width / 2, margin);
        const insetHeight = insetExtent(room.height / 2, margin);
        return {
            x: room.x + randomBetween(-insetWidth, insetWidth),
            y: room.y + randomBetween(-insetHeight, insetHeight),
        };
    }

    window.BattleRoyaleMap = Object.freeze({
        ARENA_PROFILES,
        generateArena,
        findRoomAt,
        findPath,
        randomPointInRoom,
    });
})();
