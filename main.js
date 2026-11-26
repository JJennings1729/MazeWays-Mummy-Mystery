
"use strict";

/* =========================================================
   1. PUZZLE REQUIREMENTS
   ========================================================= */

// Retrieve all character names from solver.js.
// This avoids having to maintain two separate character lists.

const character_names = Object.keys(CHARACTERS);

// Store the user's submitted requirements.
// These arrays are passed directly to the Solver class.

const connected = [];
const disconnected = [];

// Prevent overlapping solving and drawing operations.
let busy = false;

// Indicates whether the puzzle board needs to be redrawn.
let board_dirty = true;


/* =========================================================
   2. HTML ELEMENT REFERENCES
   ========================================================= */

// Retrieve an HTML element by its ID.
// Throw a helpful error if the element does not exist.

function by_id(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing HTML element: #${id}`);
    }

    return element;
}

// Character selection containers.

const connected_options = by_id("connected-options");
const disconnected_a = by_id("disconnected-a");
const disconnected_b = by_id("disconnected-b");

// Editable requirement displays on the Set Puzzle page.

const connected_groups = by_id("connected-groups");
const disconnected_groups = by_id("disconnected-groups");

// Read-only requirement displays on the Solve Puzzle page.

const solution_connected = by_id("solution-connected");
const solution_disconnected = by_id("solution-disconnected");

// Buttons.

const submit_connected = by_id("submit-connected");
const submit_disconnected = by_id("submit-disconnected");

const solve_button = by_id("solve-button");
const clear_button = by_id("clear-button");

const nav_set = by_id("nav-set");
const nav_solve = by_id("nav-solve");

const done_button = by_id("done-button");
const edit_button = by_id("edit-button");

// Solver output and puzzle board elements.

const status_element = by_id("status");
const result_element = by_id("result");
const summary = by_id("requirements-summary");
const canvas = by_id("board-canvas");

// Store the three available pages.

const pages = {
    home: by_id("home-page"),
    set: by_id("set-page"),
    solve: by_id("solve-page")
};

// Group the checkbox containers together so that they
// can easily be initialized or cleared.

const checkbox_containers = [
    connected_options,
    disconnected_a,
    disconnected_b
];


/* =========================================================
   3. PAGE NAVIGATION
   ========================================================= */

// Display one page and hide all other pages.
//
// Hiding a page does not delete its contents.
// Submitted requirements and checkbox selections therefore
// remain available when switching between pages.

function show_page(name) {

    // Prevent navigation during solving or drawing.
    if (busy) return;

    // Validate the requested page.
    if (!Object.hasOwn(pages, name)) {
        throw new Error(`Unknown page: ${name}`);
    }

    // Hide every page except the requested page.
    for (const [key, page] of Object.entries(pages)) {
        page.hidden = key !== name;
    }

    // Highlight the currently selected navigation button.
    nav_set.classList.toggle("active", name === "set");
    nav_solve.classList.toggle("active", name === "solve");
}


/* =========================================================
   4. CHARACTER CHECKBOXES
   ========================================================= */

// Generate one checkbox for every character in solver.js.

function create_checkboxes(container) {

    for (const name of character_names) {

        // Create a label containing the checkbox and name.
        const label = document.createElement("label");
        label.className = "character-option";

        // Create the checkbox.
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = name;

        // Clicking the character name also toggles its checkbox.
        label.append(
            checkbox,
            document.createTextNode(name)
        );

        container.append(label);
    }

    // One event listener handles changes to all checkboxes
    // within this container.
    container.addEventListener("change", update_checkboxes);
}


// Return an array containing all selected character names.
// Disabled checkboxes are ignored.

function get_selected(container) {
    return Array.from(
        container.querySelectorAll("input:checked:not(:disabled)"),
        checkbox => checkbox.value
    );
}


// Uncheck every checkbox inside the supplied container.

function clear_checkboxes(container) {

    for (const checkbox of container.querySelectorAll("input")) {
        checkbox.checked = false;
    }
}


// Disable the specified characters and enable all others.

function disable_characters(container, names) {

    const unavailable = new Set(names);

    for (const checkbox of container.querySelectorAll("input")) {

        checkbox.disabled = unavailable.has(checkbox.value);

        // A disabled character must not remain selected.
        if (checkbox.disabled) {
            checkbox.checked = false;
        }
    }
}


/* =========================================================
   5. ENFORCE CHARACTER SELECTION RULES
   ========================================================= */

// Called whenever a checkbox changes or a requirement
// is submitted or removed.

function update_checkboxes() {

    // CONNECTED CHARACTERS
    //
    // A character cannot belong to more than one submitted
    // connected group.

    disable_characters(
        connected_options,
        connected.flat()
    );


    // DISCONNECTED CHARACTERS
    //
    // A character selected in Group A cannot be selected
    // in Group B, and vice versa.
    //
    // Characters may still be reused in other submitted
    // disconnection pairs.

    const a = get_selected(disconnected_a);
    const b = get_selected(disconnected_b);

    disable_characters(disconnected_a, b);
    disable_characters(disconnected_b, a);


    // SUBMIT BUTTONS
    //
    // A connected group requires at least two characters.
    //
    // A disconnected pair requires at least one character
    // in each group.

    submit_connected.disabled =
        get_selected(connected_options).length < 2;

    submit_disconnected.disabled =
        get_selected(disconnected_a).length === 0 ||
        get_selected(disconnected_b).length === 0;
}


