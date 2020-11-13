package rep2recall.api

import org.jetbrains.exposed.sql.Op
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.select
import org.joda.time.DateTime
import rep2recall.db.*

data class Config(
        val baseURL: String
)

data class CreateResponse(
        val id: String
)

data class StdSuccessResponse(
        val result: String
)

data class StdErrorResponse(
        val error: String
)

data class PresetGetAllResponse(
        val result: List<PresetSer>
)

data class QueryRequest(
        val select: List<String>,
        val q: String = "",
        val offset: Long = 0,
        val limit: Int? = 5,
        val sortBy: String? = null,
        val desc: Boolean? = null
)

data class NoteQueryResponse(
        val result: List<NoteSer>,
        val count: Long
)

data class QuizQueryRequest(
        val q: String,
        val decks: List<String>,
        val status: PresetStatus
)

data class QuizQueryResponse(
        val result: List<String>
)

data class TreeviewRequest(
        val q: String,
        val status: PresetStatus
)

data class TreeviewItem(
        val deck: List<String>,
        val new: Int,
        val due: Int,
        val leech: Int
)

data class TreeviewResponse(
        val result: List<TreeviewItem>
)

fun getSearchQuery(
        userId: String,
        q: String,
        status: PresetStatus? = null,
        decks: List<String>? = null
) = NoteTable
        .leftJoin(NoteTagTable)
        .leftJoin(TagTable)
        .select {
            fun isDeck(d: String) = (NoteTable.deck eq d) or
                    (NoteTable.deck greater "$d::" and (NoteTable.deck less "$d:;"))

            var cond = NoteTable.userId eq userId

            status?.let {
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
            }

            if (!decks.isNullOrEmpty()) {
                var deckCond = isDeck(decks[0])
                decks.subList(1, decks.size).forEach {
                    deckCond = deckCond and isDeck(it)
                }

                cond = cond and deckCond
            }

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
                    "tag" -> QueryUtil.comp(p, TagTable.name)
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