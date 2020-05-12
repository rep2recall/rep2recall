package rep2recall.api

import com.papsign.ktor.openapigen.APITag
import com.papsign.ktor.openapigen.route.apiRouting
import com.papsign.ktor.openapigen.route.info
import com.papsign.ktor.openapigen.route.path.normal.*
import com.papsign.ktor.openapigen.route.tag
import io.ktor.routing.*

object EditTag: APITag {
    override val name = "edit"
    override val description = "Card Editing"
}

fun Routing.edit() {
    apiRouting {
        tag(EditTag) {
            route("/") {
                get<Req.Key, Body.CardData>(
                        info("Get info of a card")
                ) {

                }

                post<Unit, Body.DataQuery, Body.CardDataQueryResult>(
                        info("Query for card")
                ) { _, body ->

                }

                put<Unit, Body.CardData, Body.Key>(
                        info("Create card")
                ) { _, body ->

                }

                patch<Unit, Body.CardUpdate, Unit>(
                        info("Update cards")
                ) { _, body ->

                }

                delete<Unit, Unit>(
                        info("Delete cards")
                ) {

                }
            }

            route("/multi") {
                put<Unit, Body.CardDataMulti, Body.KeyMulti>(
                        info("Create multiple cards")
                ) { _, body ->

                }
            }
        }
    }
}