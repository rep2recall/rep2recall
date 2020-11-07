import { QSearch } from '../src'
import path from 'path'

const qSearch = new QSearch(path.join(__dirname, 'test.db'))

console.log(qSearch.search('"card":totam'))
