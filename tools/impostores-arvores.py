"""Renderiza cada espécie de árvore do modelo (Poly Haven) em três vistas para o site.

As árvores originais têm até 3,8 milhões de polígonos cada: pesadas demais para o navegador.
Aqui cada espécie é fotografada no Blender de frente, de lado e de cima, com fundo transparente;
o exportador (exportar-senai-glb.py) monta com essas imagens três cartões cruzados por árvore
(o mesmo truque dos jogos e do Google Earth), com 6 triângulos no lugar de milhões.

    blender -b distrito-industrial-senai.blend -P tools/impostores-arvores.py -- <pasta de saída>

Saída: <pasta>/<espécie>_{a,b,top}.png e <pasta>/impostores.json (medidas de cada espécie).
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "impostores"
os.makedirs(out, exist_ok=True)
SPECIES = ["M_jacaranda_tree", "M_island_tree_01", "M_island_tree_02", "M_island_tree_03", "M_tree_small_02", "M_shrub_01", "M_shrub_03"]
RES = 512

sc = bpy.data.scenes.new("Impostores")
sc.render.engine = "BLENDER_EEVEE"
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
w = bpy.data.worlds.new("imp_world"); w.use_nodes = True
bg = w.node_tree.nodes.get("Background"); bg.inputs[0].default_value = (0.55, 0.6, 0.68, 1); bg.inputs[1].default_value = 0.9
sc.world = w
sun = bpy.data.objects.new("imp_sun", bpy.data.lights.new("imp_sun", "SUN")); sun.data.energy = 3.2
sun.rotation_euler = (math.radians(35), 0, math.radians(30)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("imp_cam", bpy.data.cameras.new("imp_cam")); cam.data.type = "ORTHO"; sc.collection.objects.link(cam); sc.camera = cam

info = {}
for name in SPECIES:
    c = bpy.data.collections.get(name)
    if not c:
        continue
    sc.collection.children.link(c)
    obs = [o for o in c.all_objects if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(p) for o in obs for p in o.bound_box]
    off = Vector(c.instance_offset)
    x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
    y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
    z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    views = {
        "a": ((cx, y0 - 50, (z0 + z1) / 2), (math.radians(90), 0, 0), x1 - x0, z1 - z0),             # olhando para o norte
        "b": ((x1 + 50, cy, (z0 + z1) / 2), (math.radians(90), 0, math.radians(90)), y1 - y0, z1 - z0),  # olhando para o oeste
        "top": ((cx, cy, z1 + 50), (0, 0, 0), x1 - x0, y1 - y0),
    }
    for k, (loc, rot, ww, hh) in views.items():
        cam.location = loc; cam.rotation_euler = rot
        cam.data.ortho_scale = max(ww, hh); cam.data.clip_end = 500
        sc.render.resolution_x = RES if ww >= hh else max(8, round(RES * ww / hh))
        sc.render.resolution_y = RES if hh >= ww else max(8, round(RES * hh / ww))
        fp = os.path.abspath(os.path.join(out, f"{name}_{k}.png"))
        bpy.ops.render.render(write_still=False, scene=sc.name)
        bpy.data.images["Render Result"].save_render(fp, scene=sc)
    info[name] = {"x": [x0 - off.x, x1 - off.x], "y": [y0 - off.y, y1 - off.y], "z": [z0 - off.z, z1 - off.z]}
    sc.collection.children.unlink(c)
    print("IMP", name, info[name])

json.dump(info, open(os.path.join(out, "impostores.json"), "w"), indent=1)
print("IMP_OK")
