"""Import selected PNG artwork, never executable/JSON instructions, from assets.zip.

Development-only dependency: Pillow. Run with the ZIP path as the sole argument.
Generated RLE pixels decode synchronously, including in the offline HTML/EXE.
"""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
import base64
import hashlib
import io
import json
import sys

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/supplied-pack'
OUT.mkdir(parents=True, exist_ok=True)
blocks = {}

def block(key, top, side=None, bottom=None):
    blocks[key] = [top, side or top, bottom or top]

for key in ['dirt', 'stone', 'sand', 'coal_ore', 'iron_ore', 'diamond_ore',
            'bedrock', 'glass', 'torch', 'gravel', 'obsidian', 'poppy',
            'cornflower', 'lapis_ore', 'terracotta', 'red_sand', 'ice',
            'copper_ore', 'gold_ore', 'emerald_ore', 'coal_block', 'iron_block',
            'copper_block', 'gold_block', 'diamond_block', 'lapis_block',
            'emerald_block', 'raw_iron_block', 'raw_copper_block', 'raw_gold_block',
            'stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks',
            'granite', 'diorite', 'andesite', 'clay', 'packed_ice', 'cobweb']:
    block(key, key)
for key, name in {'planks':'oak_planks', 'leaves':'oak_leaves',
                  'cobble':'cobblestone', 'brick':'bricks', 'snow':'snow',
                  'wool':'white_wool', 'crop':'wheat_stage7',
                  'wild_grass':'short_grass', 'pine_leaves':'spruce_leaves',
                  'birch_leaves':'birch_leaves', 'moss':'moss_block',
                  'fern':'fern', 'sugar_cane':'sugar_cane', 'bamboo':'bamboo_stalk',
                  'dripstone':'dripstone_block', 'mine_rail':'rail',
                  'fire':'fire_0', 'portal':'nether_portal',
                  'water':'water_still', 'lava':'lava_still'}.items():
    block(key, name)
block('grass', 'grass_block_top', 'grass_block_side', 'dirt')
block('log', 'oak_log_top', 'oak_log')
block('pine_log', 'spruce_log_top', 'spruce_log')
block('birch_log', 'birch_log_top', 'birch_log')
block('crafting_table', 'crafting_table_top', 'crafting_table_side', 'oak_planks')
block('furnace', 'furnace_top', 'furnace_side')
block('farmland', 'farmland_moist', 'dirt', 'dirt')
block('basalt', 'basalt_top', 'basalt_side')
block('path', 'dirt_path_top', 'dirt_path_side', 'dirt')
block('sandstone', 'sandstone_top', 'sandstone', 'sandstone_bottom')
block('enchanting_table', 'enchanting_table_top', 'enchanting_table_side', 'enchanting_table_bottom')
block('cactus', 'cactus_top', 'cactus_side', 'cactus_bottom')
block('smooth_stone', 'smooth_stone', 'smooth_stone')
block('hay_bale', 'hay_block_top', 'hay_block_side')
block('bookshelf', 'oak_planks', 'bookshelf')
block('jukebox', 'jukebox_top', 'jukebox_side', 'oak_planks')
for key in ['tnt', 'primed_tnt']:
    block(key, 'tnt_top', 'tnt_side', 'tnt_bottom')
for fluid in ['water', 'lava']:
    for level in range(1, 9):
        block(f'{fluid}_flow_{level}', f'{fluid}_still')

# The engine has three face slots. A door's state selects its upper/lower tile.
block('oak_door_lower', 'oak_door_bottom')
block('oak_door_upper', 'oak_door_top')

tints = {'grass_block_top': [128, 189, 76], 'oak_leaves': [89, 156, 64],
         'spruce_leaves': [99, 143, 112], 'birch_leaves': [128, 166, 80],
         'short_grass': [119, 172, 71], 'fern': [105, 165, 91],
         'water_still': [62, 119, 225]}

def encode(rgba):
    encoded = bytearray()
    for p in rgba:
        if encoded and tuple(encoded[-4:]) == p and encoded[-5] < 255:
            encoded[-5] += 1
        else:
            encoded.extend((1, *p))
    return base64.b64encode(encoded).decode()

