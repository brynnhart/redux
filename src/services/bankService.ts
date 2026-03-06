import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';

const BIGINT_MAX = 9_223_372_036_854_775_807;

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

    const nextBank = this.safeAdd(player.bank_gold, amount);
    this.playerRepo.updatePlayerStats(player.id, {
      gold: player.gold - amount,
      bank_gold: nextBank.value
    });

    if (nextBank.clamped) {
      return { ok: true, message: `You deposit ${amount} gold. The vault overflows, so excess coin is discarded.` };
    }

    return { ok: true, message: `You deposit ${amount} gold.` };
  }

  depositAll(player: PlayerRecord): BankTransactionResult {
    if (player.gold <= 0) {
      return { ok: false, message: 'Your pockets are empty.' };
    }
    return this.deposit(player, player.gold);
  }

  withdraw(player: PlayerRecord, amount: number): BankTransactionResult {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, message: 'That is not a real amount. Try a positive integer.' };
    }
    if (amount > player.bank_gold) {
      return { ok: false, message: 'The vault is not a magical bottomless pit. Too much.' };
    }

    const nextPocket = this.safeAdd(player.gold, amount);
    this.playerRepo.updatePlayerStats(player.id, {
      gold: nextPocket.value,
      bank_gold: player.bank_gold - amount
    });

    if (nextPocket.clamped) {
      return { ok: true, message: `You withdraw ${amount} gold, but can only carry so much. Excess coin stays in limbo.` };
    }

    return { ok: true, message: `You withdraw ${amount} gold.` };
  }

  private safeAdd(left: number, right: number) {
    const total = left + right;
    if (total > BIGINT_MAX) {
      return { value: BIGINT_MAX, clamped: true };
    }
    return { value: total, clamped: false };
  }
}
