package rep2recall.api

import com.github.salomonbrys.kotson.fromJson
import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import io.javalin.plugin.openapi.annotations.*
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.transactions.transaction
import org.joda.time.DateTime
import rep2recall.db.*

object PresetController {
    val handler = EndpointGroup {
        get(this::getOne)
        get("all", this::getAll)
        put(this::create)
        patch(this::update)
        delete(this::delete)
    }

    @OpenApi(
            tags = ["preset"],
            summary = "Get a Preset",
            queryParams = [
                OpenApiParam("select", String::class, required = true,
                        description = "Comma (,) separated fields"),
                OpenApiParam("id", String::class, required = false)
            ],
            responses = [
                OpenApiResponse("200", [OpenApiContent(PresetPartialSer::class)]),
                OpenApiResponse("400", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun getOne(ctx: Context) {
        val select = ctx.queryParam<String>("select").get()
                .split(",")
                .toSet()

        val id = ctx.queryParam("id") ?: ""

        transaction {
            Preset.find {
                PresetTable.userId eq ctx.sessionAttribute<String>("userId") and
                        (PresetTable.id eq id)
            }.firstOrNull()?.let {
                ctx.json(it.filterKey(select))
            }
        } ?: ctx.status(400).json(StdErrorResponse("not found"))
    }

    @OpenApi(
            tags = ["preset"],
            summary = "Get all Presets",
            responses = [
                OpenApiResponse("200", [OpenApiContent(PresetGetAllResponse::class)])
            ]
    )
    private fun getAll(ctx: Context) {
        transaction {
            ctx.json(PresetGetAllResponse(
                    Preset.find {
                        PresetTable.userId eq ctx.sessionAttribute<String>("userId")
                    }.orderBy(
                            PresetTable.updatedAt to SortOrder.DESC,
                            PresetTable.id to SortOrder.DESC
                    ).map { it.serialize() }
            ))
        }
    }

    @OpenApi(
            tags = ["preset"],
            summary = "Create a Preset",
            requestBody = OpenApiRequestBody([OpenApiContent(PresetSer::class)]),
            responses = [
                OpenApiResponse("201", [OpenApiContent(CreateResponse::class)])
            ]
    )
    private fun create(ctx: Context) {
        val body = ctx.bodyValidator<PresetSer>().get()

        val p = transaction {
            Preset.create(
                    User.findById(ctx.sessionAttribute<String>("userId")!!)!!,
                    body
            )
        }

        ctx.status(201).json(CreateResponse(p.id.value))
    }

    @OpenApi(
            tags = ["preset"],
            summary = "Update a Preset",
            queryParams = [
                OpenApiParam("id", String::class, required = false)
            ],
            requestBody = OpenApiRequestBody([OpenApiContent(PresetPartialSer::class)]),
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun update(ctx: Context) {
        val id = ctx.queryParam("id") ?: ""
        val body = ctx.body<Map<String, Any>>()

        transaction {
            Preset.find {
                PresetTable.userId eq ctx.sessionAttribute<String>("userId") and
                        (PresetTable.id eq id)
            }.firstOrNull()?.let { p ->
                p.updatedAt = DateTime.now()

                body["q"]?.let {
                    p.q = gson.fromJson(gson.toJson(it))
                }

                body["name"]?.let {
                    p.name = gson.fromJson(gson.toJson(it))
                }

                body["status"]?.let {
                    p.status = gson.fromJson(gson.toJson(it))
                }

                body["selected"]?.let {
                    p.selected = gson.fromJson(gson.toJson(it))
                }

                body["opened"]?.let {
                    p.opened = gson.fromJson(gson.toJson(it))
                }

                ctx.status(201).json(StdSuccessResponse("updated"))
            }
        } ?: ctx.status(304).json(StdErrorResponse("not found"))
    }

    @OpenApi(
            tags = ["preset"],
            summary = "Delete a Preset",
            queryParams = [
                OpenApiParam("id", String::class, required = true)
            ],
            responses = [
                OpenApiResponse("201", [OpenApiContent(StdSuccessResponse::class)]),
                OpenApiResponse("304", [OpenApiContent(StdErrorResponse::class)])
            ]
    )
    private fun delete(ctx: Context) {
        val id = ctx.queryParam<String>("id").get()

        transaction {
            Preset.find {
                PresetTable.userId eq ctx.sessionAttribute<String>("userId") and
                        (PresetTable.id eq id)
            }.firstOrNull()?.let {
                it.delete()

                ctx.status(201).json(StdSuccessResponse("deleted"))
            }
        } ?: ctx.status(304).json(StdErrorResponse("not found"))
    }
}