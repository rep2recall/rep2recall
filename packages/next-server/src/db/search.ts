import FlexSearch from 'flexsearch'

export interface ISearchItem {
  _id: string
  deck: string[]
  front: string
  back: string
  mnemonic: string
  data: Record<string, string>
  srsLevel: number
  nextReview: number
  rightStreak: number
  wrongStreak: number
  lastRight: number
  lastWrong: number
  maxRight: number
  maxWrong: number
}

export const idx = FlexSearch.create<ISearchItem>({
  encode: 'advanced',
  tokenize: 'full',
  cache: true,
  async: true
})

export async function doSearch (q: string) {

}
