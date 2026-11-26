
"use strict";

/* =====================================================================
   EGYPTIAN PUZZLE SOLVER

   This solver arranges nine tiles on a 3 x 3 board while satisfying
   a set of required and forbidden connections between characters.

   The main techniques used are:

       1. Bitsets to represent groups of connected vertices.
       2. Precomputed tile placements.
       3. Recursive backtracking.
       4. Early rejection of illegal placements.
       5. Minimum remaining values (MRV) cell selection.
       6. Memoization of unsuccessful board arrangements.

   No external libraries are required.
   ===================================================================== */


/* =====================================================================
   1. PUZZLE CONSTANTS
   ===================================================================== */

// Number of cells and vertices on the puzzle board.
//
// Cells are numbered in row-major order:
//
//       0   1   2
//       3   4   5
//       6   7   8
//
// Vertices represent the endpoints of paths on the edges of tiles,
// together with two special vertices representing the tunnel and mummy.

const NUM_CELLS = 9;
const NUM_VERTS = 29;


// Local directions relative to an unrotated tile.

const NORTH = 0;
const EAST  = 1;
const SOUTH = 2;
const WEST  = 3;


// Special vertices.
//
// Both tunnel tiles share vertex 27. Consequently, their tunnel
// entrances are connected even when the tiles are not adjacent.
//
// The mummy is represented by vertex 28.

const TUNNEL = 27;
const MUMMY  = 28;


// Maps character names to their corresponding board vertices.
//
// Character names supplied to the solver must match these keys.

const CHARACTERS = {
    ARCHAEOLOGIST: 0,
    MAP:           3,
    SARCOPHAGUS:   4,
    PRINCESS:      7,
    CAMEL:         8,
    CITY:         11,
    TREASURE:     12,
    PYRAMIDS:     13,
    CROCODILE:    14,
    EXPLORER:     24,
    OASIS:        25,
    SPHINX:       26,
    MUMMY:        MUMMY
};


// Each tile definition contains:
//
// [
//     Tile name,
//     Groups of connected directions or special vertices,
//     List of distinct rotations,
//     Number of copies available
// ]
//
// Directions within the same group are connected.
//
// Directions in separate groups are NOT connected unless they
// subsequently become connected through other tiles.
//
// Any direction absent from all groups is a blocked edge.
//
// Symmetrical tiles do not need to be tested at all four rotations.

const TILE_TYPES = [

    [
        "Y-tile",
        [[EAST, SOUTH, WEST]],
        [0, 1, 2, 3],
        3
    ],

    [
        "S-tile",
        [[NORTH, WEST], [SOUTH, EAST]],
        [0, 1],
        2
    ],

    [
        "X-tile",
        [[NORTH, EAST, SOUTH, WEST]],
        [0],
        1
    ],

    [
        "Tunnel tile 1",
        [[NORTH, TUNNEL], [EAST, SOUTH, WEST]],
        [0, 1, 2, 3],
        1
    ],

    [
        "Tunnel tile 2",
        [[NORTH, TUNNEL], [EAST, WEST]],
        [0, 1, 2, 3],
        1
    ],

    [
        "Mummy tile",
        [[NORTH, EAST, SOUTH, WEST, MUMMY]],
        [0],
        1
    ]
];


// Global edge vertices of the first cell.
//
// Array order: [NORTH, EAST, SOUTH, WEST].
//
// Moving one cell to the right increases each vertex by 1.
// Moving one cell down increases each vertex by 4.
//
// Adjacent tiles must share the same global vertex at
// their common edge.
//
// For example:
// Cell 0 EAST = 1
// Cell 1 WEST = 1

const HOME_VERTS = [12, 1, 16, 0];


// Initial inventory of tiles.
//
// Result: [3, 2, 1, 1, 1, 1]

const INITIAL_INVENTORY = TILE_TYPES.map(tile => tile[3]);


// Verify that the number of available tiles matches the board size.

if (
    INITIAL_INVENTORY.reduce((sum, count) => sum + count, 0)
    !== NUM_CELLS
) {
    throw new Error("Tile inventory does not match board size.");
}


/* =====================================================================
   2. BITSET UTILITIES
   ===================================================================== */

