package rep2recall.api

import com.papsign.ktor.openapigen.APITag
import com.papsign.ktor.openapigen.annotations.Request
import com.papsign.ktor.openapigen.annotations.Response
import com.papsign.ktor.openapigen.annotations.parameters.QueryParam
import com.papsign.ktor.openapigen.route.apiRouting
import com.papsign.ktor.openapigen.route.info
import com.papsign.ktor.openapigen.route.path.normal.get
import com.papsign.ktor.openapigen.route.path.normal.post
import com.papsign.ktor.openapigen.route.tag
import io.ktor.routing.*
import rep2recall.db.DateString
import rep2recall.db.Lesson
import rep2recall.db.Stat

object EditTag: APITag {
    override val name = "edit"
    override val description = "Card Editing"
}

data class KeyRequest (
        @QueryParam("Card key") val key: String
)

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

fun Routing.edit() {
    apiRouting {
        tag(EditTag) {
            route("/") {
                get<KeyRequest, CardData>(
                        info("Get info of an item")
                ) {

                }

                post<Unit, DataQuery, CardDataQueryResult>(
                        info("Query for items")
                ) { _, body ->

                }
            }
        }
    }

    post("/") {

    }

    put("/") {

    }

    put("/multi") {

    }

    patch("/") {

    }

    delete("/") {

    }

    get("/deck") {

    }

    get("/tag") {

    }

    patch("/tag/add") {

    }

    patch("/tag/remove") {

    }
}