/* =========================================================
   6. SUBMIT PUZZLE REQUIREMENTS
   ========================================================= */

// Submit a group of characters that must all be connected.

function add_connected_group() {

    if (busy) return;

    const group = get_selected(connected_options);
    const used = new Set(connected.flat());

    // Validate the group before saving it.
    //
    // Require at least two characters and ensure that
    // none already belong to another connected group.

    if (
        group.length < 2 ||
        group.some(name => used.has(name))
    ) {
        return;
    }

    // Save the group in the format expected by Solver.
    connected.push(group);

    // Reset the current checkbox selection.
    clear_checkboxes(connected_options);

    // Refresh both pages.
    requirements_changed();
}


// Submit a pair of disconnected character groups.
//
// No character in Group A may connect to ANY character
// in Group B.
//
// Characters within either group may connect to one
// another unless another requirement prohibits it.

function add_disconnected_group() {

    if (busy) return;

    const a = get_selected(disconnected_a);
    const b = get_selected(disconnected_b);

    // Both groups must contain at least one character.
    // The two groups must not contain overlapping characters.

    if (
        !a.length ||
        !b.length ||
        a.some(name => b.includes(name))
    ) {
        return;
    }

    // Save both groups together as a single pair.
    disconnected.push([a, b]);

    // Reset both checkbox selections.
    // Characters can be reused in subsequent pairs.

    clear_checkboxes(disconnected_a);
    clear_checkboxes(disconnected_b);

    // Refresh both pages.
    requirements_changed();
}


/* =========================================================
   7. DISPLAY SUBMITTED REQUIREMENTS
   ========================================================= */

// Display connected groups or disconnected pairs.
//
// This function is shared by the Set Puzzle and Solve
// Puzzle pages to avoid duplicating rendering code.
//
// Parameters:
//
//     container:
//         HTML element where the requirements are displayed.
//
//     groups:
//         Array containing the submitted requirements.
//
//     is_pair:
//         false = connected groups
//         true  = disconnected pairs
//
//     editable:
//         true  = display Remove buttons
//         false = read-only display

function render_groups(
    container,
    groups,
    is_pair = false,
    editable = true
) {

    // Remove the previous display.
    container.replaceChildren();

    // Display a placeholder if no requirements exist.
    if (!groups.length) {

        const message = document.createElement("div");

        message.className = "empty-message";
        message.textContent = "No groups submitted.";

        container.append(message);

        return;
    }

    // Create one visible entry for each requirement.

    groups.forEach((group, index) => {

        const entry = document.createElement("div");
        entry.className = "saved-group";

        const content = document.createElement("div");
        content.className = "group-content";

        if (is_pair) {

            // Display Group A, the disconnection relationship,
            // and Group B.

            const separator = document.createElement("span");

            separator.className = "disconnection-symbol";
            separator.textContent = "Must not connect to";

            content.append(
                group[0].join(", "),
                separator,
                group[1].join(", ")
            );

        } else {

            // Display all characters that must be connected.

            content.textContent = group.join(" ↔ ");
        }

        entry.append(content);

        // Only create a Remove button on editable displays.
        //
        // The requirements beneath the completed puzzle
        // are read-only.

        if (editable) {

            const remove = document.createElement("button");

            remove.type = "button";
            remove.className = "remove-button";
            remove.textContent = "Remove";

            remove.addEventListener("click", () => {

                if (busy) return;

                // Remove the requirement from its array.
                groups.splice(index, 1);

                // Refresh both pages.
                //
                // Characters removed from connected groups
                // become available for selection again.

                requirements_changed();
            });

            entry.append(remove);
        }

        container.append(entry);
    });
}


/* =========================================================
   8. BOARD MANAGEMENT
   ========================================================= */

// Temporarily disable navigation and solving while
// images are loading or the solver is running.
//
// This prevents overlapping drawing operations.

function set_busy(value) {

    busy = value;

    nav_set.disabled = value;
    nav_solve.disabled = value;

    solve_button.disabled = value;
    done_button.disabled = value;
    edit_button.disabled = value;
}


// Erase everything currently drawn on the canvas.

function clear_canvas() {

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}


// Draw the empty puzzle board using board.js.

async function reset_board() {

    set_busy(true);

    clear_canvas();

    try {

        // Calling draw_board() without a solution
        // draws only the background image, BOARD.png.

        await draw_board();

        // The board no longer needs to be redrawn.
        board_dirty = false;

    } catch (error) {

        // Report any image loading or drawing errors.
        status_element.textContent = error.message;

        console.error(error);

    } finally {

        // Restore navigation and solving controls,
        // even if drawing failed.

        set_busy(false);
    }
}


/* =========================================================
   9. REFRESH REQUIREMENTS AND INVALIDATE OLD SOLUTIONS
   ========================================================= */