/**
 * Convert a collection of vertex numbers into a single integer.
 *
 * Each bit represents one vertex.
 *
 * For example:
 *
 *     bits([0, 2, 4])
 *
 * produces:
 *
 *     Binary:  10101
 *     Decimal: 21
 *
 * Bitsets allow us to perform many operations on entire groups
 * of vertices using a single bitwise operation.
 *
 * JavaScript bitwise operators use 32-bit integers.
 * Our highest vertex is 28, so all our bitsets fit safely.
 */

function bits(values) {

    let result = 0;

    for (const value of values) {

        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value >= NUM_VERTS
        ) {
            throw new Error(`Invalid vertex number: ${value}`);
        }

        // Set the bit corresponding to this vertex.
        //
        // OR is used instead of addition so that duplicate
        // vertices cannot accidentally corrupt the bitset.

        result |= 1 << value;
    }

    return result;
}


/**
 * Convert an array of character names into a vertex bitset.
 *
 * Example:
 *
 *     character_bits(["MAP", "TREASURE"])
 *
 * Unknown character names generate an explicit error rather
 * than silently producing an incorrect vertex.
 */

function character_bits(names) {

    if (!Array.isArray(names) || names.length === 0) {
        throw new Error(
            "Character groups must be non-empty arrays."
        );
    }

    return bits(names.map(name => {

        if (
            !Object.prototype.hasOwnProperty.call(
                CHARACTERS, name
            )
        ) {
            throw new Error(`Unknown character: ${name}`);
        }

        return CHARACTERS[name];
    }));
}


/**
 * Convert a bitset back into an array of vertex numbers.
 *
 * This is primarily useful for debugging.
 *
 * Example:
 *
 *     get_vertices(21)
 *
 * returns:
 *
 *     [0, 2, 4]
 */

function get_vertices(mask) {

    const vertices = [];

    for (let vertex = 0; vertex < NUM_VERTS; vertex++) {

        if (mask & (1 << vertex)) {
            vertices.push(vertex);
        }
    }

    return vertices;
}


/* =====================================================================
   3. MERGING CONNECTED PATHS
   ===================================================================== */

/**
 * Merge a new path into an array of existing connected components.
 *
 * Each path is represented by a bitset.
 *
 * If two paths share at least one vertex, they belong to the
 * same connected component and can be merged using bitwise OR.
 *
 * IMPORTANT:
 *
 * The existing components must already be mutually disjoint.
 * That means no two existing components share a vertex.
 *
 * This invariant allows us to merge a new path in one pass.
 *
 * The supplied array is modified directly. Callers should pass
 * a copy if the original array must be preserved.
 */

function merge_path(paths, new_path) {

    // Work backwards so that removing an element does not
    // interfere with the remaining array indices.

    for (let i = paths.length - 1; i >= 0; i--) {

        // A nonzero intersection means that these paths
        // share at least one vertex.

        if ((paths[i] & new_path) !== 0) {

            // Combine both sets of vertices.

            new_path |= paths[i];

            // Remove the old component. It is now represented
            // by the combined path.

            paths.splice(i, 1);
        }
    }

    // Store the resulting connected component.

    paths.push(new_path);
}


/* =====================================================================
   4. TILE AND BOARD CLASSES
   ===================================================================== */

/**
 * Represents a particular tile at a particular board location
 * and rotation.
 *
 * All vertex numbers are global board vertex numbers.
 *
 * These objects are precomputed once and reused throughout
 * the search.
 */

class Tile {

    constructor(paths, dead) {

        // Array of connected path bitsets.

        this.paths = paths;

        // Bitset of blocked or unused edge vertices.

        this.dead = dead;

        // Combined bitset containing every active vertex.
        //
        // This allows incompatible edges to be detected
        // before attempting to merge paths.

        this.active = paths.reduce(
            (combined, path) => combined | path,
            0
        );
    }
}


/**
 * Represents the current state of a partially completed board.
 *
 * The board does not store the actual tile arrangement.
 * That is maintained separately by the recursive search.
 *
 * Instead, it stores the information needed to determine
 * whether additional tiles can legally be placed.
 */

class Board {

