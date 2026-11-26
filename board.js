
"use strict";

/* =========================================================
   BOARD DIMENSIONS
   ========================================================= */

// Width and height of each tile in pixels.

const TILE_SIZE = 400;

// Position of the top-left corner of the first tile.

const BOARD_X = 380;
const BOARD_Y = 380;

const DEBUG_VERTICES = false;


/* =========================================================
   IMAGE FILENAMES
   ========================================================= */

// Map the tile names returned by the solver to PNG files.

const TILE_IMAGES = {
    "Y-tile":        "Images/Y_tile.png",
    "S-tile":        "Images/S_tile.png",
    "X-tile":        "Images/X_tile.png",
    "Tunnel tile 1": "Images/TUNNEL_1.png",
    "Tunnel tile 2": "Images/TUNNEL_2.png",
    "Mummy tile":    "Images/MUMMY.png"
};


/* =========================================================
   IMAGE LOADING
   ========================================================= */

// Store loaded images so that they do not need to be
// loaded again every time a new puzzle is drawn.

const image_cache = new Map();


/**
 * Load a PNG image and return a Promise containing the image.
 *
 * Previously loaded images are retrieved from the cache.
 */

function load_image(filename) {

    if (!image_cache.has(filename)) {

        const promise = new Promise((resolve, reject) => {

            const image = new Image();

            image.onload = () => resolve(image);

            image.onerror = () => reject(
                new Error(`Could not load ${filename}`)
            );

            image.src = filename;
        });

        image_cache.set(filename, promise);
    }

    return image_cache.get(filename);
}


/* =========================================================
   DRAW THE COMPLETE PUZZLE
   ========================================================= */

/**
 * Draw the background board and all nine tiles.
 *
 * solution is the array returned directly by solver.solve().
 *
 * Example:
 *
 * [
 *     ["Y-tile", 2],
 *     ["S-tile", 1],
 *     ...
 * ]
 *
 * If no solution is supplied, draw only the empty board.
 */

async function draw_board(solution = []) {

    const canvas = document.getElementById("board-canvas");

    const ctx = canvas.getContext("2d");


    // Load the background board.

    const background = await load_image("Images/BOARD.png");


    // Load all required tile images before drawing.
    //
    // Promise.all preserves the order of the solution array.

    const tiles = await Promise.all(

        solution.map(([name, rotation]) =>

            load_image(TILE_IMAGES[name])

        )

    );


    // Set the canvas dimensions to match the background PNG.
    //
    // Setting these dimensions also clears the canvas.

    canvas.width = background.naturalWidth;
    canvas.height = background.naturalHeight;


    // Draw the background at its original size.

    ctx.drawImage(background, 0, 0);


    // Draw each tile in row-major order.

    for (let i = 0; i < solution.length; i++) {

        const [name, rotation] = solution[i];


        // Calculate the tile's top-left position.

        const x = BOARD_X + TILE_SIZE * (i % 3);

        const y = BOARD_Y + TILE_SIZE * Math.floor(i / 3);


        // Save the current canvas transformation.

        ctx.save();


        // Move the drawing origin to the center of the tile.

        ctx.translate(
            x + TILE_SIZE / 2,
            y + TILE_SIZE / 2
        );


        // Rotate counterclockwise.
        //
        // Canvas rotation uses radians rather than degrees.
        //
        // 0 =    0 degrees
        // 1 =  -90 degrees
        // 2 = -180 degrees
        // 3 = -270 degrees

        ctx.rotate(-rotation * Math.PI / 2);


        // Draw the tile centered around the new origin.

        ctx.drawImage(
            tiles[i],
            -TILE_SIZE / 2,
            -TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE
        );


        // Restore the original coordinate system before
        // drawing the next tile.

        ctx.restore();
    }

    // Optionally display the solver's vertex numbers.

    if (DEBUG_VERTICES) {
        draw_vertex_labels(ctx);
    }
}


/**
 * Draw the solver's global vertex numbers over the board.
 *
 * This is only used for debugging.
 * It does not modify the solver or its requirements.
 */

function draw_vertex_labels(ctx) {

    ctx.save();

    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Avoid drawing shared vertices twice.
    const drawn = new Set();

    for (let cell = 0; cell < 9; cell++) {

        // Calculate the tile's top-left position.

        const x = BOARD_X + TILE_SIZE * (cell % 3);

        const y = BOARD_Y +
            TILE_SIZE * Math.floor(cell / 3);

        const half = TILE_SIZE / 2;

        // Physical coordinates of the four edge centers.
        // Order: NORTH, EAST, SOUTH, WEST.

        const positions = [
            [x + half, y],
            [x + TILE_SIZE, y + half],
            [x + half, y + TILE_SIZE],
            [x, y + half]
        ];

        // Retrieve the solver's corresponding vertices.

        const vertices = cell_vertices(cell);

        for (let direction = 0; direction < 4; direction++) {

            const vertex = vertices[direction];

            if (drawn.has(vertex)) {
                continue;
            }

            drawn.add(vertex);

            const [px, py] = positions[direction];

            // Draw a dark circle behind the number.

            ctx.beginPath();
            ctx.arc(px, py, 24, 0, 2 * Math.PI);

            ctx.fillStyle = "black";
            ctx.fill();

            // Draw the vertex number.

            ctx.fillStyle = "white";
            ctx.fillText(String(vertex), px, py);
        }
    }

    ctx.restore();
}