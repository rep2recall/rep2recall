package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import org.jetbrains.exposed.sql.*
import org.joda.time.DateTime
import rep2recall.db.*

object QuizController {
    val handler = EndpointGroup {
        post("q", this::query)
        post("treeview", this::treeview)
        patch("mark", this::mark)
    }

    private data class QueryRequest(
            val q: String,
            val decks: List<String>,
            val status: Preset.Status
    )

    private fun query(ctx: Context) {
        val body = ctx.bodyValidator<QueryRequest>().get()

        ctx.json(mapOf(
                "result" to Note.wrapRows(_getQuery(ctx.sessionAttribute<String>("userId")!!,
                        body.q, body.status, body.decks)).map { it.key }
        ))
    }

    private data class TreeviewRequest(
            val q: String,
            val status: Preset.Status
    )

    private data class TreeviewItem(
            val deck: String,
            val notes: List<Note>
    )

    private fun treeview(ctx: Context) {
        val body = ctx.bodyValidator<TreeviewRequest>().get()
        val now = DateTime.now()

        ctx.json(mapOf(
                "result" to Note.wrapRows(_getQuery(ctx.sessionAttribute<String>("userId")!!,
                        body.q, body.status))
                        .filter { it.deck != null }
                        .groupBy { it.deck }
                        .map { p ->
                            mapOf(
                                    "deck" to p.key,
                                    "new" to p.value.filter { it.srsLevel == null }.size,
                                    "due" to p.value.filter {
                                        it.nextReview?.let { r -> r < now } ?: true
                                    }.size,
                                    "leech" to p.value.filter {
                                        it.srsLevel == 0 ||
                                                (it.wrongStreak?.let { r -> r > 2 } ?: false)
                                    }
                            )
                        }
        ))
    }

    private fun mark(ctx: Context) {
        val key = ctx.queryParam<String>("key").get()
        val `as` = ctx.queryParam<String>("as")
                .check({ setOf("right", "wrong", "repeat").contains(it) })
                .get()

        Note.find {
            (NoteTable.userId eq ctx.sessionAttribute<String>("userId")) and
                    (NoteTable.key eq key)
        }.firstOrNull()?.let {
            when (`as`) {
                "right" -> it.markRight()
                "wrong" -> it.markWrong()
                "repeat" -> it.markRepeat()
            }
            ctx.status(201).json(mapOf(
                    "result" to "updated"
            ))
        } ?: ctx.status(304).json(mapOf(
                "error" to "not found"
        ))
    }

    @Suppress("FunctionName")
    private fun _getQuery(
            userId: String,
            q: String,
            status: Preset.Status,
            decks: List<String>? = null
    ) = NoteTable.leftJoin(NoteAttrTable).select {
        fun isDeck(d: String) = (NoteTable.deck eq d) or
                (NoteTable.deck greater "$d::" and (NoteTable.deck less "$d:;"))

        var cond = NoteTable.userId eq userId

        var statusCond: Op<Boolean> = Op.FALSE

        if (status.new) {
            statusCond = statusCond or NoteTable.srsLevel.isNull()
        }

        statusCond = statusCond or if (status.graduated) {
            NoteTable.srsLevel.isNotNull()
        } else {
            NoteTable.srsLevel lessEq 3
        }

        if (status.leech) {
            statusCond = statusCond or (NoteTable.srsLevel eq 0) or
                    (NoteTable.wrongStreak greater 2)
        }

        if (status.due) {
            statusCond = statusCond and (
                    (NoteTable.nextReview.isNull()) or
                    (NoteTable.nextReview less DateTime.now())
                    )
        }

        cond = cond and statusCond

        var deckCond: Op<Boolean> = Op.TRUE

        if (!decks.isNullOrEmpty()) {
            deckCond = isDeck(decks[0])
            decks.subList(1, decks.size).forEach {
                deckCond = deckCond and isDeck(it)
            }
        }

        cond = cond and deckCond

        cond and QueryUtil.parse(q, listOf(":", "<", "<=", ">", ">=", "=", "~")) { p ->
            when(p.key) {
                "key" -> QueryUtil.comp(p, NoteTable.key)
                "srsLevel" -> QueryUtil.comp(p, NoteTable.srsLevel)
                "nextReview" -> QueryUtil.comp(p, NoteTable.nextReview)
                "rightStreak" -> QueryUtil.comp(p, NoteTable.rightStreak)
                "wrongStreak" -> QueryUtil.comp(p, NoteTable.wrongStreak)
                "lastRight" -> QueryUtil.comp(p, NoteTable.lastRight)
                "lastWrong" -> QueryUtil.comp(p, NoteTable.lastWrong)
                "maxRight" -> QueryUtil.comp(p, NoteTable.maxRight)
                "maxWrong" -> QueryUtil.comp(p, NoteTable.maxWrong)
                "deck" -> when(p.op) {
                    ":" -> isDeck(p.value)
                    else -> QueryUtil.comp(p, NoteTable.deck)
                }
                null -> isDeck(p.value) or
                        QueryUtil.comp(p)
                else -> QueryUtil.comp(p)
            }
        }
    }.groupBy(NoteTable.id)
}