    constructor(
        paths = [],
        dead = 0,
        inventory = [...INITIAL_INVENTORY],
        active = 0
    ) {

        // Mutually disjoint connected path components.

        this.paths = paths;

        // All blocked vertices encountered so far.

        this.dead = dead;

        // Number of remaining tiles of each type.

        this.inventory = inventory;

        // All active vertices encountered so far.

        this.active = active;
    }
}


/* =====================================================================
   5. PRECOMPUTE ALL POSSIBLE TILE PLACEMENTS
   ===================================================================== */

/**
 * Rotate a tile direction counterclockwise.
 *
 * Directions:
 *     0 = NORTH
 *     1 = EAST
 *     2 = SOUTH
 *     3 = WEST
 *
 * Rotations:
 *     0 =   0 degrees
 *     1 = -90 degrees
 *     2 = -180 degrees
 *     3 = -270 degrees
 *
 * This matches the canvas renderer:
 *
 *     ctx.rotate(-rotation * Math.PI / 2);
 *
 * TUNNEL and MUMMY are special global vertices.
 * They are not affected by tile rotation or placement.
 */


/**
 * Return the four global edge vertices of a board cell.
 *
 * Cells are numbered from left to right, top to bottom:
 *
 *     0   1   2
 *     3   4   5
 *     6   7   8
 *
 * Returned order:
 *
 *     [NORTH, EAST, SOUTH, WEST]
 *
 * Adjacent cells share the same vertex at their
 * common edge.
 */


function rotate_direction(direction, rotation) {
    return direction < 4
        ? (direction - rotation + 4) % 4
        : direction;
}


/**
 * Generate every distinct tile orientation for every board cell.
 *
 * There are 16 distinct tile orientations:
 *
 *     Y-tile:         4
 *     S-tile:         2
 *     X-tile:         1
 *     Tunnel tile 1:  4
 *     Tunnel tile 2:  4
 *     Mummy tile:     1
 *
 * With nine board cells, this gives 144 precomputed placements.
 *
 * The result is small enough that there is no reason to store
 * it in a file or browser storage.
 */

function cell_vertices(cell) {

    const row = Math.floor(cell / 3);
    const col = cell % 3;

    const north = 12 + 4 * row + col;
    const east  =      4 * row + col + 1;
    const south = 16 + 4 * row + col;
    const west  =      4 * row + col;

    return [north, east, south, west];
}

function make_tiles() {

    const result = [];

    for (let cell = 0; cell < NUM_CELLS; cell++) {

        const options = [];

        // Calculate the global vertex numbers for the
        // four edges of this board cell.

        const local = cell_vertices(cell);

        // Try every tile type.

        for (
            let tile_type = 0;
            tile_type < TILE_TYPES.length;
            tile_type++
        ) {

            const [, groups, rotations] = TILE_TYPES[tile_type];


            // Try every distinct rotation of this tile.

            for (const rotation of rotations) {

                const paths = [];

                // Four-bit mask identifying which local
                // directions are used by the tile.

                let used = 0;


                // Convert each connected group into a
                // bitset of global board vertices.

                for (const group of groups) {

                    let path = 0;

                    for (const direction of group) {

                        const rotated = rotate_direction(
                            direction,
                            rotation
                        );

                        if (rotated < 4) {

                            // Mark this local edge as active.

                            used |= 1 << rotated;

                            // Add its global vertex to the path.

                            path |= 1 << local[rotated];

                        } else {

                            // Special vertices do not depend
                            // on the tile's location.

                            path |= 1 << rotated;
                        }
                    }

                    paths.push(path);
                }


                // Identify blocked edges.
                //
                // Any of the four local directions not used
                // by a path is considered blocked.

                let dead = 0;

                for (let direction = 0; direction < 4; direction++) {

                    if (!(used & (1 << direction))) {

                        dead |= 1 << local[direction];
                    }
                }


                // Store this placement.
                //
                // Each distinct orientation receives an ID
                // from 1 through 16.
                //
                // ID 0 is reserved for an empty cell.
                //
                // These IDs will later be used to generate
                // compact numeric cache keys.

                options.push({
                    id: options.length + 1,
                    tile_type: tile_type,
                    rotation: rotation,
                    tile: new Tile(paths, dead)
                });
            }
        }

        result.push(options);
    }

    return result;
}


// Generate all tile placements once when this script loads.

const TILES = make_tiles();