// Called whenever a submitted requirement is added,
// removed or cleared.
//
// Both pages use the same connected and disconnected arrays.
// This ensures that their requirement displays always agree.

function requirements_changed() {

    // SET PUZZLE PAGE
    //
    // Display editable requirements with Remove buttons.

    render_groups(
        connected_groups,
        connected
    );

    render_groups(
        disconnected_groups,
        disconnected,
        true
    );


    // SOLVE PUZZLE PAGE
    //
    // Display the same requirements underneath the board,
    // but without Remove buttons.

    render_groups(
        solution_connected,
        connected,
        false,
        false
    );

    render_groups(
        solution_disconnected,
        disconnected,
        true,
        false
    );


    // Update available character checkboxes.

    update_checkboxes();


    // Update the numerical requirements summary.

    summary.textContent =
        `${connected.length} connected groups | ` +
        `${disconnected.length} disconnected pairs`;


    // Clear any previous solver messages.

    status_element.textContent = "";
    result_element.textContent = "";


    // The previous solution may no longer satisfy the
    // updated requirements, so erase it.

    clear_canvas();

    // Redraw the empty board the next time the user
    // opens the Solve Puzzle page.

    board_dirty = true;
}


// Open the Solve Puzzle page.
//
// Only redraw the empty board if the requirements have
// changed or the board has not yet been loaded.

async function open_solve_page() {

    if (busy) return;

    show_page("solve");

    if (board_dirty) {
        await reset_board();
    }
}


/* =========================================================
   10. SOLVE THE PUZZLE
   ========================================================= */

// Pass the submitted requirements to solver.js.
//
// The solver returns an array of nine tile names and
// rotation numbers, or null if no solution exists.
//
// board.js converts the solution array into the completed
// puzzle image.
//
// The requirements displayed beneath the board remain
// unchanged while solving.

async function solve_puzzle() {

    // Prevent multiple simultaneous solve requests.
    if (busy) return;

    set_busy(true);

    // Clear the previous solution and output.

    status_element.textContent = "Solving...";
    result_element.textContent = "";

    clear_canvas();

    try {

        // Create a solver using the submitted requirements.
        //
        // Randomization allows different valid solutions
        // to be returned on subsequent attempts.

        const solver = new Solver(
            [connected, disconnected],
            {
                randomize: true,
                memoize: false,
                verbose: true
            }
        );

        // Search for a valid tile arrangement.

        const solution = solver.solve();

        if (solution === null) {

            // No valid solution exists.
            // Display the empty background board.

            await draw_board();

            status_element.textContent =
                solver.last_error || "No solution found.";

        } else {

            // A valid solution was found.
            //
            // Pass the array directly to board.js.
            // It handles image loading, positioning
            // and rotation of all nine tiles.

            await draw_board(solution);

            // Display the solver's execution time.

            status_element.textContent =
                `Solution found in ${
                    solver.stats.elapsed_ms.toFixed(1)
                } ms.`;

            // Display the solution array in the browser
            // console for debugging.

            console.log(solution);
        }

        // The displayed board is now up to date.

        board_dirty = false;

    } catch (error) {

        // Never leave an outdated solution visible if
        // solving or rendering fails.

        clear_canvas();

        board_dirty = true;

        // Display the error on the webpage and in the console.

        status_element.textContent = error.message;

        console.error(error);

    } finally {

        // Always restore the buttons after solving,
        // regardless of whether the operation succeeded.

        set_busy(false);
    }
}


/* =========================================================
   11. CLEAR ALL REQUIREMENTS
   ========================================================= */

// Reset all submitted groups and unfinished selections.

function clear_all() {

    if (busy) return;

    // Empty both requirement arrays without replacing them.

    connected.length = 0;
    disconnected.length = 0;

    // Uncheck all three sets of character checkboxes.

    checkbox_containers.forEach(clear_checkboxes);

    // Refresh both pages and invalidate the old solution.

    requirements_changed();
}


/* =========================================================
   12. REGISTER BUTTON EVENTS
   ========================================================= */

// Main navigation buttons.

nav_set.addEventListener("click", () => {
    show_page("set");
});

nav_solve.addEventListener("click", open_solve_page);


// Set Puzzle page buttons.

done_button.addEventListener(
    "click",
    open_solve_page
);

clear_button.addEventListener(
    "click",
    clear_all
);

submit_connected.addEventListener(
    "click",
    add_connected_group
);

submit_disconnected.addEventListener(
    "click",
    add_disconnected_group
);


// Solve Puzzle page buttons.

solve_button.addEventListener(
    "click",
    solve_puzzle
);

edit_button.addEventListener("click", () => {
    show_page("set");
});


/* =========================================================
   13. INITIALIZE THE APPLICATION
   ========================================================= */

// Generate all three sets of character checkboxes.
//
// This only happens once when main.js is loaded.

checkbox_containers.forEach(create_checkboxes);


// Initialize the requirement displays on both pages,
// update the checkbox availability, and reset the board.

requirements_changed();


// Display the welcome page.

show_page("home");


// The background board will be loaded automatically
// when the user first opens the Solve Puzzle page.
