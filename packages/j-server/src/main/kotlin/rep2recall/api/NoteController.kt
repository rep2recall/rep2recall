package rep2recall.api

import com.github.salomonbrys.kotson.fromJson
import com.google.gson.JsonElement
import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import io.javalin.plugin.openapi.annotations.*
import org.jetbrains.exposed.sql.*
import org.joda.time.DateTime
import rep2recall.db.*

object NoteController {
    val handler = EndpointGroup {
        get(this::getOne)
        put(this::create)
        patch(this::update)
        delete(this::delete)
    }

    @OpenApi(
            tags = ["note"],
            summary = "Get a Note",
            description = "either id or key is required",
            queryParams = [
                OpenApiParam("select", String::class, required = true,
                    description = "Comma (,) separated fields"),
                OpenApiParam("id", String::class),
                OpenApiParam("key", String::class)
            ],
            responses = [
                OpenApiResponse("200", [OpenApiContent(NotePartialSer::class)]),
                OpenApiResponse("404", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun getOne(ctx: Context) {
        val select = ctx.queryParam<String>("select").get()
                .split(",")
                .toSet()

        _findOne(ctx)?.let {
            ctx.json(it.filterKey(select))
        } ?: ctx.status(404).json(StdErrorResponse("not found"))
    }

    @OpenApi(
            tags = ["note"],
            summary = "Create a Note",
            requestBody = OpenApiRequestBody([OpenApiContent(NoteSer::class)]),
            responses = [
                OpenApiResponse("201", [OpenApiContent(CreateResponse::class)])
            ]
    )
    private fun create(ctx: Context) {
        val body = ctx.bodyValidator<NoteSer>().get()

        val n = Note.create(
                User.findById(ctx.sessionAttribute<String>("userId")!!)!!,
                body
        )

        ctx.status(201).json(CreateResponse(n.id.value))
    }

    @OpenApi(
            tags = ["note"],
            summary = "Update a Note",
            description = "either id or key is required",
            queryParams = [
                OpenApiParam("id", String::class),
                OpenApiParam("key", String::class)
            ],
            requestBody = OpenApiRequestBody([OpenApiContent(NotePartialSer::class)]),
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun update(ctx: Context) {
        val body = ctx.body<Map<String, JsonElement>>()

        _findOne(ctx)?.let { n ->
            n.updatedAt = DateTime.now()

            body["nextReview"]?.let {
                n.nextReview = if (it.isJsonNull) {
                    null
                } else DateTime.parse(gson.fromJson(it))
            }

            body["lastRight"]?.let {
                n.lastRight = if (it.isJsonNull) {
                    null
                } else DateTime.parse(gson.fromJson(it))
            }

            body["lastWrong"]?.let {
                n.lastWrong = if (it.isJsonNull) {
                    null
                } else DateTime.parse(gson.fromJson(it))
            }

            body["key"]?.let {
                n.key = gson.fromJson(it)
            }

            body["deck"]?.let {
                n.deck = gson.fromJson(it)
            }

            body["front"]?.let {
                n.front = gson.fromJson(it)
            }

            body["back"]?.let {
                n.back = gson.fromJson(it)
            }

            body["mnemonic"]?.let {
                n.mnemonic = gson.fromJson(it)
            }

            body["srsLevel"]?.let {
                n.srsLevel = gson.fromJson(it)
            }

            body["rightStreak"]?.let {
                n.rightStreak = gson.fromJson(it)
            }

            body["wrongStreak"]?.let {
                n.wrongStreak = gson.fromJson(it)
            }

            body["maxRight"]?.let {
                n.maxRight = gson.fromJson(it)
            }

            body["maxWrong"]?.let {
                n.maxWrong = gson.fromJson(it)
            }

            body["data"]?.let {
                val data = gson.fromJson<List<NoteAttrSer>>(it)
                val oldItems = n.data.toMutableList()

                for (a in data) {
                    var isNew = true
                    for (item in oldItems) {
                        if (a.key == item.key) {
                            item.value = a.value
                            oldItems.remove(item)
                            isNew = false
                            break
                        }
                    }

                    if (isNew) {
                        NoteAttr.create(a.key, a.value, n)
                    }
                }

                for (item in oldItems) {
                    item.delete()
                }
            }

            body["tag"]?.let {
                User.findById(ctx.sessionAttribute<String>("userId")!!)?.let { u ->
                    val tags = gson.fromJson<List<String>>(it)
                    n.tags = SizedCollection(tags.map { t ->
                        Tag.upsert(u, t)
                    })
                }
            }

            ctx.status(201).json(mapOf(
                    "result" to "updated"
            ))
        } ?: ctx.status(304).json(mapOf(
                "error" to "not found"
        ))
    }

    @OpenApi(
            tags = ["note"],
            summary = "Delete a Note",
            description = "either id or key is required",
            queryParams = [
                OpenApiParam("id", String::class),
                OpenApiParam("key", String::class)
            ],
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun delete(ctx: Context) {
        _findOne(ctx)?.let {
            it.delete()

            ctx.status(201).json(StdSuccessResponse("deleted"))
        } ?: ctx.status(304).json(StdErrorResponse("not found"))
    }

    @Suppress("FunctionName")
    private fun _findOne(ctx: Context) = (
            ctx.queryParam<String>("id").getOrNull()?.let {
                Note.find {
                    NoteTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (NoteTable.id eq it)
                }
            } ?: ctx.queryParam<String>("key").get().let {
                Note.find {
                    NoteTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (NoteTable.key eq it)
                }
            }).firstOrNull()
}