// The cache key uses one digit per board cell.
//
// There are 16 tile orientation IDs plus the empty-cell ID,
// so the key is represented as a base-17 integer.

const KEY_BASE = TILES[0].length + 1;


// Precompute the positional value of each cell.
//
// These values allow the cache key to be updated incrementally
// instead of recalculating it from the entire placement array.

const CELL_WEIGHTS = Array.from(
    { length: NUM_CELLS },
    (_, cell) => KEY_BASE ** cell
);


// Ensure numeric cache keys remain exact JavaScript integers.

if (!Number.isSafeInteger(KEY_BASE ** NUM_CELLS - 1)) {
    throw new Error("Board is too large for numeric cache keys.");
}


/* =====================================================================
   6. ADDING TILES TO THE BOARD
   ===================================================================== */

/**
 * Determine whether a tile can be placed without producing
 * incompatible edges.
 *
 * There are two possible conflicts:
 *
 *     1. A new active edge meets an existing blocked edge.
 *
 *     2. A new blocked edge meets an existing active edge.
 *
 * Both can be detected using bitwise intersections.
 *
 * Two active edges are compatible.
 * Two blocked edges are also compatible.
 */

function incompatible_edges(board, tile) {

    return (
        (board.dead & tile.active) !== 0 ||
        (board.active & tile.dead) !== 0
    );
}


/**
 * Add a tile to the current board.
 *
 * Returns a new Board object if successful.
 * Returns null if the tile cannot legally be placed.
 *
 * The original board is never modified.
 *
 * This is essential for recursive backtracking because
 * several alternative placements may share the same
 * original board state.
 */

function add_tile(board, tile, tile_type) {

    // Reject unavailable tiles.

    if (board.inventory[tile_type] <= 0) {
        return null;
    }


    // Reject incompatible edges BEFORE allocating arrays
    // or attempting to merge connected components.

    if (incompatible_edges(board, tile)) {
        return null;
    }


    // Copy the existing connected components.
    //
    // Since each component is an integer, a shallow copy
    // is sufficient.

    const paths = [...board.paths];


    // Merge each of the new tile's connected components
    // into the existing board components.

    for (const path of tile.paths) {
        merge_path(paths, path);
    }


    // Copy and update the tile inventory.

    const inventory = [...board.inventory];

    inventory[tile_type]--;


    // Return a new board containing the updated state.

    return new Board(
        paths,
        board.dead | tile.dead,
        inventory,
        board.active | tile.active
    );
}


/* =====================================================================
   7. RANDOMIZATION
   ===================================================================== */

/**
 * Randomly shuffle an array in place.
 *
 * This uses the Fisher-Yates algorithm, which produces an
 * unbiased random permutation when supplied with uniform
 * random numbers.
 *
 * Randomization allows the solver to return different valid
 * solutions when more than one solution exists.
 */

function shuffle(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        const temporary = array[i];

        array[i] = array[j];
        array[j] = temporary;
    }

    return array;
}


/* =====================================================================
   8. SOLVER CLASS
   ===================================================================== */

class Solver {

    /**
     * Create a solver with a particular set of requirements.
     *
     * requirements must have the following structure:
     *
     * [
     *     connected,
     *     disconnected
     * ]
     *
     * Example:
     *
     * [
     *     [
     *         ["MAP", "TREASURE"],
     *         ["PRINCESS", "CITY"]
     *     ],
     *     [
     *         [["MUMMY"], ["ARCHAEOLOGIST", "PRINCESS"]]
     *     ]
     * ]
     *
     * Optional settings:
     *
     *     randomize: true or false
     *     memoize:   true or false
     *     verbose:   true or false
     */

