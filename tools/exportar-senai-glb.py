"""Exporta o modelo novo da escola SENAI e do entorno (Blender) para o site.

O site procura o arquivo assets/models/senai.glb. Se ele existir, o final da
apresentação mostra este modelo no lugar da escola montada a partir de campus.json.

Como usar (no PowerShell, na pasta do repositório):

    & "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b `
      "C:\\Users\\ciroe\\Documents\\SENAI-Iracemapolis-3D\\distrito-industrial-senai.blend" `
      -P tools\\exportar-senai-glb.py -- assets\\models\\senai.glb

Depois: git add assets/models/senai.glb, commit e push.

O que vai para o arquivo:
- a escola inteira (coleção "SENAI") e os carros (coleção "Veiculos");
- as ruas em volta da escola (coleção "Ruas"): asfalto, guias, faixas, faixa de pedestres e "PARE";
- as árvores, palmeiras e arbustos em volta da escola (coleção "Arvores").
  As árvores do Poly Haven têm até 3,8 milhões de polígonos cada; no site cada uma vira três cartões
  cruzados com as fotos da própria árvore renderizadas no Blender (rode antes tools/impostores-arvores.py
  com a pasta "impostores" ao lado do .glb de saída, ou indique a pasta na variável IMPOSTORES).

Área exportada (em metros, x = leste, y = norte): AREA abaixo. O site usa a mesma área para
não desenhar as próprias ruas e árvores por baixo do modelo.
- Materiais da escola viram cor + rugosidade simples; o site aplica por cima as texturas reais
  (Poly Haven) pelo nome do material (c_parede, c_piso_concreto, c_telha_..., c_bloquete...).
- Árvores e arbustos levam as fotos renderizadas (WebP, 512 px), com recorte das folhas.
- Malhas comprimidas com Draco.
"""
import sys

import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "senai.glb"
AREA = (-160.0, 160.0, -140.0, 260.0)          # x0, x1, y0, y1 (y = norte)


def bounds(o):
    w = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return min(v.x for v in w), max(v.x for v in w), min(v.y for v in w), max(v.y for v in w)


def in_area(o):
    x0, x1, y0, y1 = bounds(o)
    return x1 > AREA[0] and x0 < AREA[1] and y1 > AREA[2] and y0 < AREA[3]


def col_of(o):
    return o.users_collection[0].name if o.users_collection else ""


# 1) só a escola, os carros e o entorno próximo (o resto do distrito o site já desenha)
tree_cols = {o.instance_collection.name for o in bpy.data.objects
             if col_of(o) == "Arvores" and o.type == "EMPTY" and o.instance_collection and in_area(o)}
for o in list(bpy.data.objects):
    cn = col_of(o)
    keep = False
    if cn in ("SENAI", "Veiculos"):
        keep = o.type in ("MESH", "FONT") and not o.name.startswith("Onibus")   # ônibus eram só caixas
    elif cn in ("Ruas", "Arvores", "Predios"):
        keep = o.type in ("MESH", "EMPTY") and in_area(o)
    elif cn in tree_cols:
        keep = True                                  # malha original da espécie (vira a versão leve)
    if not keep:
        bpy.data.objects.remove(o, do_unlink=True)
print("ESPECIES", sorted(tree_cols))

# 2) árvores: cada espécie vira três cartões cruzados com as fotos do Blender (tools/impostores-arvores.py)
import json
import os
from mathutils import Matrix
IMP = os.environ.get("IMPOSTORES") or os.path.join(os.path.dirname(os.path.abspath(out)), "impostores")
imp_info = json.load(open(os.path.join(IMP, "impostores.json")))


