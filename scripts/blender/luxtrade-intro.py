"""
LuxTradee Brand Intro — Blender headless (CPU Cycles)
=====================================================
Script 3D intro untuk konten video LuxTradee (9:16, vertical TikTok/Reels).

Render (lokal / GitHub Actions runner):
    blender -b --python scripts/blender/luxtrade-intro.py -- --out /tmp/blender-out --frames 48
Lalu jadi MP4:
    ffmpeg -framerate 24 -i /tmp/blender-out/frame_%04d.png -c:v libx264 \
      -pix_fmt yuv420p -movflags +faststart /tmp/blender-intro.mp4

Isi scene (semuanya prosedural — tanpa file aset):
  • Teks metalik emas "LUXTRADEE" (jurnal trading AI) — material metal
  • Sub-teks "AI TRADING JOURNAL"
  • Candlestick chart XAUUSD naik (bar emas/biru + wick) — brand visual
  • Kamera dolly-in halus + sedikit orbit (gerak sinematik 2 detik)
  • Background navy gelap (brand biru)

Perintah pasca '--' (argv Blender):
  --out DIR     folder output PNG (default /tmp/blender-out)
  --frames N    jumlah frame 24fps (default 48 = 2 detik)
  --res W H     resolusi (default 540 960 — preview cepat; produksi 1080 1920)
  --samples N   Cycles samples (default 48; naikkan utk produksi 128+)
"""

import bpy
import sys
import math
import argparse


def argv_after_dd():
    """Argumen setelah '--' milik script ini (bukan milik Blender)."""
    if '--' in sys.argv:
        return sys.argv[sys.argv.index('--') + 1:]
    return []


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def gold_material(name, base=(1.0, 0.76, 0.22, 1.0), metallic=0.85, rough=0.38):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = base
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    return mat


def blue_material(name, base=(0.12, 0.32, 0.75, 1.0), metallic=0.15, rough=0.45):
    return gold_material(name, base, metallic, rough)


def add_text(text, mat, size, loc, extrude=0.02):
    cur = bpy.data.curves.new(type='FONT', name=f'TXT_{text}')
    cur.body = text
    cur.size = size
    cur.extrude = extrude
    cur.align_x = 'CENTER'
    cur.align_y = 'CENTER'
    obj = bpy.data.objects.new(f'TXT_{text}', cur)
    obj.location = loc
    # Teks Blender default digelar datar (menghadap +Z / atas) — diputar 90°
    # di sumbu X supaya muka teks menghadap kamera (-Y).
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_candle(x, base_z, body_h, mat_body, mat_wick):
    """Satu candlestick: badan kotak + wick tipis di atas-bawah."""
    import bmesh
    mesh = bpy.data.meshes.new('cube')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    body = bpy.data.objects.new(f'CANDLE_{x}', mesh)
    body.scale = (0.28, 0.28, max(body_h, 0.02))
    body.location = (x, 0.0, base_z + body_h / 2)
    body.data.materials.append(mat_body)
    bpy.context.scene.collection.objects.link(body)

    wick_h = body_h * 0.6
    wick = bpy.data.objects.new(f'WICK_{x}', mesh.copy())
    wick.scale = (0.05, 0.05, wick_h)
    wick.location = (x, 0.0, base_z + body_h / 2 + body_h / 2 + wick_h / 2 * 0.9)
    wick.data.materials.append(mat_wick)
    bpy.context.scene.collection.objects.link(wick)
    return body


