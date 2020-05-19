import { DbStat } from '../schema/schema'

export const defaultDbStat: DbStat = {
  streak: {
    right: 0,
    wrong: 0,
    maxRight: 0,
    maxWrong: 0
  }
}
