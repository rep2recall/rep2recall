package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import io.javalin.plugin.openapi.annotations.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.joda.time.DateTime
import rep2recall.db.*

object QuizController {
    val handler = EndpointGroup {
        post(this::query)
        post("treeview", this::treeview)
        patch("mark", this::mark)
    }

    @OpenApi(
            tags = ["quiz"],
            summary = "Create a quiz",
            requestBody = OpenApiRequestBody([OpenApiContent(QuizQueryRequest::class)]),
            responses = [
                OpenApiResponse("200", [OpenApiContent(QuizQueryResponse::class)])
            ]
    )
    private fun query(ctx: Context) {
        val body = ctx.bodyValidator<QuizQueryRequest>().get()

        transaction {
            ctx.json(QuizQueryResponse(
                    Note.wrapRows(getSearchQuery(ctx.sessionAttribute<String>("userId")!!,
                            body.q, body.status, body.decks)).map { it.key }.shuffled()
            ))
        }
    }

    @OpenApi(
            tags = ["quiz"],
            summary = "Query decks for treeview",
            requestBody = OpenApiRequestBody([OpenApiContent(TreeviewRequest::class)]),
            responses = [
                OpenApiResponse("200", [OpenApiContent(TreeviewResponse::class)])
            ]
    )
    private fun treeview(ctx: Context) {
        val body = ctx.bodyValidator<TreeviewRequest>().get()
        val now = DateTime.now()

        transaction {
            ctx.json(TreeviewResponse(
                    Note.wrapRows(getSearchQuery(ctx.sessionAttribute<String>("userId")!!,
                            body.q, body.status))
                            .filter { it.deck != null }
                            .groupBy { it.deck }
                            .map { p ->
                                TreeviewItem(
                                        deck = p.key!!.split("::"),
                                        new = p.value.filter { it.srsLevel == null }.size,
                                        due = p.value.filter {
                                            it.nextReview?.let { r -> r < now } ?: true
                                        }.size,
                                        leech = p.value.filter {
                                            it.srsLevel == 0 ||
                                                    (it.wrongStreak?.let { r -> r > 2 } ?: false)
                                        }.size
                                )
                            }
            ))
        }
    }

    @OpenApi(
            tags = ["quiz"],
            summary = "Mark a quiz item",
            description = "As right, wrong, or repeat",
            queryParams = [
                OpenApiParam("key", String::class, required = true),
                OpenApiParam("as", String::class, required = true,
                    description = "right, wrong, or repeat")
            ],
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun mark(ctx: Context) {
        val key = ctx.queryParam<String>("key").get()
        val `as` = ctx.queryParam<String>("as")
                .check({ setOf("right", "wrong", "repeat").contains(it) })
                .get()

        transaction {
            Note.find {
                (NoteTable.userId eq ctx.sessionAttribute<String>("userId")) and
                        (NoteTable.key eq key)
            }.firstOrNull()?.let {
                when (`as`) {
                    "right" -> it.markRight()
                    "wrong" -> it.markWrong()
                    "repeat" -> it.markRepeat()
                }
                ctx.status(201).json(StdSuccessResponse("updated"))
            }
        } ?: ctx.status(304).json(StdErrorResponse("not found"))
    }
}