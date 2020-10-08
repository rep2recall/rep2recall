package rep2recall

import io.javalin.Javalin
import io.javalin.apibuilder.ApiBuilder.path
import rep2recall.api.Api

fun main() {
    val app = Javalin.create {
        if (Api.db.isJar) {
            it.addStaticFiles("/public")
        } else {
            it.enableCorsForAllOrigins()
        }

        it.sessionHandler {
            Api.sessionHandler
        }
    }.start(System.getenv("PORT")?.toInt() ?: 24000)

    app.routes {
        path("api", Api.router)
    }

    if (!Api.db.isJar) {
        app.get("/") { ctx -> ctx.result("Ready") }
    }
}
