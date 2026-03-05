export interface EquipmentTier {
  tier: number;
  name: string;
  price: number;
  bonus: number;
}

const WEAPON_NAMES = [
  'Stick',
  'Dagger',
  'Short Sword',
  'Long Sword',
  'Huge Axe',
  'Bone Cruncher',
  'Twin Swords',
  'Power Axe',
  "Able's Sword",
  "Wan's Weapon",
  'Spear of Gold',
  'Crystal Shard',
  "Nira's Teeth",
  'Blood Sword',
  'Death Sword'
] as const;

const ARMOR_NAMES = [
  'Rags',
  'Leather Jerkin',
  'Studded Leather',
  'Chain Shirt',
  'Chain Hauberk',
  'Plate Mail',
  'Dragon Scale Vest',
  'Armor of Death',
  "Able's Armor",
  "Wan's Ward",
  'Golden Aegis',
  'Magic Protection',
  "Nira's Carapace",
  'Blood Plate',
  'Death Plate'
] as const;

const EQUIPMENT_PRICES = [200, 1000, 3000, 10000, 30000, 100000, 150000, 200000, 400000, 1000000, 4000000, 10000000, 40000000, 100000000, 400000000] as const;
const WEAPON_BONUSES = [0, 5, 12, 25, 40, 70, 95, 120, 180, 260, 380, 500, 650, 800, 1000] as const;
const ARMOR_BONUSES = [0, 3, 8, 15, 25, 45, 60, 75, 100, 140, 200, 300, 420, 600, 900] as const;

export const WEAPON_TIERS: EquipmentTier[] = WEAPON_NAMES.map((name, index) => ({
  tier: index + 1,
  name,
  price: EQUIPMENT_PRICES[index],
  bonus: WEAPON_BONUSES[index]
}));

export const ARMOR_TIERS: EquipmentTier[] = ARMOR_NAMES.map((name, index) => ({
  tier: index + 1,
  name,
  price: EQUIPMENT_PRICES[index],
  bonus: ARMOR_BONUSES[index]
}));

function byTier(tiers: EquipmentTier[], tier: number) {
  return tiers[Math.min(Math.max(1, tier), tiers.length) - 1];
}

export function getWeaponTier(tier: number) {
  return byTier(WEAPON_TIERS, tier);
}

export function getArmorTier(tier: number) {
  return byTier(ARMOR_TIERS, tier);
}

export function getSellPrice(price: number) {
  return Math.floor(price * 0.5);
}
