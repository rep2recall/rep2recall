import { Observable, Subject, merge } from 'observable-fns'

import { DbCard, DbDeck, DbMedia, DbQuiz, DbLesson } from '../schema/schema'

export type ProgressObservable<T extends string> = Observable<{
  type: T
  progress: number
  meta?: any
}>

export abstract class DbSync {
  export (ids?: Observable<string>) {
    return merge(
      this.rCardExport(ids),
      this.rQuizExport(ids),
      this.rDeckExport(ids),
      this.rLessonExport(ids),
      this.rMediaExport(ids)
    )
  }

  import (items: ReturnType<DbSync['export']>) {
    return new Observable<{
      type: string
      progress: number
      meta?: any
    }>((obs) => {
      const s = {
        card: new Subject<{ value: DbCard }>(),
        quiz: new Subject<{ value: DbQuiz }>(),
        deck: new Subject<{ value: DbDeck }>(),
        lesson: new Subject<{ value: DbLesson }>(),
        media: new Subject<{ value: DbMedia }>()
      }

      this.rCardImport(s.card)
        .subscribe(
          obs.next,
          obs.error
        )
      this.rDeckImport(s.deck)
        .subscribe(
          obs.next,
          obs.error
        )
      this.rLessonImport(s.lesson)
        .subscribe(
          obs.next,
          obs.error
        )
      this.rQuizImport(s.quiz).subscribe(
        obs.next,
        obs.error
      )
      this.rMediaImport(s.media)
        .subscribe(
          obs.next,
          obs.error
        )

      items.subscribe(
        (it) => {
          s[it.type].next({ value: it.value as any })
        },
        obs.error,
        () => {
          Object.values(s).map((s0) => s0.complete())
          obs.complete()
        }
      )
    })
  }

  abstract rCardExport (ids?: Observable<string>): Observable<{ value: DbCard; type: 'card' }>
  abstract rCardImport (items: Subject<{ value: DbCard }>): ProgressObservable<'card'>

  abstract rQuizExport (ids?: Observable<string>): Observable<{ value: DbQuiz; type: 'quiz' }>
  abstract rQuizImport (items: Subject<{ value: DbQuiz }>): ProgressObservable<'quiz'>

  abstract rDeckExport (ids?: Observable<string>): Observable<{ value: DbDeck; type: 'deck' }>
  abstract rDeckImport (items: Subject<{ value: DbDeck }>): ProgressObservable<'deck'>

  abstract rLessonExport (ids?: Observable<string>): Observable<{ value: DbLesson; type: 'lesson' }>
  abstract rLessonImport (items: Subject<{ value: DbLesson }>): ProgressObservable<'lesson'>

  abstract rMediaExport (ids?: Observable<string>): Observable<{ value: DbMedia; type: 'media' }>
  abstract rMediaImport (items: Subject<{ value: DbMedia }>): ProgressObservable<'media'>
}
