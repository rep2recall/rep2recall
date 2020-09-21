package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import org.jetbrains.exposed.sql.*
import rep2recall.db.*
import java.util.regex.Pattern

object QuizController {
    val handler = EndpointGroup {
        get(this::getOne)
        post(this::query)
    }

    private fun getOne(ctx: Context) {
        val id = ctx.queryParam<String>("id")
                .check({ it.length < 26 }, "cannot be longer than a ULID")
                .get()

        ctx.json(Quiz.find {
            (QuizTable.id eq id) and (QuizTable.userId eq ctx.sessionAttribute<String>("userId"))
        }.firstOrNull()?.serialize() ?: mapOf<String, String>())
    }

    private data class QueryRequest(
            val q: String,
            val offset: Long = 0,
            val limit: Int = 5,
            val sort: String = "-id"
    )

    private fun query(ctx: Context) {
        val body = ctx.bodyValidator(QueryRequest::class.java).get()
        val sortKey = if (body.sort[0] == '-') body.sort.substring(1) else body.sort

        fun getQuery() = QuizTable.innerJoin(NoteTable).innerJoin(NoteAttrTable).select {
            QueryUtil.parse(body.q, listOf(":", "<", "<=", ">", ">=", "=", "~")) { p ->
                when(p.key) {
                    "id" -> QueryUtil.comp(p, QuizTable.id)
                    "noteId" -> QueryUtil.comp(p, QuizTable.noteId)
                    "templateId" -> QueryUtil.comp(p, QuizTable.templateId)
                    "srsLevel" -> QueryUtil.comp(p, QuizTable.srsLevel)
                    "nextReview" -> QueryUtil.comp(p, QuizTable.nextReview)
                    "rightStreak" -> QueryUtil.comp(p, QuizTable.rightStreak)
                    "wrongStreak" -> QueryUtil.comp(p, QuizTable.wrongStreak)
                    "lastRight" -> QueryUtil.comp(p, QuizTable.lastRight)
                    "lastWrong" -> QueryUtil.comp(p, QuizTable.lastWrong)
                    "maxRight" -> QueryUtil.comp(p, QuizTable.maxRight)
                    "maxWrong" -> QueryUtil.comp(p, QuizTable.maxWrong)
                    "deck" -> when(p.op) {
                        "<" -> QuizTable.deck less p.value
                        "<=" -> QuizTable.deck lessEq p.value
                        ">" -> QuizTable.deck greater p.value
                        ">=" -> QuizTable.deck greaterEq p.value
                        "=" -> QuizTable.deck eq p.value
                        else -> (QuizTable.deck eq p.value) or
                                (QuizTable.deck regexp "^${Pattern.quote(p.value)}\u001f")
                    }
                    null -> (QuizTable.deck eq p.value) or
                            (QuizTable.deck regexp "^${Pattern.quote(p.value)}\u001f") or
                            QueryUtil.comp(p)
                    else -> QueryUtil.comp(p)
                }
            } and (NoteTable.userId eq ctx.sessionAttribute<String>("userId")!!)
        }.groupBy(QuizTable.id)

        val count = getQuery().count()
        val qs = getQuery()
                .orderBy(when(sortKey) {
                    "noteId" -> QuizTable.noteId
                    "templateId" -> QuizTable.templateId
                    "srsLevel" -> QuizTable.srsLevel
                    "nextReview" -> QuizTable.nextReview
                    "rightStreak" -> QuizTable.rightStreak
                    "wrongStreak" -> QuizTable.wrongStreak
                    "lastRight" -> QuizTable.lastRight
                    "lastWrong" -> QuizTable.lastWrong
                    "maxRight" -> QuizTable.maxRight
                    "maxWrong" -> QuizTable.maxWrong
                    "deck" -> QuizTable.deck
                    else -> QuizTable.id
                }, if (body.sort[0] == '-') SortOrder.DESC else SortOrder.ASC)
                .limit(body.limit, body.offset)

        ctx.json(mapOf(
                "result" to Quiz.wrapRows(qs).map { it.serialize() },
                "count" to count
        ))
    }
}