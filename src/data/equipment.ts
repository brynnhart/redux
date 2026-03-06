import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface WeaponDefinition {
  id: string;
  name: string;
  cost: number;
  tier: number;
  atk_bonus: number;
}

export interface ArmorDefinition {
  id: string;
  name: string;
  cost: number;
  tier: number;
  def_bonus: number;
}

function loadDefinitions<T>(fileName: string): T[] {
  const filePath = path.resolve(process.cwd(), 'data', fileName);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T[];
}

export const WEAPONS = loadDefinitions<WeaponDefinition>('equipment.weapons.json');
export const ARMOR = loadDefinitions<ArmorDefinition>('equipment.armor.json');

export const STARTER_WEAPON_ID = 'bare_hands';
export const STARTER_ARMOR_ID = 'rags';

const weaponById = new Map(WEAPONS.map((weapon) => [weapon.id, weapon]));
const weaponByTier = new Map(WEAPONS.map((weapon) => [weapon.tier, weapon]));
const armorById = new Map(ARMOR.map((piece) => [piece.id, piece]));
const armorByTier = new Map(ARMOR.map((piece) => [piece.tier, piece]));

export function listBuyableWeapons() {
  return WEAPONS.filter((weapon) => weapon.tier >= 1);
}

export function listBuyableArmor() {
  return ARMOR.filter((piece) => piece.tier >= 1);
}

export function getWeaponById(id: string) {
  return weaponById.get(id) ?? getStarterWeapon();
}

export function getArmorById(id: string) {
  return armorById.get(id) ?? getStarterArmor();
}

export function getWeaponByTier(tier: number) {
  return weaponByTier.get(tier) ?? getStarterWeapon();
}

export function getArmorByTier(tier: number) {
  return armorByTier.get(tier) ?? getStarterArmor();
}

export function getStarterWeapon() {
  const starter = weaponById.get(STARTER_WEAPON_ID);
  if (!starter) {
    throw new Error('Starter weapon is missing from equipment.weapons.json');
  }
  return starter;
}

export function getStarterArmor() {
  const starter = armorById.get(STARTER_ARMOR_ID);
  if (!starter) {
    throw new Error('Starter armor is missing from equipment.armor.json');
  }
  return starter;
}

export function getSellPrice(cost: number) {
  return Math.floor(cost * 0.5);
}
