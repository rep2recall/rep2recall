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
import rep2recall.api.Api
import rep2recall.db.gson

fun main() {
    JavalinJson.fromJsonMapper = object : FromJsonMapper {
        override fun <T> map(json: String, targetClass: Class<T>) = gson.fromJson(json, targetClass)
    }

    JavalinJson.toJsonMapper = object : ToJsonMapper {
        override fun map(obj: Any): String = gson.toJson(obj)
    }

    val app = Javalin.create {
        it.registerPlugin(OpenApiPlugin(
                OpenApiOptions(Info()
                        .version("0.1")
                        .description("Rep2recall API documentation")
                )
                        .path("/swagger-doc")
                        .reDoc(ReDocOptions("/doc")
                                .title("Rep2recall API"))
                        .ignorePath("/", HttpMethod.GET)
        ))

        if (Api.db.isJar) {
            it.addStaticFiles("/public")
        } else {
            it.enableCorsForAllOrigins()
        }

        it.sessionHandler {
            Api.sessionHandler
        }
    }.start(System.getenv("PORT")?.toInt() ?: 36393)

    app.routes {
        path("api", Api.router)
    }

    if (!Api.db.isJar) {
        app.get("/") { ctx -> ctx.result("Ready") }
    }
}