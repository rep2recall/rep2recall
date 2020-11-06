import { QSearch } from '../src'
import faker from 'faker'
import path from 'path'

const qSearch = new QSearch(path.join(__dirname, 'test.db'))
qSearch.init()

const dateFrom = new Date(2010, 0)
const dateTo = new Date(2030, 0)

qSearch.insertMany(
  Array(1000)
    .fill(null)
    .map(() => ({
      deck: Array(faker.random.number({ min: 1, max: 5 }))
        .fill(null)
        .map(() => faker.hacker.noun()),
      front: Math.random() < 0.1 ? faker.lorem.paragraphs() : undefined,
      back: Math.random() < 0.1 ? faker.lorem.paragraphs() : undefined,
      mnemonic: Math.random() < 0.1 ? faker.lorem.paragraphs() : undefined,
      note:
        Math.random() < 0.1
          ? Object.fromEntries(
              Array(faker.random.number({ min: 1, max: 5 }))
                .fill(null)
                .map(() => [faker.hacker.noun(), faker.lorem.sentence()])
            )
          : undefined,
      srsLevel:
        Math.random() < 0.1
          ? faker.random.number({ min: 0, max: 9 })
          : undefined,
      rightStreak:
        Math.random() < 0.1
          ? faker.random.number({ min: 0, max: 9 })
          : undefined,
      wrongStreak:
        Math.random() < 0.1
          ? faker.random.number({ min: 0, max: 9 })
          : undefined,
      maxRight:
        Math.random() < 0.1
          ? faker.random.number({ min: 0, max: 9 })
          : undefined,
      maxWrong:
        Math.random() < 0.1
          ? faker.random.number({ min: 0, max: 9 })
          : undefined,
      nextReview:
        Math.random() < 0.1 ? faker.date.between(dateFrom, dateTo) : undefined,
      lastRight:
        Math.random() < 0.1 ? faker.date.between(dateFrom, dateTo) : undefined,
      lastWrong:
        Math.random() < 0.1 ? faker.date.between(dateFrom, dateTo) : undefined,
    }))
)

qSearch.db.close()
