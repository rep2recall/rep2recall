import elunr from 'elasticlunr'

export interface ISearchItem {
  _id: string
  deck: string
  front: string
  back: string
  mnemonic: string
}

export const idx = elunr<ISearchItem>(function () {
  this.addField('deck')
})
