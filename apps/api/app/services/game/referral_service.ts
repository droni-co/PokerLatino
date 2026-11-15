import { randomInt } from 'node:crypto'
import { DateTime } from 'luxon'
import env from '#start/env'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import gameConfig from '#config/game'
import User from '#models/user'
import Referral from '#models/referral'
import walletService from '#services/game/wallet_service'

/** Sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/I/L) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7

/**
 * El mismo buzón escrito de otra forma: minúsculas, sin "+etiqueta" y, en Gmail, sin puntos.
 * Sirve para detectar a quien se invita a sí mismo con alias de su propio email.
 */
export function normalizeEmail(email: string) {
  const [rawLocal, rawDomain = ''] = email.trim().toLowerCase().split('@')
  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain
  let local = rawLocal.split('+')[0]
  if (domain === 'gmail.com') local = local.replaceAll('.', '')
  return `${local}@${domain}`
}

export const normalizeCode = (code: string) => code.trim().toUpperCase()

/**
 * Referidos: enlace de invitación y recompensas.
 *
 * Al crear una cuenta con un código válido, el invitado recibe `referredReward` fichas
 * (además del bono de bienvenida) y quien invita `referrerReward`, con estos límites:
 * - quien invita cobra como mucho `maxRewardedPerDay` invitaciones cada 24 h (después el
 *   invitado sigue recibiendo su bono, pero quien invita no);
 * - si desde la misma IP ya se premiaron `maxPerIpPerDay` cuentas en 24 h, o el invitado
 *   usa un alias del email de quien invita, no cobra nadie.
 */
export class ReferralService {
  /** Enlace público de invitación */
  link(code: string) {
    return `${env.get('APP_URL').replace(/\/$/, '')}/r/${code}`
  }

  /** Código del jugador (se crea la primera vez) */
  async codeFor(user: User) {
    if (user.referralCode) return user.referralCode
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from(
        { length: CODE_LENGTH },
        () => ALPHABET[randomInt(ALPHABET.length)]
      ).join('')
      const taken = await User.query().where('referral_code', code).first()
      if (taken) continue
      user.referralCode = code
      await user.save()
      return code
    }
    throw new Error('No se pudo generar un código de invitación')
  }

  findReferrer(code: string) {
    return User.query().where('referral_code', normalizeCode(code)).first()
  }

  /**
   * Aplica la invitación a una cuenta recién creada (dentro de la transacción del registro)
   */
  async apply(
    trx: TransactionClientContract,
    referred: User,
    code: string,
    ip: string | null,
    now = DateTime.now()
  ) {
    const referrer = await User.query({ client: trx })
      .where('referral_code', normalizeCode(code))
      .first()
    if (!referrer || referrer.id === referred.id) return null

    const config = gameConfig.referrals
    const since = now.minus({ hours: 24 }).toSQL()!

    let status: Referral['status'] = 'rewarded'
    if (normalizeEmail(referrer.email) === normalizeEmail(referred.email)) {
      status = 'blocked'
    } else if (ip) {
      const fromIp = await Referral.query({ client: trx })
        .where('ip', ip)
        .where('created_at', '>=', since)
        .whereNot('status', 'blocked')
        .count('* as total')
      if (Number(fromIp[0].$extras.total) >= config.maxPerIpPerDay) status = 'blocked'
    }
    if (status === 'rewarded') {
      const paid = await Referral.query({ client: trx })
        .where('referrer_id', referrer.id)
        .where('status', 'rewarded')
        .where('created_at', '>=', since)
        .count('* as total')
      if (Number(paid[0].$extras.total) >= config.maxRewardedPerDay) status = 'limit_reached'
    }

    const referredReward = status === 'blocked' ? 0 : config.referredReward
    const referrerReward = status === 'rewarded' ? config.referrerReward : 0

    if (referredReward > 0) {
      await walletService.credit(trx, {
        userId: referred.id,
        amount: referredReward,
        type: 'referral_bonus',
        reference: { type: 'user', id: referrer.id },
        description: `Bono por llegar invitado por ${referrer.displayName}`,
      })
    }
    if (referrerReward > 0) {
      await walletService.credit(trx, {
        userId: referrer.id,
        amount: referrerReward,
        type: 'referral_reward',
        reference: { type: 'user', id: referred.id },
        description: `Invitaste a ${referred.displayName}`,
      })
    }

    referred.referredById = referrer.id
    await referred.useTransaction(trx).save()

    return Referral.create(
      {
        referrerId: referrer.id,
        referredId: referred.id,
        status,
        referrerReward,
        referredReward,
        ip,
      },
      { client: trx }
    )
  }

  /**
   * Para la pantalla "Invita amigos": enlace, reglas, cupo del día y a quiénes invitó
   */
  async summary(user: User, now = DateTime.now()) {
    const code = await this.codeFor(user)
    const referrals = await Referral.query()
      .where('referrer_id', user.id)
      .preload('referred')
      .orderBy('created_at', 'desc')
      .limit(100)
    const since = now.minus({ hours: 24 })
    const paidToday = referrals.filter((r) => r.status === 'rewarded' && r.createdAt >= since)
    const config = gameConfig.referrals

    return {
      code,
      link: this.link(code),
      referrerReward: config.referrerReward,
      referredReward: config.referredReward,
      maxRewardedPerDay: config.maxRewardedPerDay,
      rewardedToday: paidToday.length,
      // Cuándo se libera el siguiente cupo si hoy ya se llegó al tope
      nextSlotAt:
        paidToday.length >= config.maxRewardedPerDay
          ? paidToday.at(-1)!.createdAt.plus({ hours: 24 }).toISO()
          : null,
      totalInvited: referrals.length,
      totalEarned: referrals.reduce((sum, r) => sum + r.referrerReward, 0),
      invited: referrals.map((r) => ({
        player: {
          id: r.referredId,
          displayName: r.referred.displayName,
          avatar: r.referred.avatar,
        },
        status: r.status,
        reward: r.referrerReward,
        createdAt: r.createdAt.toISO(),
      })),
    }
  }
}

export default new ReferralService()
