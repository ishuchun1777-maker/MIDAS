// MIDAS Bot — Remaining Commands
// apps/bot/src/commands/menu.ts

import { CommandContext, InlineKeyboard } from 'grammy'
import { MyContext } from '../types'
import { showMainMenu } from './start'

export async function menuCommand(ctx: CommandContext<MyContext>) {
  await showMainMenu(ctx)
}