def imp_mat(name, png):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o_ = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], o_.inputs[0]); b.inputs["Roughness"].default_value = 1.0
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(png)
    if "jacaranda" not in name and max(t.image.size) > 256:                     # árvores pequenas: 256 px bastam
        t.image.scale(max(1, t.image.size[0] // 2), max(1, t.image.size[1] // 2))
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    rd = nt.nodes.new("ShaderNodeMath"); rd.operation = "ROUND"                # recorte (alpha MASK no glTF)
    nt.links.new(t.outputs["Alpha"], rd.inputs[0]); nt.links.new(rd.outputs[0], b.inputs["Alpha"])
    m.use_backface_culling = False
    try:
        m.surface_render_method = "DITHERED"
    except Exception:
        pass
    return m


def imp_mesh(sp):
    d = imp_info[sp]; (x0, x1), (y0, y1), (z0, z1) = d["x"], d["y"], d["z"]
    cx, cy, zt = (x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.62 * (z1 - z0)
    V = [(x0, cy, z0), (x1, cy, z0), (x1, cy, z1), (x0, cy, z1),                # de frente (olhando para o norte)
         (cx, y0, z0), (cx, y1, z0), (cx, y1, z1), (cx, y0, z1),                # de lado (olhando para o oeste)
         (x0, y0, zt), (x1, y0, zt), (x1, y1, zt), (x0, y1, zt)]                # de cima, na altura da copa
    UV = [(0, 0), (1, 0), (1, 1), (0, 1)] * 3
    me = bpy.data.meshes.new("arvore_" + sp)
    me.from_pydata(V, [], [(0, 1, 2, 3), (4, 5, 6, 7), (8, 9, 10, 11)])
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            uv.data[li].uv = UV[me.loops[li].vertex_index]
    for k in ("a", "b", "top"):
        me.materials.append(imp_mat(f"arvore_{sp}_{k}", os.path.join(IMP, f"{sp}_{k}.png")))
    for i, poly in enumerate(me.polygons):
        poly.material_index = i
    return me


imp_meshes = {sp: imp_mesh(sp) for sp in tree_cols if sp in imp_info}
arv = bpy.data.collections.get("Arvores") or bpy.context.scene.collection
for e in [o for o in bpy.data.objects if o.type == "EMPTY" and o.instance_collection]:
    c = e.instance_collection
    if c.name in imp_meshes:                                                   # árvore: cartões cruzados
        n = bpy.data.objects.new(e.name, imp_meshes[c.name]); n.matrix_world = e.matrix_world.copy(); arv.objects.link(n)
        continue
    off = Matrix.Translation(-Vector(c.instance_offset))                       # outra coisa instanciada: a malha original
    for o in c.all_objects:
        if o.type == "MESH":
            n = bpy.data.objects.new(e.name + "_" + o.name, o.data)
            n.matrix_world = e.matrix_world @ off @ o.matrix_world
            arv.objects.link(n)
for o in [o for o in bpy.data.objects if o.type == "EMPTY"]:
    bpy.data.objects.remove(o, do_unlink=True)
# os originais das espécies (milhões de polígonos) saem do arquivo
for sp in tree_cols:
    c = bpy.data.collections.get(sp)
    if c and sp in imp_meshes:
        for o in list(c.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)

# sebes: a subdivisão do render (milhares de faces por metro) fica leve para o navegador
for o in bpy.data.objects:
    if o.type == "MESH" and o.name.startswith("Sebe"):
        d = o.modifiers.new("web", "DECIMATE"); d.ratio = 0.15

# letreiros (texto) viram malha
for o in [o for o in bpy.data.objects if o.type == "FONT"]:
    bpy.context.view_layer.objects.active = o
    for x in bpy.data.objects:
        x.select_set(x == o)
    bpy.ops.object.convert(target="MESH")


# 3) materiais
# pintura dos carros: no Blender a cor vem de cada objeto (Object Info); no glTF vira um material por cor
pint = {}
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for i, m in enumerate(o.data.materials):
        if m and m.name == "car_pintura":
            k = tuple(round(v, 3) for v in o.color[:3])
            if k not in pint:
                pint[k] = m.copy(); pint[k].name = "car_pintura_%02x%02x%02x" % tuple(int(v * 255) for v in k); pint[k].diffuse_color = (*k, 1)
            if o.data.users > 1:
                o.data = o.data.copy()
            o.data.materials[i] = pint[k]

def base_image(m):
    if not m.use_nodes:
        return None
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b or not b.inputs["Base Color"].is_linked:
        return None
    seen, stack = set(), [b.inputs["Base Color"].links[0].from_node]
    while stack:
        n = stack.pop()
        if n in seen:
            continue
        seen.add(n)
        if n.type == "TEX_IMAGE" and n.image:
            return n.image
        for i in n.inputs:
            for l in i.links:
                stack.append(l.from_node)
    return None


tex_mats = set()
for o in bpy.data.objects:
    if o.type == "MESH" and o.data.uv_layers and col_of(o) not in ("SENAI", "Veiculos", "Ruas"):
        for m in o.data.materials:
            if m:
                tex_mats.add(m.name)


def simple(m):
    rgb = [min(1.0, v) for v in m.diffuse_color[:3]]
    r = 0.7
    img = base_image(m) if m.name in tex_mats else None
    if m.use_nodes:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b and not b.inputs["Roughness"].is_linked:
            r = b.inputs["Roughness"].default_value
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o_ = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], o_.inputs[0])
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = max(r, 0.6) if img else r
    if img:
        if max(img.size) > 512:
            img.scale(512, 512) if img.size[0] == img.size[1] else img.scale(512, max(1, int(512 * img.size[1] / img.size[0])))
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        if "leaves" in m.name or "leaf" in m.name or "copa" in m.name:
            rd = nt.nodes.new("ShaderNodeMath"); rd.operation = "ROUND"        # recorte (alpha MASK no glTF)
            nt.links.new(t.outputs["Alpha"], rd.inputs[0]); nt.links.new(rd.outputs[0], b.inputs["Alpha"])
            try:
                m.surface_render_method = "DITHERED"
            except Exception:
                pass
    elif "vidro" in m.name:
        b.inputs["Alpha"].default_value = 0.45 if "car" not in m.name else 0.85
        b.inputs["Roughness"].default_value = 0.05
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass


for m in bpy.data.materials:
    if m.users and not m.name.startswith("arvore_"):
        simple(m)

nm = sum(1 for o in bpy.context.scene.objects if o.type == "MESH")
print("OBJETOS", nm, "MALHAS", len({o.data.name for o in bpy.context.scene.objects if o.type == "MESH"}))
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=False, use_visible=False, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False,
    export_extras=False, export_gpu_instances=True, export_image_format="WEBP", export_image_quality=80,
)
print("EXPORT_OK", out)