with ZipFile(sys.argv[1]) as archive:
    prefix = 'assets/minecraft/textures/'
    item_names = ['stick', 'coal', 'charcoal', 'raw_copper', 'copper_ingot',
                  'raw_gold', 'gold_ingot', 'clay_ball', 'bucket', 'water_bucket',
                  'lava_bucket', 'raw_iron', 'iron_ingot', 'diamond', 'wheat',
                  'apple', 'bread', 'leather', 'flint', 'emerald', 'feather',
                  'rotten_flesh', 'bone', 'bone_meal', 'string', 'gunpowder',
                  'flint_and_steel', 'lapis_lazuli', 'paper', 'book']
    for tier in ['wooden', 'golden', 'stone', 'iron', 'diamond']:
        item_names += [f'{tier}_{kind}' for kind in ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']]
    for tier in ['leather', 'golden', 'iron', 'diamond']:
        item_names += [f'{tier}_{kind}' for kind in ['helmet', 'chestplate', 'leggings', 'boots']]
    item_names += [f'{mob}_spawn_egg' for mob in ['zombie', 'creeper', 'spider', 'skeleton', 'panda',
                    'iron_golem', 'cow', 'chicken', 'rabbit', 'villager']]
    items = {key: key for key in item_names}
    items.update({'brick_item':'brick', 'seeds':'wheat_seeds', 'raw_meat':'porkchop',
                  'cooked_meat':'cooked_porkchop', 'grazer_spawn_egg':'pig_spawn_egg',
                  'woolling_spawn_egg':'sheep_spawn_egg'})
    items.update({'torch':'block/torch','sugar_cane':'sugar_cane','bamboo':'bamboo','oak_door':'oak_door','mine_rail':'block/rail','cobweb':'block/cobweb','fern':'block/fern','wild_grass':'block/short_grass','poppy':'block/poppy','cornflower':'block/cornflower'})
    sources = sorted({f'block/{name}' for faces in blocks.values() for name in faces}
                     | {'block/furnace_front','block/crafting_table_front'}
                     | {name if '/' in name else f'item/{name}' for name in items.values()})
    pixels, provenance = {}, []
    for name in sources:
        member = f'{prefix}{name}.png'
        data = archive.read(member)  # Fixed allowlist: no ZIP path extraction.
        target = OUT / f'{name}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        image = Image.open(io.BytesIO(data)).convert('RGBA')
        width, height = image.size
        # These mapped tiles are native 16px. Animated strips use frame zero;
        # existing fluid shimmer remains controlled by Animated Textures.
        if width != 16 or height < 16:
            raise ValueError(f'Expected native 16px tile: {member}: {image.size}')
        image = image.crop((0, 0, 16, 16))
        tint = tints.get(name.split('/')[-1]) if name.startswith('block/') else None
        if name == 'block/bamboo_stalk':
            shaft = Image.new('RGBA',(16,16))
            shaft.paste(image.crop((0,0,3,16)),(6,0))
            image = shaft
        rgba = list(image.getdata())
        if tint:
            rgba = [tuple(round(p[c] * tint[c] / 255) for c in range(3)) + (p[3],) for p in rgba]
        pixels[name] = encode(rgba)
        provenance.append({'path': member, 'sha256': hashlib.sha256(data).hexdigest(),
                           'size': [width, height], 'tint': tint, 'frames_used': 1, 'pixel_cutout': {'source':[0,0,3,16],'destination':[6,0,3,16],'background_alpha':0} if name=='block/bamboo_stalk' else None})
    # Convert the supplied chest UV sheet into the engine's block face tiles.
    member = prefix + 'entity/chest/normal.png'
    data = archive.read(member)
    target = OUT / 'entity/chest/normal.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    chest = Image.open(io.BytesIO(data)).convert('RGBA')
    top = chest.crop((14,0,28,14)).resize((16,16),Image.Resampling.NEAREST)
    side = Image.new('RGBA',(16,16))
    side.paste(chest.crop((14,14,28,19)).resize((16,5),Image.Resampling.NEAREST),(0,0))
    side.paste(chest.crop((14,33,28,43)).resize((16,11),Image.Resampling.NEAREST),(0,5))
    front = side.copy()
    lock = chest.crop((1,1,3,5)).resize((2,5),Image.Resampling.NEAREST)
    front.paste(lock,(7,4),lock)
    for name, image in [('chest_top',top),('chest_side',side),('chest_front',front)]:
        pixels['block/'+name] = encode(list(image.getdata()))
    blocks['chest'] = ['chest_top','chest_side','oak_planks']
    provenance.append({'path':member,'sha256':hashlib.sha256(data).hexdigest(),'size':list(chest.size),
                       'tint':None,'frames_used':1,'derived_tiles':['chest_top','chest_side','chest_front']})
    manifest = {'name': 'Supplied Assets', 'id': 'supplied', 'source_archive': 'assets.zip',
                'source_sha256': hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),
                'notice': 'User-supplied Minecraft artwork; Mojang/Microsoft rights are retained. Not original DCSMCRAFT art.',
                'blocks': blocks, 'items': items, 'assets': provenance, 'world_face_crops': {'torch_top':[7,6,2,2],'torch_side':[7,6,2,10],'torch_bottom':[7,14,2,2]}, 'extra_faces': ['furnace_front','crafting_table_front','chest_front']}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    module = '// Generated by scripts/import-texture-pack.py. See public/supplied-pack/manifest.json.\n'
    for key, value in [('SUPPLIED_BLOCKS', blocks), ('SUPPLIED_ITEMS', items), ('SUPPLIED_PIXELS', pixels)]:
        module += f'export const {key} = ' + json.dumps(value, separators=(',', ':')) + ';\n'
    (ROOT / 'src/supplied-pack-data.js').write_text(module)
    print(f'Imported {len(provenance)} PNGs; {len(blocks)} block mappings; {len(items)} item mappings.')
