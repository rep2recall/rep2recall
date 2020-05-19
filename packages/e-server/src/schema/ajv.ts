import pino from 'pino'
import Ajv from 'ajv'

import schema from './schema.json'

const logger = pino({
  prettyPrint: true
})

export const ajv = new Ajv({
  logger: {
    log: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger)
  }
}).addSchema(schema, 'schema.json')

export const validate = <T>(keyRef: string, data: T) => {
  if (ajv.validate(keyRef, makeJsonSchemaCompatible(data))) {
    return data
  }

  throw new Error(ajv.errorsText(ajv.errors))
}

function makeJsonSchemaCompatible (obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((subObj) => makeJsonSchemaCompatible(subObj))
  } else if (obj && typeof obj === 'object') {
    const replacement: any = {}
    const className = obj.constructor.name
    if (className !== 'Object') {
      replacement.__className = className
    }
    Object.entries(obj).map(([k, v]) => { replacement[k] = makeJsonSchemaCompatible(v) })
    return replacement
  }

  return obj
}