    constructor(requirements, options = {}) {

        if (
            !Array.isArray(requirements) ||
            requirements.length !== 2
        ) {
            throw new Error(
                "Requirements must contain connected and disconnected arrays."
            );
        }

        const [connected, disconnected] = requirements;

        if (
            !Array.isArray(connected) ||
            !Array.isArray(disconnected)
        ) {
            throw new Error("Invalid requirements.");
        }


        // Store solver settings.
        //
        // The nullish coalescing operator (??) supplies
        // a default only when the option is null or undefined.

        this.randomize = options.randomize ?? true;
        this.memoize = options.memoize ?? true;
        this.verbose = options.verbose ?? true;


        /* -------------------------------------------------------------
           Required connections
           ------------------------------------------------------------- */

        this.connections = [];


        // Merge overlapping required connection groups.
        //
        // For example:
        //
        //     ["MAP", "TREASURE"]
        //     ["TREASURE", "PRINCESS"]
        //
        // logically implies:
        //
        //     ["MAP", "TREASURE", "PRINCESS"]
        //
        // Merging these groups improves contradiction detection
        // and avoids redundant connection checks.

        for (const group of connected) {

            merge_path(
                this.connections,
                character_bits(group)
            );
        }


        // Combined bitset of all vertices that must be active.
        //
        // If any of these vertices becomes blocked, the board
        // can never satisfy its required connections.

        this.required_active = this.connections.reduce(
            (combined, path) => combined | path,
            0
        );

        /* -------------------------------------------------------------
        Forbidden connections
        ------------------------------------------------------------- */

        // Each disconnection rule must contain exactly two character
        // groups, A and B.
        //
        // No character in group A may be connected to ANY character
        // in group B.
        //
        // Characters within the same group may connect to each other,
        // provided no other disconnection rule prohibits it.
        //
        // Convert each group into a bitset for efficient comparison.

        this.disconnections = disconnected.map((rule, index) => {

            // Validate that the rule contains exactly two groups.

            if (!Array.isArray(rule) || rule.length !== 2) {
                throw new Error(
                    `Disconnection rule ${index + 1} must contain exactly two character groups.`
                );
            }

            // Convert both character groups into bitsets.
            //
            // character_bits() also validates that each group is
            // a non-empty array containing valid character names.

            const group_a = character_bits(rule[0]);
            const group_b = character_bits(rule[1]);

            // A character cannot belong to both sides of a
            // disconnection rule.

            if (group_a & group_b) {
                throw new Error(
                    `Disconnection rule ${index + 1} contains overlapping character groups.`
                );
            }

            return [group_a, group_b];
            
        });


        // Stores numeric keys of placements that have already
        // been proven incapable of producing a solution.

        this.failed = new Set();


        // Statistics from the most recent solve.

        this.stats = {};

        this.last_error = null;
    }

    /* -----------------------------------------------------------------
    CHECK FOR FORBIDDEN CONNECTIONS
    ----------------------------------------------------------------- */

    /**
     * Returns true if any connected path contains at least one
     * character from each of the two groups in a disconnection rule.
     *
     * For example, the rule:
     *
     *     [
     *         ["MUMMY", "CROCODILE"],
     *         ["PRINCESS", "ARCHAEOLOGIST"]
     *     ]
     *
     * prohibits ALL of the following connections:
     *
     *     MUMMY     <-> PRINCESS
     *     MUMMY     <-> ARCHAEOLOGIST
     *     CROCODILE <-> PRINCESS
     *     CROCODILE <-> ARCHAEOLOGIST
     *
     * Connections between characters within the same group
     * are not prohibited by this rule.
     *
     * A bitwise AND returns a nonzero value if a path contains
     * ANY member of the specified character group.
     */

    illegal_connection(board) {

        // Examine every connected component on the board.

        for (const path of board.paths) {

            // Examine each pair of mutually disconnected groups.

            for (const [group_a, group_b] of this.disconnections) {

                // A forbidden connection exists if this path
                // contains at least one member of BOTH groups.

                if ((path & group_a) && (path & group_b)) {
                    return true;
                }
            }
        }

        // No connected component violates a disconnection rule.

        return false;
    }


    /* -----------------------------------------------------------------
       CHECK FOR REQUIRED CONNECTIONS
       ----------------------------------------------------------------- */

    /**
     * Returns true if every required connection group is
     * completely contained within a connected board component.
     *
     * Unlike forbidden connections, merely intersecting a
     * required group is insufficient.
     *
     * Every vertex in the required group must be present.
     */

    all_connections_made(board) {

        return this.connections.every(required =>

            board.paths.some(path =>

                (path & required) === required

            )
        );
    }


    /* -----------------------------------------------------------------
    CHECK FOR CONTRADICTORY REQUIREMENTS
    ----------------------------------------------------------------- */