def setup_camera():
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.lens = 42
    cam = bpy.data.objects.new('Cam', cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def keyframes(cam, text_obj, frames):
    """Dolly-in kamera + teks naik perlahan — gerak sinematik ringan."""
    sc = bpy.context.scene
    n = frames
    for i, f in enumerate([1, n]):
        t = i / max(1, n - 1)
        cam.location = (0.0, -7.0 + 1.5 * t, 1.75 - 0.3 * t)
        cam.rotation_euler = (math.radians(84 - 2 * t), 0.0, math.radians(6 * math.sin(t * math.pi)))
        cam.keyframe_insert(data_path='location', frame=f)
        cam.keyframe_insert(data_path='rotation_euler', frame=f)
        text_obj.location = (0.0, 0.0, 1.35 + 0.15 * t)
        text_obj.keyframe_insert(data_path='location', frame=f)
    sc.frame_start = 1
    sc.frame_end = n


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--out', default='/tmp/blender-out')
    args.add_argument('--frames', type=int, default=48)
    args.add_argument('--res', nargs=2, type=int, default=(540, 960))
    args.add_argument('--samples', type=int, default=48)
    opts = args.parse_args(argv_after_dd())

    clean_scene()

    # ── Material brand ──
    gold = gold_material('Gold')
    blue = blue_material('Blue')
    dim = blue_material('BlueDim', base=(0.14, 0.34, 0.78, 1.0), metallic=0.1, rough=0.5)

    # ── Teks utama ──
    title = add_text('LUXTRADEE', gold, 0.50, (0.0, 0.0, 1.35), extrude=0.05)
    add_text('AI TRADING JOURNAL', blue, 0.13, (0.0, 0.0, 1.02), extrude=0.01)

    # ── Candlestick naik (XAUUSD vibe) ──
    heights = [0.25, 0.4, 0.33, 0.55, 0.5, 0.72, 0.9]
    xs = [-1.35 + i * 0.45 for i in range(len(heights))]
    for x, h in zip(xs, heights):
        add_candle(x, -0.4, h, gold if h > 0.5 else dim, dim)

    # ── Lantai reflektif tipis ──
    import bmesh
    floor_mesh = bpy.data.meshes.new('floor')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(floor_mesh)
    bm.free()
    floor = bpy.data.objects.new('Floor', floor_mesh)
    floor.scale = (4.0, 4.0, 0.02)
    floor.location = (0.0, 0.0, -0.45)
    floor_mat = gold_material('FloorMat', base=(0.05, 0.09, 0.16, 1.0), metallic=0.7, rough=0.4)
    floor.data.materials.append(floor_mat)
    bpy.context.scene.collection.objects.link(floor)

    # ── Lighting ──
    key_l = bpy.data.lights.new('Key', type='AREA')
    key_l.energy = 1800
    key_l.size = 4.0
    key = bpy.data.objects.new('Key', key_l)
    key.location = (3.0, -4.0, 5.0)
    key.rotation_euler = (math.radians(55), 0, math.radians(35))
    bpy.context.scene.collection.objects.link(key)

    rim_l = bpy.data.lights.new('Rim', type='AREA')
    rim_l.energy = 900
    rim_l.color = (0.5, 0.7, 1.0)  # rim biru — brand
    rim = bpy.data.objects.new('Rim', rim_l)
    rim.location = (-4.0, -2.0, 3.5)
    rim.rotation_euler = (math.radians(65), 0, math.radians(-50))
    bpy.context.scene.collection.objects.link(rim)

    # Fill hangat dari depan — WAJIB utk teks metalik: tanpa ini muka teks
    # cuma pantulkan world gelap (metallic = refleksi saja) → teks 'hilang'
    fill_l = bpy.data.lights.new('Fill', type='AREA')
    fill_l.energy = 700
    fill_l.size = 6.0
    fill_l.color = (1.0, 0.9, 0.7)
    fill = bpy.data.objects.new('Fill', fill_l)
    fill.location = (0.0, -6.0, 2.2)
    fill.rotation_euler = (math.radians(75), 0, 0)
    bpy.context.scene.collection.objects.link(fill)

    # ── World navy gelap ──
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.02, 0.04, 0.09, 1.0)
    bg.inputs['Strength'].default_value = 1.0
    bpy.context.scene.world = world

    # ── Kamera + animasi ──
    cam = setup_camera()
    keyframes(cam, title, opts.frames)

    # ── Render settings: Cycles CPU (headless-safe) ──
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = opts.samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = opts.res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = f"{opts.out.rstrip('/')}/frame_"

    import os
    os.makedirs(opts.out, exist_ok=True)
    bpy.ops.render.render(animation=True)
    print('RENDER_DONE', opts.out, opts.frames, 'frames')


main()
