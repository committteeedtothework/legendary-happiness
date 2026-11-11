#!/usr/bin/env python3
"""Original content profile generator. Network required only when refreshing factual inputs."""
import json,re,pathlib,urllib.request,tempfile,argparse
parser=argparse.ArgumentParser(description='Regenerate the pinned Java 26.3 factual content profile; no art/models are downloaded.')
parser.add_argument('--cache-dir',type=pathlib.Path,default=pathlib.Path(tempfile.gettempdir())/'dcsmcraft-26.3-reference')
args=parser.parse_args();cache=args.cache_dir;cache.mkdir(parents=True,exist_ok=True)
sources={'minecraft-registries-26.3.json':'registries/data.json','mc263-misode-item_components.json':'item_components/data.json','mc263-misode-blocks.json':'blocks/data.json','mc263-data-recipe.json':'data/recipe/data.json','mc263-data-tag-item.json':'data/tag/item/data.json','mc263-data-tag-block.json':'data/tag/block/data.json'}
for name,relative in sources.items():
 path=cache/name
 if not path.exists():
  request=urllib.request.Request('https://raw.githubusercontent.com/misode/mcmeta/26.3-summary/'+relative,headers={'User-Agent':'DCSMCRAFT factual content audit'})
  with urllib.request.urlopen(request,timeout=60)as response:path.write_bytes(response.read())

root=pathlib.Path(__file__).resolve().parent.parent
r=json.load(open(cache/'minecraft-registries-26.3.json')); components=json.load(open(cache/'mc263-misode-item_components.json')); states=json.load(open(cache/'mc263-misode-blocks.json')); recipes=json.load(open(cache/'mc263-data-recipe.json')); tags=json.load(open(cache/'mc263-data-tag-item.json'));btags=json.load(open(cache/'mc263-data-tag-block.json'))
alias={'hay_block':'hay_bale','grass_block':'grass','oak_log':'log','oak_leaves':'leaves','oak_planks':'planks','cobblestone':'cobble','bricks':'brick','brick':'brick_item','snow_block':'snow','white_wool':'wool','red_bed':'bed','spruce_log':'pine_log','spruce_leaves':'pine_leaves','dirt_path':'path','moss_block':'moss','wheat_seeds':'seeds','beef':'raw_meat','cooked_beef':'cooked_meat','rail':'mine_rail','pointed_dripstone':'dripstone','sea_pickle':'sea_pickle_1','turtle_egg':'turtle_egg_1_0','short_grass':'wild_grass'}
def clean(n):return n.removeprefix('minecraft:')
def resolve_tag(n, seen=None):
 seen=seen or set()
 if n in seen:return []
 seen=seen|{n};out=[]
 for x in tags.get(n,{}).get('values',[]):
  if isinstance(x,dict):x=x['id']
  out+=resolve_tag(clean(x[1:]),seen) if x.startswith('#') else [clean(x)]
 return list(dict.fromkeys(out))
def blocktag(n):
 out=[]
 for x in btags.get(n,{}).get('values',[]):
  if isinstance(x,dict):x=x['id']
  out+=blocktag(clean(x[1:])) if x.startswith('#') else [clean(x)]
 return set(out)
mining={t:blocktag('mineable/'+t) for t in ['pickaxe','axe','shovel','hoe']}
tiers={t:blocktag('needs_'+t+'_tool') for t in ['stone','iron','diamond']}
# Explicitly scoped technical/dimension exclusions. Other unsupported systems stay deferred.
exclusions={}
for n in set(r['block']+r['item']):
 if re.search(r'^(air|cave_air|void_air|barrier|light|structure_void|structure_block|jigsaw|debug_stick|command_block|chain_command_block|repeating_command_block|command_block_minecart|test_block|test_instance_block|knowledge_book|player_head|player_wall_head|moving_piston|piston_head|nether_portal|end_portal|end_gateway|end_portal_frame)$',n):exclusions[n]='Administrative, technical, or invisible world state; outside ordinary play.'
 elif re.search(r'^(end_stone|end_rod|end_crystal|ender_dragon_spawn_egg|dragon_|purpur_|chorus_|shulker|elytra)',n):exclusions[n]='End progression is not part of this Overworld / Cinderworld build.'
