import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';

export interface BankTransactionResult {
  ok: boolean;
  message: string;
}

export class BankService {
  constructor(private readonly playerRepo: PlayerRepo) {}

  deposit(player: PlayerRecord, amount: number): BankTransactionResult {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, message: 'That is not a real amount. Try a positive integer.' };
    }
    if (amount > player.gold) {
      return { ok: false, message: "You pat your pockets and come up short. That's too much gold." };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - amount,
      bank_gold: player.bank_gold + amount
    });

    return { ok: true, message: `You deposit ${amount} gold.` };
  }

  withdraw(player: PlayerRecord, amount: number): BankTransactionResult {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, message: 'That is not a real amount. Try a positive integer.' };
    }
    if (amount > player.bank_gold) {
      return { ok: false, message: 'The vault is not a magical bottomless pit. Too much.' };
    }

    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold + amount,
      bank_gold: player.bank_gold - amount
    });

    return { ok: true, message: `You withdraw ${amount} gold.` };
  }
}
