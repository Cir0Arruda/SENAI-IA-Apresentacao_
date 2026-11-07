"""Exporta a escola SENAI (coleções "SENAI" e "Veiculos") do Blender para o site.

O site procura o arquivo assets/models/senai.glb. Se ele existir, o final da
apresentação mostra este modelo no lugar da escola montada a partir de campus.json.

Como usar (no PowerShell, na pasta do repositório):

    & "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b `
      "C:\\Users\\ciroe\\Documents\\SENAI-Iracemapolis-3D\\distrito-industrial-senai.blend" `
      -P tools\\exportar-senai-glb.py -- assets\\models\\senai.glb

Depois: git add assets/models/senai.glb, commit e push.

- Coordenadas: as mesmas do gerador (x = leste, y = norte, z = altura, em metros).
  O exportador glTF converte para o padrão do three.js (y para cima, z para o sul).
- Materiais viram cor + rugosidade simples; o site aplica por cima as texturas reais
  (Poly Haven) pelo nome do material (c_parede, c_piso_concreto, c_telha_..., c_bloquete...).
- Malhas comprimidas com Draco: o arquivo fica com ~1,5 MB.
"""
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "senai.glb"
keep = {"SENAI", "Veiculos"}

# só a escola e os carros dela (o resto do distrito o site já desenha)
for o in list(bpy.data.objects):
    cn = o.users_collection[0].name if o.users_collection else ""
    if cn not in keep or o.type not in ("MESH", "FONT"):
        bpy.data.objects.remove(o, do_unlink=True)

# letreiros (texto) viram malha
for o in [o for o in bpy.data.objects if o.type == "FONT"]:
    bpy.context.view_layer.objects.active = o
    for x in bpy.data.objects:
        x.select_set(x == o)
    bpy.ops.object.convert(target="MESH")


def simple(m):
    """Troca o material por um Principled BSDF simples com a cor de visualização do Blender."""
    rgb = [min(1.0, v) for v in m.diffuse_color[:3]]
    r = 0.7
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
    b.inputs["Roughness"].default_value = r
    if "vidro" in m.name:
        b.inputs["Alpha"].default_value = 0.45 if "car" not in m.name else 0.85
        b.inputs["Roughness"].default_value = 0.05
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass


for m in bpy.data.materials:
    if m.users:
        simple(m)

bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=False, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_texcoords=False, export_normals=True, export_cameras=False, export_lights=False,
    export_extras=False,
)
print("EXPORT_OK", out)