# Accept blocks only where an original shape and a meaningful interaction can be supplied.
wood='oak spruce birch jungle acacia dark_oak mangrove cherry pale_oak bamboo crimson warped poplar'.split()
plant_names=set('dandelion blue_orchid allium azure_bluet oxeye_daisy lily_of_the_valley wither_rose torchflower closed_eyeblossom open_eyeblossom brown_mushroom red_mushroom dead_bush bush firefly_bush short_dry_grass tall_dry_grass pink_petals wildflowers leaf_litter crimson_fungus warped_fungus crimson_roots warped_roots nether_sprouts hanging_roots glow_lichen spore_blossom azalea flowering_azalea big_dripleaf small_dripleaf pitcher_plant tall_grass large_fern sunflower lilac rose_bush peony'.split())
# Devices with a different simulation contract are deliberately deferred, not inert creative entries.
device=re.compile(r'(redstone|repeater|comparator|piston|observer|hopper|dispenser|dropper|sculk|trial|spawner|vault|crafter|target|daylight_detector|lightning_rod|respawn_anchor|beacon|bell|lectern|composter|beehive|bee_nest|decorated_pot|chiseled_bookshelf|lodestone|suspicious_|sniffer_egg|creaking_heart|heavy_core|copper_golem|cushion|shelf|sulfur_cube|sulfur_spike|sulfur_vent|sulfur_pot)')
blockdefs=[]
for n in r['block']:
 if n in exclusions or n not in r['item'] or device.search(n):continue
 shape=None; extra={}
 if n.endswith('_slab'):shape='slab';extra['parent']=n[:-5]
 elif n.endswith('_stairs'):shape='stairs';extra['parent']=n[:-7]
 elif n.endswith('_fence_gate'):shape='gate';extra['parent']=n[:-11]+'_planks'
 elif n.endswith('_fence'):shape='fence';extra['parent']=n[:-6]+'_planks'
 elif n.endswith('_wall') and n not in ['cobweb']:shape='wall';extra['parent']=n[:-5]
 elif n.endswith('_trapdoor'):shape='trapdoor'
 elif n.endswith('_door'):shape='door'
 elif n.endswith('_carpet') or n=='moss_carpet':shape='carpet';extra['parent']=n[:-7]+'_wool'
 elif n.endswith('_pane') or n=='iron_bars' or n.endswith('copper_bars'):shape='pane';extra['parent']=n[:-5] if n.endswith('_pane') else n
 elif n.endswith('_sapling') or n.endswith('_propagule') or n in plant_names:shape='plant';extra['sapling']=n.removesuffix('_sapling').removesuffix('_propagule') if n.endswith(('_sapling','_propagule')) else None
 elif n in ['ladder','vine','weeping_vines','twisting_vines']:shape='ladder' if n in ['ladder','vine'] else 'plant'
 elif n.endswith('_chain') or n=='chain':shape='chain'
 elif n in ['lantern','soul_lantern','copper_lantern'] or n.endswith('copper_lantern'):shape='lantern'
 elif n=='flower_pot':shape='pot'
 elif n in ['barrel','smoker','blast_furnace','stonecutter','anvil','chipped_anvil','damaged_anvil','smithing_table','grindstone','loom','cartography_table','fletching_table','campfire','soul_campfire']:shape='workstation'
 elif n.endswith('_button') or n.endswith('_pressure_plate'):continue
 elif n.endswith(('_sign','_banner','_bed','_head','_skull','_candle','_candle_cake','_coral_fan','_hanging_sign')) or n in ['candle','cake','tripwire_hook','lever','brewing_stand','snow','turtle_egg','sea_pickle']:continue
 elif n in ['carrots','potatoes','beetroots','sweet_berry_bush','cocoa','pumpkin_stem','melon_stem','attached_melon_stem','attached_pumpkin_stem']:continue
 else:
  # Cubic construction materials, mineral resources, leaves, logs and organic blocks.
  if any(p in states.get(n,[{},{}])[0] for p in ['facing','attachment','rotation','half','hanging','part','age','age_1','waterlogged']) and not n.endswith(('_leaves','_log','_wood','_stem','_hyphae')):continue
  if re.search(r'(torch|fire|rail|portal|amethyst_bud|amethyst_cluster|dripstone|dripleaf|kelp|seagrass|bamboo$|cactus$|conduit|rooted_dirt|honey_block|slime_block|powder_snow)',n):continue
  shape='cube'
 tool=next((t for t,v in mining.items() if n in v),None);tier=max([0]+[i for t,i in [('stone',2),('iron',3),('diamond',4)] if n in tiers[t]])
 if tool=='pickaxe' and tier==0:tier=1
 blockdefs.append({'key':n,'shape':shape,'tool':tool,'tier':tier,**{k:v for k,v in extra.items() if v is not None}})
