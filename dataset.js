function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

const DYE_NAMES = ['White','Orange','Magenta','Light Blue','Yellow','Lime','Pink','Gray','Light Gray','Cyan','Purple','Blue','Brown','Green','Red','Black'];
const DYE_IDS   = ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
const CONCRETE_HEX = ['#E4E4E4','#D87424','#A0359E','#2489C4','#F0B41C','#66A81E','#D6658D','#3A3D3D','#7E7E76','#157C8C','#67209F','#2B2F8E','#603D22','#495B23','#8E2121','#131417'];
const WOOL_HEX     = ['#E9ECEC','#E17A25','#BF4CCB','#4E90CE','#E6C82D','#7FB238','#EBA5B5','#494B4D','#9A9C99','#298C8C','#7D35C2','#35399D','#6B4227','#55701A','#A5292A','#191919'];

const concreteBlocks = DYE_IDS.map((id, i) => ({ id: `${id}_concrete`, name: `${DYE_NAMES[i]} Concrete`, family: 'concrete', hex: CONCRETE_HEX[i], tex: { roughness: .06, grain: .04, angle: 0 } }));
const woolBlocks = DYE_IDS.map((id, i) => ({ id: `${id}_wool`, name: `${DYE_NAMES[i]} Wool`, family: 'wool', hex: WOOL_HEX[i], tex: { roughness: .19, grain: .05, angle: 0 } }));

const OTHER_BLOCKS = [
  { id: 'smooth_stone', name: 'Smooth Stone', family: 'stone', hex: '#E4E2D8', tex: { roughness: .1, grain: .05, angle: 0 } },
  { id: 'andesite', name: 'Andesite', family: 'stone', hex: '#7B7B79', tex: { roughness: .55, grain: .08, angle: 0 } },
  { id: 'diorite', name: 'Diorite', family: 'stone', hex: '#B7B6B0', tex: { roughness: .5, grain: .15, angle: 0 } },
  { id: 'deepslate', name: 'Deepslate', family: 'stone', hex: '#38393B', tex: { roughness: .6, grain: .08, angle: 0 } },
  { id: 'blackstone', name: 'Blackstone', family: 'stone', hex: '#3A3336', tex: { roughness: .5, grain: .1, angle: 0 } },
  { id: 'stone_bricks', name: 'Stone Bricks', family: 'stone', hex: '#8A8A83', tex: { roughness: .3, grain: .55, angle: 45 } },
  { id: 'oak_planks', name: 'Oak Planks', family: 'wood', hex: '#B4894F', tex: { roughness: .35, grain: .7, angle: 0 } },
  { id: 'birch_planks', name: 'Birch Planks', family: 'wood', hex: '#D9CE9C', tex: { roughness: .22, grain: .4, angle: 90 } },
  { id: 'dark_oak_planks', name: 'Dark Oak Planks', family: 'wood', hex: '#3E2C18', tex: { roughness: .4, grain: .65, angle: 0 } },
  { id: 'terracotta', name: 'Terracotta', family: 'terracotta', hex: '#9C5333', tex: { roughness: .4, grain: .2, angle: 0 } },
  { id: 'orange_terracotta', name: 'Orange Terracotta', family: 'terracotta', hex: '#A04D28', tex: { roughness: .4, grain: .2, angle: 0 } },
  { id: 'white_terracotta', name: 'White Terracotta', family: 'terracotta', hex: '#D1B4A3', tex: { roughness: .35, grain: .2, angle: 0 } },
];

const SAMPLE_RAW = [...concreteBlocks, ...woolBlocks, ...OTHER_BLOCKS];

function normalizeBlock(b) {
  const rgb = b.rgb || (b.hex ? hexToRgb(b.hex) : labToRgb(...b.lab));
  const lab = b.lab || rgbToLab(...rgb);
  const tex = { roughness: 0, grain: 0, angle: 0, ...(b.tex || {}) };
  const image = typeof b.image === 'string' ? b.image : (typeof b.texture === 'string' ? b.texture : (b.textureUrl || b.src || b.dataUrl || null));
  const shape = (b.shape === 'other' || b.shape === 'complementary') ? b.shape : 'cube';
  const spread = typeof b.spread === 'number' ? b.spread : 0;
  return { id: b.id, name: b.name || b.id, family: b.family || null, rgb, lab, tex, image, shape, spread };
}

function buildSampleDataset() { return SAMPLE_RAW.map(normalizeBlock); }

function validateAndNormalize(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Expected a JSON array of block objects.');
  return raw.map((b, i) => {
    if (!b || typeof b !== 'object') throw new Error(`Entry ${i} is not an object.`);
    if (!b.id) throw new Error(`Entry ${i} is missing "id".`);
    if (!b.rgb && !b.lab && !b.hex) throw new Error(`Block "${b.id}" needs "rgb", "lab", or "hex".`);
    if (!b.tex) throw new Error(`Block "${b.id}" needs "tex": { roughness, grain, angle }.`);
    return normalizeBlock(b);
  });
}
