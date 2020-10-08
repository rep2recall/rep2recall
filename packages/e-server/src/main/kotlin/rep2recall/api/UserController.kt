package rep2recall.api

import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.Context
import rep2recall.db.User
import rep2recall.db.UserTable
import io.javalin.apibuilder.ApiBuilder.*

object UserController {
    val handler = EndpointGroup {
        get(this::getOne)
        patch("secret", this::newSecret)
        post("signOut", this::signOut)
        delete(this::delete)
    }

    private fun getOne(ctx: Context) {
        ctx.json(User.find {
            UserTable.id eq ctx.sessionAttribute<String>("userId")
        }.firstOrNull() ?: mapOf<String, Any>())
    }

    private fun newSecret(ctx: Context) {
        val u = User.find {
            UserTable.id eq ctx.sessionAttribute<String>("userId")
        }.firstOrNull()

        if (u != null) {
            u.apiKey = User.newApiKey()
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