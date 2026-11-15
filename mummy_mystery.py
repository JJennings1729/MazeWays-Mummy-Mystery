import py5
import math
from solve_mystery import Solver


# Groups of connected characters

required_connections = [
    ["PRINCESS", "TREASURE"],
    ["OASIS", "CAMEL"]
]

# Pairs of completely disjoint character groups

required_disconnections = [
    [
        ["ARCHAEOLOGIST"],
        ["CAMEL"]
    ],
    [
        ["SPHINX", "MAP", "CROCODILE", "MUMMY"],
        ["TREASURE"]
    ]
]



side = 150
offset = (150, 150)
TILE_COLOR = py5.color(240, 120, 220)
PATH_COLOR = py5.color(220, 220, 50)
path_width = side / 6

def settings():
    py5.size(750, 750, py5.P2D)

def y_tile() -> py5.Py5Shape:
    tile = py5.create_shape(py5.GROUP)

    background = py5.create_shape(py5.RECT, 0, 0, side, side)
    background.set_stroke(TILE_COLOR)
    background.set_stroke_weight(4)
    background.set_fill(TILE_COLOR)
    tile.add_child(background)

    path = py5.create_shape()
    path.set_stroke(PATH_COLOR)
    path.set_stroke_weight(path_width)
    path.set_fill(False)
    path.begin_shape()
    path.vertex(0, side/2)
    path.bezier_vertex(
        side * 0.4, side/2,
        side/2, side * 0.6,
        side/2, side
    )
    path.bezier_vertex(
        side/2, side * 0.6,
        side * 0.6, side/2,
        side, side/2
    )
    path.end_shape()
    tile.add_child(path)

    border = py5.create_shape(py5.RECT, 0, 0, side, side)
    border.set_stroke(py5.color(0, 0, 0))
    border.set_stroke_weight(4)
    border.set_fill(False)
    tile.add_child(border)

    return tile

def s_tile() -> py5.Py5Shape:
    tile = py5.create_shape(py5.GROUP)

    background = py5.create_shape(py5.RECT, 0, 0, side, side)
    background.set_stroke(TILE_COLOR)
    background.set_stroke_weight(4)
    background.set_fill(TILE_COLOR)
    tile.add_child(background)

    path1 = py5.create_shape()
    path1.set_stroke(PATH_COLOR)
    path1.set_stroke_weight(path_width)
    path1.set_fill(False)
    path1.begin_shape()
    path1.vertex(0, side/2)
    path1.bezier_vertex(
        side * 0.4, side/2,
        side/2, side * 0.4,
        side/2, 0
    )
    path1.end_shape()
    tile.add_child(path1)

    path2 = py5.create_shape()
    path2.set_stroke(PATH_COLOR)
    path2.set_stroke_weight(path_width)
    path2.set_fill(False)
    path2.begin_shape()
    path2.vertex(side/2, side)
    path2.bezier_vertex(
        side/2, side * 0.6,
        side * 0.6, side/2,
        side, side/2
    )
    path2.end_shape()
    tile.add_child(path2)

    border = py5.create_shape(py5.RECT, 0, 0, side, side)
    border.set_stroke(py5.color(0, 0, 0))
    border.set_stroke_weight(4)
    border.set_fill(False)
    tile.add_child(border)

    return tile

def x_tile()-> py5.Py5Shape:
    tile = py5.create_shape(py5.GROUP)

    background = py5.create_shape(py5.RECT, 0, 0, side, side)
    background.set_stroke(TILE_COLOR)
    background.set_stroke_weight(4)
    background.set_fill(TILE_COLOR)
    tile.add_child(background)

    path1 = py5.create_shape(py5.LINE, 0, side/2, side, side/2)
    path1.set_stroke(PATH_COLOR)
    path1.set_stroke_weight(path_width)
    path1.set_fill(False)
    tile.add_child(path1)

    path2 = py5.create_shape(py5.LINE, side/2, 0, side/2, side)
    path2.set_stroke(PATH_COLOR)
    path2.set_stroke_weight(path_width)
    path2.set_fill(False)
    tile.add_child(path2)

    border = py5.create_shape(py5.RECT, 0, 0, side, side)
    border.set_stroke(py5.color(0, 0, 0))
    border.set_stroke_weight(4)
    border.set_fill(False)
    tile.add_child(border)

    return tile

def tunnel_1() -> py5.Py5Shape:
    tile = py5.create_shape(py5.GROUP)

    background = py5.create_shape(py5.RECT, 0, 0, side, side)
    background.set_stroke(TILE_COLOR)
    background.set_stroke_weight(4)
    background.set_fill(TILE_COLOR)
    tile.add_child(background)

    path1 = py5.create_shape()
    path1.set_stroke(PATH_COLOR)
    path1.set_stroke_weight(path_width)
    path1.set_fill(False)
    path1.begin_shape()
    path1.vertex(0, side/2)
    path1.bezier_vertex(
        side * 0.3, side/2,
        side/2, side * 0.7,
        side/2, side
    )
    path1.bezier_vertex(
        side/2, side * 0.7,
        side * 0.7, side/2,
        side, side/2
    )
    path1.end_shape()
    tile.add_child(path1)

    tunnel = py5.create_shape(
        py5.ARC, side/2, side * 0.2, side * 0.3, side/2, 0, math.pi
    )
    tunnel.set_stroke(False)
    tunnel.set_fill(py5.color(0, 0, 0))
    tile.add_child(tunnel)

    path2 = py5.create_shape(py5.LINE, side/2, 0, side/2, side * 0.2)
    path2.set_stroke(PATH_COLOR)
    path2.set_stroke_weight(path_width)
    path2.set_fill(False)
    tile.add_child(path2)

    border = py5.create_shape(py5.RECT, 0, 0, side, side)
    border.set_stroke(py5.color(0, 0, 0))
    border.set_stroke_weight(4)
    border.set_fill(False)
    tile.add_child(border)

    return tile