    /**
     * Returns true if any required connection violates a
     * disconnection rule.
     *
     * Overlapping required connection groups have already been
     * merged by the constructor, so this also detects indirect
     * contradictions.
     *
     * For example:
     *
     *     Required:  MAP <-> TREASURE
     *     Required:  TREASURE <-> PRINCESS
     *     Forbidden: MAP <-> PRINCESS
     *
     * These requirements are contradictory because connectivity
     * is transitive.
     *
     * Treat each required connection group as an existing
     * connected component and reuse illegal_connection().
     */

    contradictory_requirements() {

        return this.illegal_connection({
            paths: this.connections
        });
    }


    /* -----------------------------------------------------------------
       SOLVE THE PUZZLE
       ----------------------------------------------------------------- */

    /**
     * Public entry point for the solver.
     *
     * Returns:
     *
     *     An array of nine [tile name, rotation] pairs
     *
     * or:
     *
     *     null if no solution exists.
     *
     * The returned array is always in row-major order.
     */

    solve() {

        const start = performance.now();


        // Reset state so that the same Solver object can
        // safely be used to solve the puzzle multiple times.

        this.failed.clear();

        this.last_error = null;

        this.stats = {
            search_calls: 0,
            placements_tested: 0,
            inventory_rejections: 0,
            edge_rejections: 0,
            blocked_character_rejections: 0,
            forbidden_connection_rejections: 0,
            cache_hits: 0,
            failed_states: 0,
            max_depth: 0,
            elapsed_ms: 0
        };


        // Avoid searching if the requirements are already
        // known to be contradictory.

        if (this.contradictory_requirements()) {

            this.last_error =
                "Impossible requirements: a connection is also forbidden.";

            this.stats.elapsed_ms = performance.now() - start;

            if (this.verbose) {
                console.log(this.last_error);
            }

            return null;
        }


        // The placement array stores orientation IDs.
        //
        // Zero indicates an empty cell.
        //
        // Nonzero IDs identify entries in TILES[cell].

        const placement = Array(NUM_CELLS).fill(0);


        // Begin recursive search with:
        //
        //     An empty placement array.
        //     An empty board.
        //     A cache key of zero.
        //     A recursion depth of zero.

        const answer = this.search(
            placement,
            new Board(),
            0,
            0
        );


        // Record performance statistics.

        this.stats.elapsed_ms = performance.now() - start;

        this.stats.failed_states = this.failed.size;


        // Handle an unsuccessful search.

        if (answer === null) {

            this.last_error = "No solution found.";

            if (this.verbose) {

                console.log(this.last_error);

                console.table(this.stats);
            }

            return null;
        }


        // Report successful search.

        if (this.verbose) {

            console.log(
                `Solved in ${
                    (this.stats.elapsed_ms / 1000).toFixed(3)
                } seconds`
            );

            console.table(this.stats);
        }


        // Convert internal orientation IDs back into the
        // original public output format.

        return answer.map((id, cell) => {

            const option = TILES[cell][id - 1];

            return [
                TILE_TYPES[option.tile_type][0],
                option.rotation
            ];
        });
    }


    /* -----------------------------------------------------------------
       CACHE UNSUCCESSFUL PLACEMENTS
       ----------------------------------------------------------------- */

    /**
     * Remember that a particular placement cannot lead to
     * a solution.
     *
     * Memoization can be disabled to compare performance.
     */

    remember_failure(key) {

        if (this.memoize) {
            this.failed.add(key);
        }

        return null;
    }


    /* -----------------------------------------------------------------
       RECURSIVE BACKTRACKING SEARCH
       ----------------------------------------------------------------- */

    /**
     * Search for a valid completion of a partially filled board.
     *
     * Parameters:
     *
     *     placement:
     *         Array of tile orientation IDs.
     *
     *     board:
     *         Current connected components, blocked vertices
     *         and remaining inventory.
     *
     *     key:
     *         Numeric representation of the placement array.
     *
     *     depth:
     *         Number of tiles already placed.
     */

