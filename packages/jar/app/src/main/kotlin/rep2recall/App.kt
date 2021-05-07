package rep2recall

import io.javalin.Javalin
import io.javalin.apibuilder.ApiBuilder.path
import io.javalin.plugin.json.FromJsonMapper
import io.javalin.plugin.json.JavalinJson
import io.javalin.plugin.json.ToJsonMapper
import io.javalin.plugin.openapi.OpenApiOptions
import io.javalin.plugin.openapi.OpenApiPlugin
import io.javalin.plugin.openapi.annotations.HttpMethod
import io.javalin.plugin.openapi.ui.ReDocOptions
import io.swagger.v3.oas.models.info.Info
import rep2recall.db.Db
import rep2recall.db.gson
import rep2recall.api.Api

object App {
    fun serve() {
        val hasPublic = this.javaClass.classLoader
            .getResource("public") != null

        val app = Javalin.create {
            it.sessionHandler {
                Api.sessionHandler
            }

            it.registerPlugin(
                OpenApiPlugin(
                OpenApiOptions(
                    Info()
                    .version("0.1")
                    .description("Rep2recall API documentation")
                )
                    .path("/swagger-doc")
                    .reDoc(
                        ReDocOptions("/doc")
                        .title("Rep2recall API"))
                    .ignorePath("/", HttpMethod.GET)
            )
            )

            it.showJavalinBanner = false

            if (System.getenv("DEBUG") != null) {
                it.enableDevLogging()
            }

            if (!Db.isJar) {
                it.enableDevLogging()
                it.enableCorsForAllOrigins()
            }

            if (hasPublic) {
                it.addStaticFiles("/public")
                it.addSinglePageRoot("/", "/public/index.html")
            }
        }

        app.routes {
            path("api", Api.router)
        }

        if (!hasPublic) {
            app.get("/") { ctx -> ctx.result("Ready") }
        }

        app.start(Api.port)
    }
}

fun main() {
    JavalinJson.fromJsonMapper = object : FromJsonMapper {
        override fun <T> map(json: String, targetClass: Class<T>) = gson.fromJson(json, targetClass)
    }

    JavalinJson.toJsonMapper = object : ToJsonMapper {
        override fun map(obj: Any): String = gson.toJson(obj)
    }

    App.serve()
}
