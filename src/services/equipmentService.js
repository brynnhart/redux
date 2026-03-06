import { getArmorById, getSellPrice, getStarterArmor, getStarterWeapon, getWeaponById, listBuyableArmor, listBuyableWeapons } from '../data/equipment.js';
export class EquipmentService {
    playerRepo;
    constructor(playerRepo) {
        this.playerRepo = playerRepo;
    }
    buyWeapon(player, targetTier, autoSell = false) {
        return this.buy(player, targetTier, 'weapon', autoSell);
    }
    buyArmor(player, targetTier, autoSell = false) {
        return this.buy(player, targetTier, 'armor', autoSell);
    }
    sellWeapon(player) {
        return this.sell(player, 'weapon');
    }
    sellArmor(player) {
        return this.sell(player, 'armor');
    }
    buy(player, targetTier, slot, autoSell) {
        const options = slot === 'weapon' ? listBuyableWeapons() : listBuyableArmor();
        if (!Number.isInteger(targetTier) || targetTier < 1 || targetTier > options.length) {
            return { ok: false, message: `Pick an item # between 1 and ${options.length}.` };
        }
        const current = slot === 'weapon' ? getWeaponById(player.weapon_id) : getArmorById(player.armor_id);
        const starter = slot === 'weapon' ? getStarterWeapon() : getStarterArmor();
        const selected = options[targetTier - 1];
        if (current.id !== starter.id && !autoSell) {
            return { ok: false, message: `You already have ${slot === 'weapon' ? 'a weapon' : 'armor'}. (S)ell it first.` };
        }
        if (current.id === selected.id) {
            return { ok: false, message: `You already have ${selected.name} equipped.` };
        }
        const sellCredit = current.id !== starter.id && autoSell ? getSellPrice(current.cost) : 0;
        const netCost = selected.cost - sellCredit;
        if (player.gold_on_hand < netCost) {
            return { ok: false, message: `You need ${netCost} gold on hand for ${selected.name}.` };
        }
        this.playerRepo.updatePlayerStats(player.id, {
            gold_on_hand: player.gold_on_hand - netCost,
            ...(slot === 'weapon' ? { weapon_id: selected.id } : { armor_id: selected.id })
        });
        const sellText = sellCredit > 0 ? ` after selling ${current.name} for ${sellCredit}` : '';
        return { ok: true, message: `You buy ${selected.name} for ${selected.cost} gold${sellText}.` };
    }
    sell(player, slot) {
        const current = slot === 'weapon' ? getWeaponById(player.weapon_id) : getArmorById(player.armor_id);
        const starter = slot === 'weapon' ? getStarterWeapon() : getStarterArmor();
        if (current.id === starter.id) {
            return { ok: false, message: `Nobody pays for ${current.name}.` };
        }
        const sellPrice = getSellPrice(current.cost);
        this.playerRepo.updatePlayerStats(player.id, {
            gold_on_hand: player.gold_on_hand + sellPrice,
            ...(slot === 'weapon' ? { weapon_id: starter.id } : { armor_id: starter.id })
        });
        return { ok: true, message: `Sold ${current.name} for ${sellPrice} gold.` };
    }
}