def tunnel_2() -> py5.Py5Shape:
    tile = py5.create_shape(py5.GROUP)

    background = py5.create_shape(py5.RECT, 0, 0, side, side)
    background.set_stroke(TILE_COLOR)
    background.set_stroke_weight(4)
    background.set_fill(TILE_COLOR)
    tile.add_child(background)

    path1 = py5.create_shape()
    path1.set_stroke(PATH_COLOR)
    path1.set_stroke_weight(path_width)
    path1.set_fill(False)
    path1.begin_shape()
    path1.vertex(0, side/2)
    path1.bezier_vertex(
        side * 0.4, side/2,
        side * 0.2, side * 0.75,
        side/2, side * 0.75
    )
    path1.bezier_vertex(
        side * 0.8, side * 0.75,
        side * 0.6, side/2,
        side, side/2
    )
    path1.end_shape()
    tile.add_child(path1)

    tunnel = py5.create_shape(
        py5.ARC, side/2, side * 0.2, side * 0.3, side/2, 0, math.pi
    )
    tunnel.set_stroke(False)
    tunnel.set_fill(py5.color(0, 0, 0))
    tile.add_child(tunnel)

    path2 = py5.create_shape(py5.LINE, side/2, 0, side/2, side * 0.2)
    path2.set_stroke(PATH_COLOR)
    path2.set_stroke_weight(path_width)
    path2.set_fill(False)
    tile.add_child(path2)

    border = py5.create_shape(py5.RECT, 0, 0, side, side)
    border.set_stroke(py5.color(0, 0, 0))
    border.set_stroke_weight(4)
    border.set_fill(False)
    tile.add_child(border)

    return tile

def mummy() -> py5.Py5Shape:
    tile = py5.create_shape(py5.GROUP)

    background = py5.create_shape(py5.RECT, 0, 0, side, side)
    background.set_fill(TILE_COLOR)
    background.set_stroke(TILE_COLOR)
    tile.add_child(background)

    path1 = py5.create_shape(py5.LINE, 0, side/2, side, side/2)
    path1.set_stroke(PATH_COLOR)
    path1.set_stroke_weight(path_width)
    tile.add_child(path1)

    path2 = py5.create_shape(py5.LINE, side/2, 0, side/2, side)
    path2.set_stroke(PATH_COLOR)
    path2.set_stroke_weight(path_width)
    tile.add_child(path2)

    img = py5.load_image("Characters/mummy.png")
    char_size = 0.5
    w = img.width * char_size
    h = img.height * char_size
    x = (side - w) / 2
    y = (side - h) / 2

    picture = py5.create_shape()
    picture.set_stroke(False)
    picture.begin_shape()
    picture.texture(img)
    picture.vertex(x, y, 0, 0)
    picture.vertex(x+w, y, img.width, 0)
    picture.vertex(x+w, y+h, img.width, img.height)
    picture.vertex(x, y+h, 0, img.height)
    picture.end_shape(py5.CLOSE)
    tile.add_child(picture)

    border = py5.create_shape(py5.RECT, 0, 0, side, side)
    border.set_stroke(py5.color(0))
    border.set_stroke_weight(4)
    border.set_fill(False)
    tile.add_child(border)

    return tile


reqs = (
    required_connections, 
    required_disconnections
)

solver = Solver(requirements=reqs)
solution = solver.solve()

def setup():

    def place_char(char, edge, ind):
        img = py5.load_image("Characters/" + char)
        img.resize(int(img.width/3), int(img.height/3))

        match edge:
            case "TOP":
                x = offset[0] + ind * side + (side - img.width) / 2
                y = offset[1] - img.height - 20
            case "BOTTOM":
                x = offset[0] + ind * side + (side - img.width) / 2
                y = offset[1] + 3 * side + 20
            case "LEFT":
                x = offset[0] - img.width - 20
                y = offset[1] + ind * side + (side - img.height) / 2
            case "RIGHT":
                x = offset[0] + 3 * side + 20
                y = offset[1] + ind * side + (side - img.height) / 2
            case _:
                x, y = 0, 0
        
        py5.image(img, x, y)

    place_char("archaeologist.png", "LEFT", 0)
    place_char("sarcophagus.png", "LEFT", 1)
    place_char("camel.png", "LEFT", 2)
    place_char("explorer.png", "BOTTOM", 0)
    place_char("oasis.png", "BOTTOM", 1)
    place_char("sphinx.png", "BOTTOM", 2)
    place_char("map.png", "RIGHT", 0)
    place_char("princess.png", "RIGHT", 1)
    place_char("city.png", "RIGHT", 2)
    place_char("treasure.png", "TOP", 0)
    place_char("pyramids.png", "TOP", 1)
    place_char("crocodile.png", "TOP", 2)

    TILES = {
        "Y-tile": y_tile(),
        "S-tile": s_tile(),
        "X-tile": x_tile(),
        "Tunnel tile 1": tunnel_1(),
        "Tunnel tile 2": tunnel_2(),
        "Mummy tile": mummy()
    }

    if solution is not None:
        for cell, (ttype, rotation) in enumerate(solution):

            x = (cell % 3)
            y = (cell // 3)
            tile = TILES[ttype]

            py5.push_matrix()
            py5.translate(
                x * side + offset[0] + side/2,
                y * side + offset[1] + side/2
            )
            py5.rotate(math.radians(90 * rotation))
            py5.shape(tile, -side/2, -side/2)
            py5.pop_matrix()


def draw():
    pass

py5.run_sketch()