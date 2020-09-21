package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import rep2recall.db.*
import java.util.regex.Pattern

object NoteController {
    val handler = EndpointGroup {
        get(this::getOne)
        post(this::query)
        put(this::create)
        patch(this::update)
        delete(this::delete)
    }

    private fun getOne(ctx: Context) {
        val id = ctx.queryParam<String>("id")
                .check({ it.length < 26 }, "cannot be longer than a ULID")
                .get()

        ctx.json(Note.find {
            (NoteTable.id eq id) and (NoteTable.userId eq ctx.sessionAttribute<String>("userId"))
        }.firstOrNull()?.serialize() ?: mapOf<String, String>())
    }

    private data class QueryRequest(
            val q: String,
            val offset: Int = 0,
            val limit: Int = 5
//            val sort: List<String> = listOf("-id")
    )

    private fun query(ctx: Context) {
        val body = ctx.bodyValidator(QueryRequest::class.java).get()

        val ids = NoteTable.innerJoin(NoteAttrTable).select {
            (QueryUtil.parse(body.q, listOf(":", "=", "~")) { p ->
                val q: Op<Boolean> = when(p.op) {
                    "=" -> NoteAttrTable.value eq p.value
                    "~" -> NoteAttrTable.value regexp p.value
                    else -> NoteAttrTable.value regexp Pattern.quote(p.value)
                }

                p.key?.let {
                   (NoteAttrTable.key eq p.key) and q
                } ?: q
            } ?: Op.TRUE) and (NoteTable.userId eq ctx.sessionAttribute<String>("userId")!!)
        }
                .groupBy(NoteTable.id)
                .orderBy(NoteTable.id, SortOrder.DESC)
                .limit(body.limit, body.offset.toLong())
                .map { it[NoteTable.id].value }

        ctx.status(201).json(mapOf(
                "result" to ids
        ))
    }

    private data class CreateRequest(
            val attrs: List<NoteAttr.Ser>
    )

    private fun create(ctx: Context) {
        val body = ctx.bodyValidator(CreateRequest::class.java).get()

        val n = transaction(Api.db.db) {
            Note.create(
                    null,
                    User.findById(ctx.sessionAttribute<String>("userId")!!)!!,
                    body.attrs
            )
        }

        ctx.json(mapOf(
                "id" to n.id.value
        ))
    }

    private data class UpdateRequest(
            var id: String,
            val attrs: List<NoteAttr.Ser>
    )

    private fun update(ctx: Context) {
        val body = ctx.bodyValidator(UpdateRequest::class.java).get()

        transaction(Api.db.db) {
            val n = Note.findById(body.id)?.let {
                if (it.userId.value == ctx.sessionAttribute<String>("userId")) {
                    it
                } else {
                    null
                }
            } ?: let {
                Note.create(
                        null,
                        User.findById(ctx.sessionAttribute<String>("userId")!!)!!,
                        listOf()
                )
            }

            val oldItems = n.attrs.toMutableList()

            for (a in body.attrs) {
                var isNew = true
                for (item in oldItems) {
                    if (a.key == item.key) {
                        item.value = a.value
                        oldItems.remove(item)
                        isNew = false
                        break
                    }
                }

                if (isNew) {
                    NoteAttr.create(a.key, a.value, n)
                }
            }

            for (item in oldItems) {
                item.delete()
            }
        }

        ctx.status(201).result("Updated")
    }

    private fun delete(ctx: Context) {
        val id = ctx.queryParam<String>("id")
                .check({ it.length < 26 }, "cannot be longer than a ULID")
                .get()

        transaction(Api.db.db) {
            Note.findById(id)?.let { n ->
                n.attrs.map { it.delete() }
                n.delete()
            }
        }

        ctx.status(201).result("Deleted")
    }
}