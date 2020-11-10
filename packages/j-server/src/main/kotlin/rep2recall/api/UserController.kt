package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.Context
import rep2recall.db.User
import rep2recall.db.UserTable
import io.javalin.apibuilder.ApiBuilder.*
import org.joda.time.DateTime
import rep2recall.db.filterKey

object UserController {
    val handler = EndpointGroup {
        get(this::getOne)
        patch("apiKey", this::newApiKey)
        post("signOut", this::signOut)
        delete(this::delete)
    }

    private fun getOne(ctx: Context) {
        val select = ctx.queryParam<String>("select").get()
                .split(",")
                .toSet()

        User.find {
            UserTable.id eq ctx.sessionAttribute<String>("userId")
        }.firstOrNull()?.let {
            ctx.json(it.filterKey(select))
        } ?: ctx.status(404).json(mapOf(
                "error" to "not found"
        ))
    }

    private fun newApiKey(ctx: Context) {
        val u = User.find {
            UserTable.id eq ctx.sessionAttribute<String>("userId")
        }.firstOrNull()

        if (u != null) {
            u.apiKey = User.newApiKey()
            u.updatedAt = DateTime.now()
        }

        ctx.status(201)
    }

    private fun signOut(ctx: Context) {
        ctx.sessionAttribute("userId", null)
        ctx.status(201)
    }

    private fun delete(ctx: Context) {
        User.find {
            UserTable.id eq ctx.sessionAttribute<String>("userId")
        }.firstOrNull()?.delete()

        ctx.status(201)
    }
}