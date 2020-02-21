import { Apkg, ankiCards, ankiNotes, ankiModels, Anki2, ankiTemplates } from 'ankisync'

if (require.main === module) {
  (async () => {
    const { anki2 } = await Apkg.connect(
      '/Users/patarapolw/Downloads/Hanyu_Shuiping_Kaoshi_HSK_all_5000_words_high_quality.apkg',
    )
    const r = await anki2.db.find(
      ankiCards,
      {
        to: ankiNotes,
        from: ankiCards.c.nid,
      },
      {
        to: ankiModels,
        from: ankiNotes.c.mid,
      },
      {
        to: ankiTemplates,
        cond: 'templates.mid = notes.mid AND templates.ord = cards.ord',
      },
    )({}, {
      values: ankiNotes.c.flds,
      keys: ankiModels.c.flds,
      css: ankiModels.c.css,
      qfmt: ankiTemplates.c.qfmt,
      afmt: ankiTemplates.c.afmt,
      template: ankiTemplates.c.name,
      model: ankiModels.c.name,
    }, { limit: 10 })

    console.log(r)
  })().catch(console.error)
}
