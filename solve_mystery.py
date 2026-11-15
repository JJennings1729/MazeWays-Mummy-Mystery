from dataclasses import dataclass
import numpy as np
import random
import pickle
import os
import time


NUM_CELLS = 9
NUM_VERTS = 29 

NORTH, EAST, SOUTH, WEST = range(4)
TUNNEL, MUMMY = 27, 28

UNPLACED_TILES = [

    {
        "NAME": "Y-tile",
        "TTYPE": 0,
        "VERTS": ((EAST, SOUTH, WEST),),
        "ROTATIONS": (0, 1, 2, 3),
        "QUANTITY": 3
    },

    {
        "NAME": "S-tile",
        "TTYPE": 1,
        "VERTS": ((NORTH, EAST), (SOUTH, WEST)),
        "ROTATIONS": (0, 1),
        "QUANTITY": 2
    },

    {
        "NAME": "X-tile",
        "TTYPE": 2,
        "VERTS": ((NORTH, EAST, SOUTH, WEST),),
        "ROTATIONS": (0,),
        "QUANTITY": 1
    },

    {
        "NAME": "Tunnel tile 1",
        "TTYPE": 3,
        "VERTS": ((NORTH, TUNNEL), (EAST, SOUTH, WEST)),
        "ROTATIONS": (0, 1, 2, 3),
        "QUANTITY": 1
    },

    {
        "NAME": "Tunnel tile 2",
        "TTYPE": 4, 
        "VERTS": ((NORTH, TUNNEL), (EAST, WEST)),
        "ROTATIONS": (0, 1, 2, 3),
        "QUANTITY": 1
    },

    {
        "NAME": "Mummy tile",
        "TTYPE": 5,
        "VERTS": ((NORTH, EAST, SOUTH, WEST, MUMMY),),
        "ROTATIONS": (0,),
        "QUANTITY": 1
    }
]

@dataclass
class Tile:
    paths: np.ndarray
    dead: np.ndarray

@dataclass(slots=True)
class Board:
    paths: np.ndarray
    dead: np.ndarray
    inventory: list[int]
    children: list[tuple] | None = None
    is_solution: bool = False

    @property
    def expanded(self):
        return self.children is not None

    @property
    def dead_end(self) -> bool:
        return self.children is not None and len(self.children) == 0


def generate_tiles():

    HOME_VERTS = (12, 0, 16, 1)
    tiles = [[] for _ in range(NUM_CELLS)]

    for cell in range(NUM_CELLS):

        local = tuple(
            vertex + cell + cell // 3
            for vertex in HOME_VERTS
        )

        for tile in UNPLACED_TILES:
            for rot in tile["ROTATIONS"]:

                def rotate(direction):
                    if direction < 4:
                        return (direction - rot) % 4
                    return direction

                rotated_groups = [
                    [rotate(direction) for direction in group]
                    for group in tile["VERTS"]
                ]

                global_groups = [
                    [
                        local[direction] if direction < 4 else direction
                        for direction in group
                    ]
                    for group in rotated_groups
                ]

                paths = np.zeros(
                    (len(global_groups), NUM_VERTS),
                    dtype=bool
                )

                for i, group in enumerate(global_groups):
                    paths[i, group] = True

                original_used = {
                    direction
                    for group in tile["VERTS"]
                    for direction in group
                    if direction < 4
                }

                rotated_used = {
                    (direction - rot) % 4
                    for direction in original_used
                }

                dead_directions = set(range(4)) - rotated_used

                dead = np.array(
                    [local[d] for d in sorted(dead_directions)],
                    dtype=int
                )

                tiles[cell].append((
                    (tile["TTYPE"], rot),
                    Tile(paths=paths, dead=dead)
                ))

    return tiles

TILES_FILE = "TILES.pkl"

if os.path.exists(TILES_FILE):
    with open(TILES_FILE, "rb") as f:
        TILES = pickle.load(f)
else:
    TILES = generate_tiles()

    with open(TILES_FILE, "wb") as f:
        pickle.dump(TILES, f)



def add_tile(board: Board, tile: Tile, ttype: int) -> Board:

    X = np.vstack((board.paths, tile.paths))
    n = len(X)

    parent = np.arange(n)

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra = find(a)
        rb = find(b)

        if ra != rb:
            parent[rb] = ra

    for col in range(X.shape[1]):
        rows = np.flatnonzero(X[:, col])

        if len(rows) > 1:
            for r in rows[1:]:
                union(rows[0], r)

    groups = {}

    for i in range(n):
        root = find(i)

        if root not in groups:
            groups[root] = X[i].copy()
        else:
            groups[root] |= X[i]

    new_paths = np.array(list(groups.values()), dtype=bool)

    new_dead = np.union1d(board.dead, tile.dead).astype(int)

    new_inventory = board.inventory.copy()
    new_inventory[ttype] -= 1

    return Board(
        paths=new_paths, 
        dead=new_dead,
        inventory=new_inventory
    )


