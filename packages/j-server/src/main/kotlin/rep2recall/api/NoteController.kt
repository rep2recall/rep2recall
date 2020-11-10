package rep2recall.api

import com.github.salomonbrys.kotson.fromJson
import com.google.gson.JsonElement
import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import org.jetbrains.exposed.sql.*
import org.joda.time.DateTime
import rep2recall.db.*

object NoteController {
    val handler = EndpointGroup {
        get(this::getOne)
        post("q", this::query)
        put(this::create)
        patch(this::update)
        delete(this::delete)
    }

    private fun getOne(ctx: Context) {
        val select = ctx.queryParam<String>("select").get()
                .split(",")
                .toSet()

        _findOne(ctx)?.let {
            ctx.json(it.filterKey(select))
        } ?: ctx.status(404).json(mapOf(
                "error" to "not found"
        ))
    }

    private data class QueryRequest(
            val q: String,
            val offset: Long = 0,
            val limit: Int = 5
    )

    private fun query(ctx: Context) {
        val body = ctx.bodyValidator<QueryRequest>().get()

        fun getQuery() = NoteTable.innerJoin(NoteAttrTable).select {
            QueryUtil.parse(body.q, listOf(":", "=", "~")) { p ->
                QueryUtil.comp(p)
            } and (NoteTable.userId eq ctx.sessionAttribute<String>("userId")!!)
        }.groupBy(NoteTable.id)

        val count = getQuery().count()
        val ids = getQuery()
                .orderBy(NoteTable.id, SortOrder.DESC)
                .limit(body.limit, body.offset)
                .map { it[NoteTable.id].value }

        ctx.json(mapOf(
                "result" to ids,
                "count" to count
        ))
    }

    private fun create(ctx: Context) {
        val body = ctx.bodyValidator<Note.Ser>().get()

        val n = Note.create(
                User.findById(ctx.sessionAttribute<String>("userId")!!)!!,
                body
        )

        ctx.json(mapOf(
                "id" to n.id.value
        ))
    }

    private fun update(ctx: Context) {
        val body = ctx.body<Map<String, JsonElement>>()

        _findOne(ctx)?.let { n ->
            body["nextReview"]?.let {
                n.nextReview = if (it.isJsonNull) {
                    null
                } else DateTime.parse(gson.fromJson(it))
            }

            body["lastRight"]?.let {
                n.lastRight = if (it.isJsonNull) {
                    null
                } else DateTime.parse(gson.fromJson(it))
            }

            body["lastWrong"]?.let {
                n.lastWrong = if (it.isJsonNull) {
                    null
                } else DateTime.parse(gson.fromJson(it))
            }

            body["key"]?.let {
                n.key = gson.fromJson(it)
            }

            body["deck"]?.let {
                n.deck = gson.fromJson(it)
            }

            body["front"]?.let {
                n.front = gson.fromJson(it)
            }

            body["back"]?.let {
                n.back = gson.fromJson(it)
            }

            body["mnemonic"]?.let {
                n.mnemonic = gson.fromJson(it)
            }

            body["srsLevel"]?.let {
                n.srsLevel = gson.fromJson(it)
            }

            body["rightStreak"]?.let {
                n.rightStreak = gson.fromJson(it)
            }

            body["wrongStreak"]?.let {
                n.wrongStreak = gson.fromJson(it)
            }

            body["maxRight"]?.let {
                n.maxRight = gson.fromJson(it)
            }

            body["maxWrong"]?.let {
                n.maxWrong = gson.fromJson(it)
            }

            body["data"]?.let {
                val data = gson.fromJson<List<NoteAttr.Ser>>(it)
                val oldItems = n.data.toMutableList()

                for (a in data) {
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

            ctx.status(201).json(mapOf(
                    "result" to "updated"
            ))
        } ?: ctx.status(304).json(mapOf(
                "error" to "not found"
        ))
    }

    private fun delete(ctx: Context) {
        _findOne(ctx)?.let {
            it.delete()

            ctx.status(201).json(mapOf(
                    "result" to "deleted"
            ))
        } ?: ctx.status(304).json(mapOf(
                "error" to "not found"
        ))
    }

    @Suppress("FunctionName")
    private fun _findOne(ctx: Context) = (
            ctx.queryParam<String>("id").getOrNull()?.let {
                Note.find {
                    NoteTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (NoteTable.id eq it)
                }
            } ?: ctx.queryParam<String>("key").get().let {
                Note.find {
                    NoteTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (NoteTable.key eq it)
                }
            }).firstOrNull()
}