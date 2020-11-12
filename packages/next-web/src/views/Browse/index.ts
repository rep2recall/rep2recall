import { Component, Vue } from 'vue-property-decorator'

@Component
export default class Browse extends Vue {
  itemSelected = []
  columns = [
    {
      text: 'Key',
      value: 'key',
      width: 200
    },
    {
      text: 'Front',
      value: 'front',
      sortable: false
    },
    {
      text: 'Back',
      value: 'front',
      sortable: false
    },
    {
      text: 'Data',
      value: 'data',
      sortable: false
    },
    {
      text: 'Last updated',
      value: 'updatedAt',
      width: 200
    },
    {
      value: 'action',
      width: 80
    }
  ]

  noteData = [{}]
  isLoading = false
  dataOptions = {
    sortBy: ['updatedAt'],
    sortDesc: [true],
    page: 1,
    itemsPerPage: 5
  }

  count = 1

  batchActions = [
    { text: 'Edit', callback: () => this.doBatchEdit() },
    {
      text: 'Delete',
      callback: () => this.doBatchDelete()
    }
  ]

  doBatchEdit () {
    console.log('Batch edit')
  }

  doBatchDelete () {
    console.log('Batch delete')
  }

  doEdit (it: unknown) {
    console.log(it)
  }

  doDelete (it: unknown) {
    console.log(it)
  }
}
