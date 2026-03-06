import { loadRepoJson } from './loadRepoJson.js';

const WEAPONS = loadRepoJson('equipment.weapons.json', import.meta.url);
const ARMOR = loadRepoJson('equipment.armor.json', import.meta.url);
const STARTER_WEAPON_ID = 'bare_hands';
const STARTER_ARMOR_ID = 'rags';
const weaponById = new Map(WEAPONS.map((weapon) => [weapon.id, weapon]));
const armorById = new Map(ARMOR.map((piece) => [piece.id, piece]));

export function listBuyableWeapons() {
    return WEAPONS.filter((weapon) => weapon.tier >= 1);
}

export function listBuyableArmor() {
    return ARMOR.filter((piece) => piece.tier >= 1);
}

export function getWeaponById(id) {
    return weaponById.get(id) ?? getStarterWeapon();
}

export function getArmorById(id) {
    return armorById.get(id) ?? getStarterArmor();
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

export function getSellPrice(cost) {
    return Math.floor(cost * 0.5);
}
