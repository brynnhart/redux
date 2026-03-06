import { getDb } from '../db/db.js';
import type { PlayerRecord, PlayerRepo } from '../repos/playerRepo.js';

const BIGINT_MAX = 9_223_372_036_854_775_807;

export interface BankTransactionResult {
  ok: boolean;
  message: string;
}

export class BankService {
  constructor(private readonly playerRepo: PlayerRepo) {}

  deposit(player: PlayerRecord, amount: number): BankTransactionResult {
    const onHand = this.getOnHandGold(player);
    const inBank = this.getBankGold(player);

    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, message: 'That is not a real amount. Try a positive integer.' };
    }
    if (amount > onHand) {
      return { ok: false, message: "You pat your pockets and come up short. That's too much gold." };
    }

    const nextBank = this.safeAdd(inBank, amount);
    this.playerRepo.updatePlayerStats(player.id, {
      gold_on_hand: onHand - amount,
      gold_in_bank: nextBank.value
    });
    this.recordTransaction(player.id, 'deposit', amount);

    if (nextBank.clamped) {
      return { ok: true, message: `You deposit ${amount} gold. The vault overflows, so excess coin is discarded.` };
    }

    return { ok: true, message: `You deposit ${amount} gold.` };
  }

  depositAll(player: PlayerRecord): BankTransactionResult {
    const onHand = this.getOnHandGold(player);
    if (onHand <= 0) {
      return { ok: false, message: 'You have no gold to deposit.' };
    }
    return this.deposit(player, onHand);
  }

  withdraw(player: PlayerRecord, amount: number): BankTransactionResult {
    const onHand = this.getOnHandGold(player);
    const inBank = this.getBankGold(player);

    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, message: 'That is not a real amount. Try a positive integer.' };
    }
    if (amount > inBank) {
      return { ok: false, message: 'The vault is not a magical bottomless pit. Too much.' };
    }

    const nextPocket = this.safeAdd(onHand, amount);
    this.playerRepo.updatePlayerStats(player.id, {
      gold_on_hand: nextPocket.value,
      gold_in_bank: inBank - amount
    });
    this.recordTransaction(player.id, 'withdraw', amount);

    if (nextPocket.clamped) {
      return { ok: true, message: `You withdraw ${amount} gold, but can only carry so much. Excess coin stays in limbo.` };
    }

    return { ok: true, message: `You withdraw ${amount} gold.` };
  }

  private getOnHandGold(player: PlayerRecord): number {
    return player.gold_on_hand;
  }

  private getBankGold(player: PlayerRecord): number {
    return player.gold_in_bank;
  }

  private recordTransaction(playerId: string, type: 'deposit' | 'withdraw' | 'interest' | 'money_doubler', amount: number) {
    const createdAt = new Date().toISOString();
    getDb()
      .prepare('INSERT INTO bank_transactions (player_id, day_key, type, amount, created_at) VALUES (?, ?, ?, ?, ?)')
      .run([playerId, createdAt.slice(0, 10), type, amount, createdAt]);
  }

  private safeAdd(left: number, right: number) {
    const total = left + right;
    if (total > BIGINT_MAX) {
      return { value: BIGINT_MAX, clamped: true };
    }
    return { value: total, clamped: false };
  }
}
