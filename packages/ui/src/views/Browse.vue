<template lang="pug">
.container
  b-navbar.elevation-1
    template(slot="start")
      form.field(@submit.prevent="onSearch" style="display: flex; align-items: center;")
        p.control.has-icons-left
          input.input(type="search" v-model="q" placeholder="Search...")
          span.icon.is-small.is-left
            fontawesome(icon="search")
    template(slot="end")
      b-navbar-item(tag="div")
        .buttons
          router-link.button(to="/edit") New
          button.button(@click="load") Reload
          b-dropdown(aria-role="list" position="is-bottom-left")
            button.button(:disabled="checked.length === 0" slot="trigger")
              span(style="margin-right: 0.5em") Batch Edit
              b-icon(icon="angle-down")
            b-dropdown-item(aria-role="listitem")
              p(role="button" @click="isEditTagsDialog = true") Edit tags
            b-dropdown-item(aria-role="listitem")
              p(role="button" @click="doDelete") Delete
  .columns
    .column
      b-table.query-table(
        :data="items"
        :loading="isLoading"
        detailed

        :selected.sync="selected"
        @select="openItem($event)"

        checkable
        :checked-rows.sync="checked"
        @check="onTableChecked"

        paginated
        backend-pagination
        :total="count"
        :per-page="perPage"
        @page-change="onPageChanged"
        :current-page="page"

        backend-sorting
        :default-sort="[sort.key, sort.type]"
        @sort="onSort"
      )
        template(slot-scope="props")
          b-table-column(v-for="h in headers" :key="h.field"
              :label="h.label" :width="h.width" :sortable="h.sortable")
            span(v-if="h.field === 'tag'")
              b-taglist
                b-tag(v-for="t in props.row.tag" :key="t") {{t}}
            span(v-else) {{props.row[h.field]}}
        template(slot="detail" slot-scope="props")
          .container(style="max-width: 800px; max-height: 300px; overflow: scroll;")
            .content(
              v-html="toHTML(props.row)"
              style="max-height: 300px; overflow: scroll"
              @click="openItem(props.row.key)"
            )
  b-modal(:active.sync="isEditTagsDialog" :width="500")
    .card
      header.card-header
        .card-header-title Edit tags
      .card-content
        b-field
          b-taginput(
            v-model="tagList" ellipsis icon="tag" placeholder="Add tags"
            autocomplete open-on-focus @typing="getFilteredTags"
            :data="filteredTags" allow-new
          )
        .buttons
          div(style="flex-grow: 1;")
          button.button(@click="editTags") Save
          button.button(@click="isEditTagsDialog = false") Close
</template>

<script lang="ts">
import { Component, Vue, Watch, Prop } from 'vue-property-decorator'
import dayjs from 'dayjs'
import { AxiosInstance } from 'axios'
import hbs from 'handlebars'

import { normalizeArray, stringSorter } from '../utils'
import { Matter } from '../make-html/matter'
import MakeHtml from '../make-html'

@Component
export default class Query extends Vue {
  selected: any = null
  checked: any[] = []

  items: any[] = []
  allTags: string[] | null = null
  filteredTags: string[] = []
  tagList: string[] = []
  sort = {
    key: 'updatedAt',
    type: 'desc'
  }

  isLoading = false
  count = 0
  isEditTagsDialog = false
  newTags = ''
  q = ''

  headers = [
    { label: 'Key', field: 'key', width: 200, sortable: true },
    { label: 'Deck', field: 'deck', width: 200, sortable: true },
    { label: 'Markdown', field: 'markdown' },
    { label: 'Next Review', field: 'nextReview', width: 250, sortable: true },
    { label: 'SRS Level', field: 'srsLevel', width: 150, sortable: true },
    { label: 'Tag', field: 'tag', width: 200 }
  ]

  perPage = 5

  get page () {
    return parseInt(normalizeArray(this.$route.query.page) || '1')
  }

  mounted () {
    this.load()
  }

  onSearch () {
    this.$router.push({
      path: '/browse',
      query: {
        q: this.q
      }
    })
  }

  toHTML (item: any) {
    const makeHtml = new MakeHtml(item.key)
    return makeHtml.getDOM(item.markdown).outerHTML
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  @Watch('$route.query.page')
  @Watch('$route.query.q')
  async load () {
    this.$set(this, 'checked', [])
    const q = normalizeArray(this.$route.query.q) || ''
    const api = await this.getApi()

    const r = await api.post('/api/edit/', {
      q,
      offset: (this.page - 1) * this.perPage,
      limit: this.perPage,
      sort: {
        key: this.sort.key,
        desc: this.sort.type === 'desc'
      },
      count: true
    })

    this.count = r.data.count
    const matter = new Matter()

    this.$set(this, 'items', r.data.data.map((el: any) => {
      return {
        ...el,
        markdown: matter.parse(el.markdown || '').content.substr(0, 140),
        tag: stringSorter(el.tag || []),
        date: el.date ? dayjs(el.date).format('YYYY-MM-DD HH:mm Z') : ''
      }
    }))
  }

  onPageChanged (p: number) {
    this.$router.push({
      query: {
        ...this.$route.query,
        page: p.toString()
      }
    })
  }

  onSort (key: string, type: 'desc' | 'asc') {
    this.sort.key = key
    this.sort.type = (type as string)
    this.load()
  }

  async doDelete () {
    this.$buefy.dialog.confirm({
      title: 'Deleting media',
      message: 'Are you sure you want to <b>delete</b> the selected posts?',
      confirmText: 'Delete',
      type: 'is-danger',
      hasIcon: true,
      onConfirm: async () => {
        const api = await this.getApi()
        await api.delete('/api/edit/', {
          data: {
            keys: this.checked.map((el) => el.key)
          }
        })

        this.load()
      }
    })
  }

  async getFilteredTags (text: string) {
    if (!this.allTags) {
      const api = await this.getApi()
      this.allTags = (await api.get('/api/edit/tag')).data.tags
    }

    this.filteredTags = this.allTags!.filter((t) => {
      return t.toLocaleLowerCase().includes(text.toLocaleLowerCase())
    })
  }

  openItem (it: any) {
    this.$router.push({
      path: '/edit',
      query: {
        key: it.key
      }
    })
  }

  onTableChecked (checked: any[]) {
    this.tagList = Array.from(new Set(checked
      .map((el) => el.tag)
      .filter((t) => t)
      .reduce((a, b) => [...a!, ...b!], [])!))

    this.$set(this, 'tagList', this.tagList)
  }

  editTags () {
    this.$nextTick(async () => {
      const api = await this.getApi()
      await api.patch('/api/edit/', {
        keys: this.checked.map((el) => el.key),
        set: {
          tag: this.tagList
        }
      })

      this.isEditTagsDialog = false

      this.load()
    })
  }
}
</script>

<style lang="scss">
.query-table {
  tbody {
    tr {
      cursor: pointer;
    }

    tr:hover {
      background-color: lightblue;
    }
  }
}
</style>
