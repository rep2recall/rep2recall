import dayjs from 'dayjs'
import Vue from 'vue'

Vue.filter('nonZero', (v) => {
  return v === 0 ? '' : v
})

Vue.filter('format', (v) => {
  if (typeof v === 'number') {
    return v || v === 0 ? v.toLocaleString() : ''
  } else if (v instanceof Date) {
    return dayjs(v).format('YYYY-MM-DD HH:mm')
  } else if (v && typeof v === 'object') {
    return JSON.stringify(v)
  }
  return v
})

Vue.filter('formatDate', (v) => {
  return dayjs(v).format('YYYY-MM-DD HH:mm')
})
