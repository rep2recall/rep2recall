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
  if (ajv.validate(keyRef, data)) {
    return data
  }

  throw new Error(ajv.errorsText(ajv.errors))
}
