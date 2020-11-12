package rep2recall.api

import com.github.salomonbrys.kotson.fromJson
import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.Context
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.plugin.openapi.annotations.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.joda.time.DateTime
import rep2recall.db.*

object UserController {
    val handler = EndpointGroup {
        get(this::getOne)
        patch(this::update)
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

        transaction {
            User.find {
                UserTable.id eq ctx.sessionAttribute<String>("userId")
            }.firstOrNull()?.let {
                ctx.json(it.filterKey(select))
            }
        } ?: ctx.status(400).json(StdErrorResponse("not found"))
    }

    @OpenApi(
            tags = ["user"],
            summary = "Update current User",
            requestBody = OpenApiRequestBody([OpenApiContent(UserPartialSer::class)]),
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun update(ctx: Context) {
        val body = ctx.body<Map<String, Any>>()

        transaction {
            User.find {
                UserTable.id eq ctx.sessionAttribute<String>("userId")
            }.firstOrNull()?.let { p ->
                p.updatedAt = DateTime.now()

                body["email"]?.let {
                    p.email = gson.fromJson(gson.toJson(it))
                }

                body["image"]?.let {
                    p.image = gson.fromJson(gson.toJson(it))
                }

                body["name"]?.let {
                    p.name = gson.fromJson(gson.toJson(it))
                }

                ctx.status(201).json(StdSuccessResponse("updated"))
            }
        } ?: ctx.status(304).json(StdErrorResponse("not found"))
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
        transaction {
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
        transaction {
            User.find {
                UserTable.id eq ctx.sessionAttribute<String>("userId")
            }.firstOrNull()?.delete()
        }

        ctx.sessionAttribute("userId", null)
        ctx.status(201).json(StdSuccessResponse("signed out"))
    }
}