# Only functioning item families. Ingredients feed actual imported recipes; paper-only special controls deferred.
itemdefs=[]
rawmaterials=re.compile(r'(ingot|nugget|_scrap|_shard|_crystal|_dye|^raw_|^resin|^netherite_upgrade_smithing_template$|^nether_wart$|^blaze_powder$|^magma_cream$|^ghast_tear$|^glowstone_dust$|^redstone$|^quartz$|^amethyst_shard$|^prismarine|^slime_ball$|^honeycomb$|^sugar$|^cocoa_beans$|^bowl$|^egg$|^rabbit_hide$|^rabbit_foot$|^ink_sac$|^glow_ink_sac$|^flint$|^clay_ball$|^fire_charge$|^snowball$|^coal$|^charcoal$|^breeze_rod$|^wind_charge$|^echo_shard$|^nautilus_shell$)')
for n,c in components.items():
 if n in exclusions or n in r['block']:continue
 typ=n.rsplit('_',1)[-1]
 if typ in ['pickaxe','axe','shovel','hoe','sword','spear','helmet','chestplate','leggings','boots'] or 'minecraft:food' in c or rawmaterials.search(n) or n in ['bow','crossbow','shield','arrow','mace','shears','brush','spyglass','compass','clock','carrot','potato','beetroot','beetroot_seeds','pumpkin_seeds','melon_seeds','sweet_berries','glow_berries']:
  rec={'key':n,'stack':c.get('minecraft:max_stack_size',64)}
  for src,dst in [('minecraft:max_damage','durability'),('minecraft:food','foodData')]:
   if src in c:rec[dst]=c[src]
  rec['attributes']={clean(a['type']):a['amount'] for a in c.get('minecraft:attribute_modifiers',[]) if a.get('operation')=='add_value'}
  if 'minecraft:tool' in c:rec['speed']=max([1]+[v.get('speed',1) for v in c['minecraft:tool']['rules']])
  itemdefs.append(rec)
# Complete factual audit inputs and crafting dataset; no art/model files included.
reference={'version':'26.3','released':'2026-09-15','manifest':'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json','dataSource':'https://github.com/misode/mcmeta/tree/26.3-summary','blocks':r['block'],'items':r['item'],'exclusions':exclusions}
(root/'reference/minecraft-26.3.json').write_text(json.dumps(reference,indent=2)+'\n')
out={'version':'26.3','aliases':alias,'blocks':blockdefs,'items':itemdefs,'recipes':recipes,'tags':{n:resolve_tag(n) for n in tags},'blockNames':r['block'],'itemNames':r['item'],'exclusions':exclusions}
(root/'src/edition-reference.js').write_text('// Version-pinned factual registry/recipe/component data, Java Edition 26.3.\n// No Minecraft source code, models, artwork, or audio. See CONTENT.md.\nexport default '+json.dumps(out,separators=(',',':'))+';\n')
print('Selected block families',len(blockdefs),'item families',len(itemdefs),'recipes',len(recipes))
