package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.Context
import rep2recall.db.User
import rep2recall.db.UserTable
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.plugin.openapi.annotations.OpenApi
import io.javalin.plugin.openapi.annotations.OpenApiContent
import io.javalin.plugin.openapi.annotations.OpenApiParam
import io.javalin.plugin.openapi.annotations.OpenApiResponse
import org.jetbrains.exposed.sql.transactions.transaction
import org.joda.time.DateTime
import rep2recall.db.UserPartialSer
import rep2recall.db.filterKey

object UserController {
    val handler = EndpointGroup {
        get(this::getOne)
        patch("apiKey", this::newApiKey)
        post("signOut", this::signOut)
        delete(this::delete)
    }

    @OpenApi(
            tags = ["user"],
            summary = "Get current User",
            queryParams = [
                OpenApiParam("select", String::class, required = true,
                        description = "Comma (,) separated fields")
            ],
            responses = [
                OpenApiResponse("200", [OpenApiContent(UserPartialSer::class)]),
                OpenApiResponse("400", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun getOne(ctx: Context) {
        val select = ctx.queryParam<String>("select").get()
                .split(",")
                .toSet()

        transaction(Api.db.db) {
            User.find {
                UserTable.id eq ctx.sessionAttribute<String>("userId")
            }.firstOrNull()?.let {
                ctx.json(it.filterKey(select))
            }
        } ?: ctx.status(400).json(StdErrorResponse("not found"))
    }

    @OpenApi(
            tags = ["user"],
            summary = "Get and update apiKey",
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun newApiKey(ctx: Context) {
        transaction(Api.db.db) {
            User.find {
                UserTable.id eq ctx.sessionAttribute<String>("userId")
            }.firstOrNull()?.let { u ->
                val apiKey = User.newApiKey()
                u.apiKey = apiKey
                u.updatedAt = DateTime.now()

                ctx.status(201).json(StdSuccessResponse(apiKey))
            }
        } ?: ctx.status(304).json(StdErrorResponse("not found"))
    }

    @OpenApi(
            tags = ["user"],
            summary = "Sign out of current user",
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)])
            ]
    )
    private fun signOut(ctx: Context) {
        ctx.sessionAttribute("userId", null)
        ctx.status(201).json(StdSuccessResponse("signed out"))
    }

    @OpenApi(
            tags = ["user"],
            summary = "Delete and sign out of current User",
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)])
            ]
    )
    private fun delete(ctx: Context) {
        transaction(Api.db.db) {
            User.find {
                UserTable.id eq ctx.sessionAttribute<String>("userId")
            }.firstOrNull()?.delete()
        }

        ctx.sessionAttribute("userId", null)
        ctx.status(201).json(StdSuccessResponse("signed out"))
    }
}