import { initDatabase, db, dbUser } from '../src/schema'
import { fromApkg } from '../src/import'

;(async () => {
  await initDatabase('test.db')
  await db.create(dbUser)({
    email: 'patarapolw@gmail.com',
  })
  await fromApkg('/Users/patarapolw/Downloads/Hanyu_Shuiping_Kaoshi_HSK_all_5000_words_high_quality.apkg')
})()
