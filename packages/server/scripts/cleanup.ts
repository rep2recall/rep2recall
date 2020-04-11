import dotenv from 'dotenv'
import { mongoose } from '@typegoose/typegoose'

import { DbCardModel, DbQuizModel, DbTagModel, initDatabase } from '../src/db/schema'

async function main () {
  dotenv.config()

  await initDatabase(process.env.MONGO_URI!)

  const tag = await DbTagModel.findOne({ name: 'HSK' })
  const ids = (await DbCardModel.find({ tag: tag!._id })).map((c) => c._id)
  console.log(ids)

  await Promise.all([
    DbCardModel.deleteMany({ _id: { $in: ids } }),
    DbQuizModel.deleteMany({ cardId: { $in: ids } }),
  ])

  await mongoose.connection.close()
}

main()
