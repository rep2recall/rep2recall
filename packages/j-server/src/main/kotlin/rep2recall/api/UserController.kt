package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.Context
import rep2recall.db.User
import rep2recall.db.UserTable
import io.javalin.apibuilder.ApiBuilder.*
import org.joda.time.DateTime

object UserController {
    val handler = EndpointGroup {
        get(this::getOne)
        patch("secret", this::newSecret)
        post("signOut", this::signOut)
        delete(this::delete)
    }

    private fun getOne(ctx: Context) {
        User.find {
            UserTable.id eq ctx.sessionAttribute<String>("userId")
        }.firstOrNull()?.let {
            ctx.json(mapOf(
                    "email" to it.email,
                    "name" to it.name,
                    "apiKey" to it.apiKey
            ))
        } ?: ctx.json(mapOf<String, Any>())
    }

    private fun newSecret(ctx: Context) {
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