    search(placement, board, key, depth) {

        this.stats.search_calls++;

        this.stats.max_depth = Math.max(
            this.stats.max_depth,
            depth
        );


        // Check whether this placement has previously been
        // proven incapable of producing a solution.

        if (this.memoize && this.failed.has(key)) {

            this.stats.cache_hits++;

            return null;
        }


        /* -------------------------------------------------------------
           BASE CASE

           All nine tiles have been placed.
           ------------------------------------------------------------- */

        if (depth === NUM_CELLS) {

            if (this.all_connections_made(board)) {

                // Return a copy because the placement array
                // is modified during recursive backtracking.

                return [...placement];
            }

            return this.remember_failure(key);
        }


        /* -------------------------------------------------------------
           MINIMUM REMAINING VALUES (MRV)

           Find the empty cell with the fewest legal placements.

           Filling the most constrained cell first generally
           reduces the number of unsuccessful search branches.
           ------------------------------------------------------------- */

        let best_cell = -1;

        let best_options = null;


        // Examine every empty cell.

        for (let cell = 0; cell < NUM_CELLS; cell++) {

            if (placement[cell] !== 0) {
                continue;
            }

            const options = [];


            // Examine every distinct tile orientation
            // that could be placed in this cell.

            for (const option of TILES[cell]) {

                const { tile_type, tile } = option;

                this.stats.placements_tested++;


                // Reject tiles that are no longer available.

                if (board.inventory[tile_type] <= 0) {

                    this.stats.inventory_rejections++;

                    continue;
                }


                // Reject incompatible active and blocked edges.

                if (incompatible_edges(board, tile)) {

                    this.stats.edge_rejections++;

                    continue;
                }


                // Reject tiles that block a character which
                // is required to participate in a connection.
                //
                // Once a vertex becomes blocked, subsequent
                // tile placements cannot make it active.

                if (
                    (tile.dead & this.required_active) !== 0
                ) {

                    this.stats.blocked_character_rejections++;

                    continue;
                }


                // Construct the resulting board.
                //
                // Expensive path merging is delayed until
                // after the inexpensive checks above.

                const next_board = add_tile(
                    board,
                    tile,
                    tile_type
                );

                if (next_board === null) {
                    continue;
                }


                // Reject any forbidden connection created
                // by adding this tile.

                if (this.illegal_connection(next_board)) {

                    this.stats.forbidden_connection_rejections++;

                    continue;
                }


                // This is a legal placement.
                //
                // Save its resulting board so that it does
                // not need to be constructed again later.

                options.push({
                    id: option.id,
                    board: next_board
                });


                // If this cell already has at least as many
                // legal options as the best cell found so far,
                // there is no reason to continue evaluating it.
                //
                // It cannot become the new MRV choice.

                if (
                    best_options !== null &&
                    options.length >= best_options.length
                ) {
                    break;
                }
            }


            // An empty cell with no legal placements means
            // the current board cannot be completed.

            if (options.length === 0) {

                return this.remember_failure(key);
            }


            // Update the MRV choice if this cell is more
            // constrained than the previous best cell.

            if (
                best_options === null ||
                options.length < best_options.length
            ) {

                best_cell = cell;

                best_options = options;
            }


            // A cell with exactly one legal placement is
            // already maximally constrained.
            //
            // We still examine the remaining empty cells,
            // because one of them may have zero legal options.
        }


        /* -------------------------------------------------------------
           TRY EACH LEGAL PLACEMENT FOR THE SELECTED CELL
           ------------------------------------------------------------- */

        if (this.randomize) {

            shuffle(best_options);
        }


        for (const option of best_options) {

            // Place the tile directly into the shared array.
            //
            // This avoids copying the placement array for
            // every candidate considered by the solver.

            placement[best_cell] = option.id;


            // Update the numeric cache key incrementally.
            //
            // The selected cell was previously empty, so
            // its previous contribution to the key was zero.

            const next_key =
                key + option.id * CELL_WEIGHTS[best_cell];


            // Recursively attempt to complete the board.

            const solution = this.search(
                placement,
                option.board,
                next_key,
                depth + 1
            );


            // Undo the placement before trying another tile.
            //
            // This is the backtracking step.

            placement[best_cell] = 0;


            // If a solution was found, propagate it back
            // through the recursive calls.

            if (solution !== null) {

                return solution;
            }
        }


        // Every legal placement for this cell was attempted
        // and none produced a solution.
        //
        // Remember this board arrangement as unsuccessful.

        return this.remember_failure(key);
    }
}