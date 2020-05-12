<template lang="pug">
.container
  b-navbar.elevation-1
    template(slot="start")
      form.field(@submit.prevent="onSearch" style="display: flex; align-items: center;")
        p.control.has-icons-left
          input.input(
            type="search" v-model="q" placeholder="Search..."
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          )
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
          b-table-column(v-for="h in headers" :key="h.field" :field="h.field"
              :label="h.label" :width="h.width" :sortable="h.sortable")
            span(v-if="h.field === 'lesson'")
              b-field(grouped group-multiline)
                .control(v-for="t in props.row[h.field]" :key="t.key")
                  b-taglist(attached)
                    b-tag(type="is-dark") {{t.name}}
                    b-tag {{t.deck}}
            span(v-else-if="Array.isArray(props.row[h.field])")
              b-taglist
                b-tag(v-for="t in props.row[h.field]" :key="t") {{t}}
            div(v-else style="max-height: 200px; overflow: scroll;")
              span.wrap {{props.row[h.field] | format}}
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
import axios, { AxiosInstance } from 'axios'
import hbs from 'handlebars'
import { normalizeArray, stringSorter, deepMerge } from '@/assets/util'
import { Matter } from '@/assets/make-html/matter'
import MakeHtml from '@/assets/make-html'

@Component
export default class Query extends Vue {
  selected: any = null
  checked: any[] = []

  items: any[] = []
  allTags: string[] | null = null
  filteredTags: string[] = []
  tagList: string[] = []
  sort: string[] = []

  isLoading = false
  count = 0
  isEditTagsDialog = false
  newTags = ''
  q = ''

  headers = [
    { label: 'Key', field: 'key', width: 150, sortable: true },
    { label: 'Deck', field: 'lesson', width: 200, sortable: true },
    { label: 'Data', field: 'data', width: 300 },
    { label: 'Next Review', field: 'nextReview', width: 250, sortable: true },
    { label: 'SRS Level', field: 'srsLevel', width: 150, sortable: true },
    { label: 'Tag', field: 'tag', width: 200 }
  ]

  perPage = 5
  ctx: any = {}

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
    return makeHtml.getHTML(hbs.compile(this.ctx[item.key].markdown || '')({
      [item.key]: item,
      ...this.ctx
    }))
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
      sort: this.sort,
      count: true
    })

    await Promise.all((r.data.data as any[])
      .map((el) => this.onCtxChange(deepMerge([el.key], el.ref))))

    this.count = r.data.count

    this.$set(this, 'items', r.data.data.map((el: any) => {
      return {
        ...el,
        lesson: (el.lesson || []).filter((ls: any) => ls.deck),
        tag: stringSorter(el.tag || [])
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
    this.sort = [(type === 'desc' ? '-' : '') + key]
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

        setTimeout(() => {
          this.load()
        }, 100)
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

  async onCtxChange (ctx: Record<string, any>) {
    if (Array.isArray(ctx)) {
      ctx = ctx.reduce((prev, k) => ({ ...prev, [k]: null }), {})
    }

    await Promise.all(Object.entries(ctx).map(async ([key, data]) => {
      if (typeof data !== 'undefined' && !this.ctx[key]) {
        if (!data) {
          const api = await this.getApi(true)
          const r = await api.post('/api/edit/info', { key })
          this.ctx[key] = r.data
          this.ctx[key].markdown = new Matter().parse(r.data.markdown || '').content
        } else {
          if (typeof data === 'string') {
            this.ctx[key] = (await axios.get(data)).data
          } else if (data.url) {
            this.ctx[key] = (await axios(data)).data
          }
        }
      }
    }))
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

.wrap {
  word-break: break-all;
}
</style>
