import S from 'jsonschema-definer'

export const sStatus = S.shape({
  new: S.boolean(),
  due: S.boolean(),
  leech: S.boolean(),
  graduated: S.boolean()
})

export type IStatus = typeof sStatus.type
