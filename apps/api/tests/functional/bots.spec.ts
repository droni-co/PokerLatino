import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import User from '#models/user'
import PlayerStat from '#models/player_stat'
import PlayerProgress from '#models/player_progress'
import WalletTransaction from '#models/wallet_transaction'
import Wallet from '#models/wallet'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import presenceService from '#services/game/presence_service'
import socialService from '#services/game/social_service'
import { BotService } from '#services/game/bot_service'
import tableManager from '#game/table_manager'
import gameConfig from '#config/game'

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `humano${counter}`,
    email: `humano${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function seatsIn(roomId: number) {
  return RoomSeat.query().where('room_id', roomId).preload('user').orderBy('seat_number')
}

/** Juega la mano: el bot decide solo y el humano pasa o iguala */
async function playHand(roomId: number, humanId: number) {
  for (let guard = 0; guard < 100; guard++) {
    const state = await tableManager.getState(roomId, humanId)
    if (!state.hand) return
    const toAct = state.seats.find((s) => s.isTurn)!
    if (toAct.player.isBot) {
      await tableManager.playBotTurn(roomId)
    } else {
      const legal = state.you!.legalActions!
      await tableManager.act(roomId, humanId, { type: legal.check ? 'check' : 'call' })
    }
  }
  throw new Error('La mano no terminó')
}

test.group('Bots de la casa', (group) => {
  const bots = new BotService(true)

  group.each.setup(() => {
    tableManager.reset()
    presenceService.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('espera un bot en la primera mesa de cada nivel aunque no haya nadie', async ({
    assert,
  }) => {
    await bots.sync()
    const first = await Room.findByOrFail('slug', 'principiantes-1')
    const seats = await seatsIn(first.id)
    assert.lengthOf(seats, 1)
    assert.isTrue(seats[0].user.isBot)
    assert.equal(seats[0].stack, first.maxBuyIn)

    // Repetir la revisión no sienta más bots
    await bots.sync()
    assert.lengthOf(await seatsIn(first.id), 1)
  })

  test('quien pulsa "Jugar" en un nivel vacío se sienta con el bot', async ({ assert }) => {
    await bots.sync()
    const first = await Room.findByOrFail('slug', 'principiantes-1')
    const player = await createPlayer()
    const { seat } = await roomService.quickSeat(player, first.levelId!, { buyIn: 500 })
    const seats = await seatsIn(seat.roomId)
    assert.lengthOf(seats, 2)
    assert.isTrue(seats.some((s) => s.user.isBot))
  })

  test('se sienta con un jugador solo y se levanta cuando llega otro', async ({ assert }) => {
    // Una mesa que no es la primera: sin jugadores no tiene bot
    const first = await Room.findByOrFail('slug', 'principiantes-1')
    const second = await Room.create({
      levelId: first.levelId,
      tableNumber: 2,
      slug: 'principiantes-2',
      name: 'Principiantes · Mesa 2',
      gameType: first.gameType,
      bettingStructure: first.bettingStructure,
      maxSeats: first.maxSeats,
      smallBlind: first.smallBlind,
      bigBlind: first.bigBlind,
      minBuyIn: first.minBuyIn,
      maxBuyIn: first.maxBuyIn,
      actionTimeoutSeconds: first.actionTimeoutSeconds,
      status: 'active',
    })
    await bots.sync()
    assert.lengthOf(await seatsIn(second.id), 0)

    const ana = await createPlayer()
    await roomService.sit(ana, second.id, { buyIn: 500 })
    await bots.sync()
    let seats = await seatsIn(second.id)
    assert.lengthOf(seats, 2)
    const bot = seats.find((s) => s.user.isBot)!

    const luis = await createPlayer()
    await roomService.sit(luis, second.id, { buyIn: 500 })
    await bots.sync()
    seats = await seatsIn(second.id)
    assert.lengthOf(seats, 2)
    assert.isFalse(seats.some((s) => s.user.isBot))

    // Sus fichas volvieron a su billetera
    const wallet = await Wallet.findByOrFail('user_id', bot.userId)
    assert.equal(wallet.balance, bot.stack)

    // Si uno se va, el bot vuelve
    await roomService.leave(luis, second.id)
    await bots.sync()
    seats = await seatsIn(second.id)
    assert.isTrue(seats.some((s) => s.user.isBot))
  })

  test('juega la mano solo, se recarga y no suma estadísticas ni experiencia', async ({
    assert,
  }) => {
    await bots.sync()
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    const player = await createPlayer()
    await roomService.sit(player, room.id, { buyIn: 500 })
    const seated = await seatsIn(room.id)
    const bot = seated.find((s) => s.user.isBot)!

    for (let i = 0; i < 6; i++) {
      // El jugador se rearma para seguir jugando si se quedó sin fichas
      const mine = await RoomSeat.query()
        .where('room_id', room.id)
        .where('user_id', player.id)
        .first()
      if (mine?.stack === 0) await roomService.leave(player, room.id)
      if (!mine || mine.stack === 0) {
        await Wallet.query().where('user_id', player.id).increment('balance', 500)
        await roomService.sit(player, room.id, { buyIn: 500 })
      }

      assert.isNotNull(await tableManager.startHandIfReady(room.id))
      // Al empezar la mano, el bot tiene al menos el buy-in máximo (se recarga si perdió)
      const state = await tableManager.getState(room.id, player.id)
      const botSeat = state.seats.find((s) => s.player.isBot)!
      assert.isAtLeast(botSeat.stack + botSeat.committed, room.maxBuyIn)
      await playHand(room.id, player.id)
    }

    const stats = await PlayerStat.findByOrFail('user_id', bot.userId)
    assert.equal(stats.handsPlayed, 0)
    const progress = await PlayerProgress.findBy('user_id', bot.userId)
    assert.equal(progress?.hands ?? 0, 0)
    const human = await PlayerStat.findByOrFail('user_id', player.id)
    assert.equal(human.handsPlayed, 6)

    // Si perdió fichas, la casa se las repone antes de la siguiente mano
    await RoomSeat.query()
      .where('room_id', room.id)
      .where('user_id', bot.userId)
      .update({ stack: 100 })
    const mine = await RoomSeat.query()
      .where('room_id', room.id)
      .where('user_id', player.id)
      .first()
    if (!mine || mine.stack === 0) {
      if (mine) await roomService.leave(player, room.id)
      await Wallet.query().where('user_id', player.id).increment('balance', 500)
      await roomService.sit(player, room.id, { buyIn: 500 })
    }
    assert.isNotNull(await tableManager.startHandIfReady(room.id))
    const state = await tableManager.getState(room.id, player.id)
    const botSeat = state.seats.find((s) => s.player.isBot)!
    assert.equal(botSeat.stack + botSeat.committed, room.maxBuyIn)

    const wallet = await Wallet.findByOrFail('user_id', bot.userId)
    const refill = await WalletTransaction.query()
      .where('wallet_id', wallet.id)
      .where('type', 'bot_refill')
      .orderBy('id', 'desc')
      .first()
    assert.equal(refill?.amount, room.maxBuyIn - 100)
  })

  test('la presencia no levanta al bot y no aparece en las búsquedas', async ({ assert }) => {
    await bots.sync()
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    const [bot] = await seatsIn(room.id)
    const now = Date.now()
    await presenceService.sweep(now)
    await presenceService.sweep(now + gameConfig.table.disconnectTimeoutSeconds * 2000)
    assert.lengthOf(await seatsIn(room.id), 1)

    const player = await createPlayer()
    const found = await socialService.search(player.id, bot.user.username!.slice(0, 3))
    assert.isFalse(found.some((f) => f.player.id === bot.userId))
    await assert.rejects(() => socialService.request(player, bot.userId))
  })

  test('crea más bots cuando todos están ocupados', async ({ assert }) => {
    await bots.sync()
    const before = await User.query().where('is_bot', true)
    const extra = await bots.createBot()
    assert.notInclude(
      before.map((b) => b.username?.toLowerCase()),
      extra.username!.toLowerCase()
    )
    assert.isTrue(extra.isBot)
  })
})