def dead_path_used(board: Board) -> bool:
    return bool(board.paths[:, board.dead].any())

    
class Solver:

    def __init__(self, requirements):

        self.root_id = tuple((None) for _ in range(NUM_CELLS))

        start_tile_inventory = [
            tile["QUANTITY"] for tile in UNPLACED_TILES
        ]

        self.root = Board(
            paths=np.zeros((0, NUM_VERTS), dtype=bool),
            dead=np.array([], dtype=int),
            inventory=start_tile_inventory.copy()
        )
        
        self.TREE: dict[tuple, Board] = {}

        conn_chars, disc_chars = requirements

        character_list = {
            "TREASURE": 12,
            "PYRAMIDS": 13,
            "CROCODILE": 14,
            "MAP": 3,
            "PRINCESS": 7,
            "CITY": 11,
            "SPHINX": 26,
            "OASIS": 25,
            "EXPLORER": 24,
            "CAMEL": 8,
            "SARCOPHAGUS": 4,
            "ARCHAEOLOGIST": 0,
            "MUMMY": MUMMY
        }

        self.connections = np.zeros((len(conn_chars), NUM_VERTS), dtype=bool)
        for i, row in enumerate(conn_chars):
            self.connections[i, [character_list[c] for c in row]] = True

        self.disconnections = np.zeros(
            (
                len(disc_chars), 
                len(disc_chars[0]) if disc_chars else 0, 
                NUM_VERTS
            ),
            dtype=bool
        )

        for i, group in enumerate(disc_chars):
            for j, row in enumerate(group):
                self.disconnections[i, j, [character_list[c] for c in row]] = True


    def illegal_connection(self, board: Board) -> bool:

        for requirement in self.disconnections:
            matches = requirement @ board.paths.T

            if np.any((matches > 0).all(axis=0)):
                return True

        return False

    def all_connections_made(self, board: Board) -> bool:

        matches = np.all(
            ~self.connections[:, None, :] |
            board.paths[None, :, :],
            axis=-1
        )

        return bool(np.all(np.any(matches, axis=1)))
    

    def expand_board(self, board_id: tuple, board: Board) -> None:
        board.children = []
        children = []

        for cell in range(NUM_CELLS):
            if board_id[cell] != (None):
                continue

            cell_children = []

            for (ttype, rot), tile in TILES[cell]:
                if board.inventory[ttype] <= 0:
                    continue

                child = add_tile(board, tile, ttype)

                if dead_path_used(child):
                    continue

                if self.illegal_connection(child):
                    continue

                child_id = (
                    board_id[:cell] + ((ttype, rot),) + board_id[cell+1:]
                )

                if (None) not in child_id:
                    child.is_solution = self.all_connections_made(child)

                cell_children.append((child_id, child))

            if cell_children:
                children.append(cell_children)
            else:
                return

        if not children:
            return

        for child_id, child in min(children, key=len):
            existing = self.TREE.get(child_id)

            if existing is None:
                self.TREE[child_id] = child

            if existing is None or not existing.dead_end:
                board.children.append(child_id)


    def solve(self) -> list | None:

        for requirement in self.disconnections:
            matches = requirement @ self.connections.T

            if np.any((matches > 0).all(axis=0)):
                print("Impossible requirements:")
                print("Req connection is also a req disconnection")
                return

        start_time = time.time()

        while not self.root.dead_end:
            board_id = self.root_id
            board = self.root
            search = []

            while not board.dead_end:

                if not board.expanded:
                    self.expand_board(board_id, board)

                else:
                    search.append(board_id)
                    assert board.children
                    board_id = random.choice(board.children)
                    board = self.TREE[board_id]

                    if board.is_solution:

                        end_time = time.time()
                        print(f"Solved in {end_time-start_time:.3f} sec")

                        return [
                            (UNPLACED_TILES[ttype]["NAME"], rot) 
                            for (ttype, rot) in board_id
                        ]

            while board.dead_end:
                if not search:
                    break

                prev_id = search.pop()
                prev_board = (
                    self.root
                    if prev_id == self.root_id
                    else self.TREE[prev_id]
                )

                assert prev_board.children
                prev_board.children.remove(board_id)

                board_id = prev_id
                board = prev_board

        print("No solution found")