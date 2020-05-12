package rep2recall.api

import com.papsign.ktor.openapigen.annotations.Request
import com.papsign.ktor.openapigen.annotations.Response
import com.papsign.ktor.openapigen.annotations.parameters.QueryParam
import rep2recall.db.DateString
import rep2recall.db.Lesson
import rep2recall.db.Stat

object Req {
    data class Key (
            @QueryParam("Card key") val key: String
    )
}

object Body {
    @Response("Card key")
    data class Key (
            val key: String
    )

    @Request("Card keys")
    @Response("Card keys")
    data class KeyMulti (
            val keys: List<String>
    )

    data class CardDataPartial (
            val data: Map<String, String>?,
            val ref: List<String>?,
            val markdown: String?,
            val tag: List<String>?,
            val nextReview: DateString?,  // date-time
            val srsLevel: Int?,
            val stat: Stat?,
            val lesson: List<Lesson>?,
            val deck: String?
    )

    @Request("Card update request")
    data class CardUpdate (
            val keys: List<String>,
            val set: CardDataPartial
    )

    @Request("Card data")
    @Response("Card data")
    data class CardData (
            val key: String,
            val data: Map<String, String>?,
            val ref: List<String>?,
            val markdown: String?,
            val tag: List<String>?,
            val nextReview: DateString?,  // date-time
            val srsLevel: Int?,
            val stat: Stat?,
            val lesson: List<Lesson>?,
            val deck: String?
    )

    @Request("Multiple card data")
    data class CardDataMulti (
            val entries: List<CardData>
    )

    @Response("Card data query result")
    data class CardDataQueryResult (
            val data: List<CardData>,
            val count: Int?
    )

    @Request("Card query request")
    data class DataQuery (
            val q: String,
            val cond: Map<String, Any>?,
            val offset: Int,
            val limit: Int,
            val sort: List<String>,
            val hasCount: Boolean?
    )
}