package rep2recall.api

import com.github.salomonbrys.kotson.fromJson
import com.google.gson.JsonElement
import io.javalin.apibuilder.EndpointGroup
import io.javalin.apibuilder.ApiBuilder.*
import io.javalin.http.Context
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.and
import rep2recall.db.*

object PresetController {
    val handler = EndpointGroup {
        get(this::getOne)
        get("all", this::getAll)
        put(this::create)
        patch(this::update)
        delete(this::delete)
    }

    private fun getOne(ctx: Context) {
        val select = ctx.queryParam<String>("select").get()
                .split(",")
                .toSet()

        val id = ctx.queryParam<String>("id").get()

        Preset.find {
            PresetTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (PresetTable.id eq id)
        }.firstOrNull()?.let {
            ctx.json(it.filterKey(select))
        } ?: ctx.status(404).json(mapOf(
                "error" to "not found"
        ))
    }

    private fun getAll(ctx: Context) {
        ctx.json(Preset.find {
            PresetTable.userId eq ctx.sessionAttribute<String>("userId")
        }.orderBy(
                PresetTable.updatedAt to SortOrder.DESC,
                PresetTable.id to SortOrder.DESC
        ).map { it.serialize() })
    }

    private fun create(ctx: Context) {
        val body = ctx.bodyValidator<Preset.Ser>().get()

        val p = Preset.create(
                User.findById(ctx.sessionAttribute<String>("userId")!!)!!,
                body
        )

        ctx.status(201).json(mapOf(
                "id" to p.id.value
        ))
    }

    private fun update(ctx: Context) {
        val id = ctx.queryParam<String>("id").get()
        val body = ctx.body<Map<String, JsonElement>>()

        Preset.find {
            PresetTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (PresetTable.id eq id)
        }.firstOrNull()?.let { p ->
            body["q"]?.let {
                p.q = gson.fromJson(it)
            }

            body["name"]?.let {
                p.name = gson.fromJson(it)
            }

            body["status"]?.let {
                p.status = gson.fromJson(it)
            }

            body["selected"]?.let {
                p.selected = gson.fromJson(it)
            }

            body["opened"]?.let {
                p.opened = gson.fromJson(it)
            }

            ctx.status(201).json(mapOf(
                    "result" to "updated"
            ))
        } ?: ctx.status(304).json(mapOf(
                "error" to "not found"
        ))
    }

    private fun delete(ctx: Context) {
        val id = ctx.queryParam<String>("id").get()

        Preset.find {
            PresetTable.userId eq ctx.sessionAttribute<String>("userId") and
                    (PresetTable.id eq id)
        }.firstOrNull()?.let {
            it.delete()

            ctx.status(201).json(mapOf(
                    "result" to "deleted"
            ))
        } ?: ctx.status(304).json(mapOf(
                "error" to "not found"
        ))
    }
}