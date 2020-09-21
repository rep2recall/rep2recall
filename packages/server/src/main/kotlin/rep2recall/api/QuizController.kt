package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import org.jetbrains.exposed.sql.*
import rep2recall.db.*

object QuizController {
    val handler = EndpointGroup {
        get(this::getOne)
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
            val offset: Int = 0,
            val limit: Int = 5,
            val sort: List<String> = listOf("-id")
    )

    private fun query(ctx: Context) {
        val body = ctx.bodyValidator(QueryRequest::class.java).get()


    }
}