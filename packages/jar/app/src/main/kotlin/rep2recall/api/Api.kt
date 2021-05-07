package rep2recall.api

import io.javalin.apibuilder.ApiBuilder.before
import io.javalin.apibuilder.ApiBuilder.get
import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.Context
import io.javalin.http.util.RateLimit
import io.javalin.plugin.openapi.annotations.OpenApi
import io.javalin.plugin.openapi.annotations.OpenApiContent
import io.javalin.plugin.openapi.annotations.OpenApiResponse
import org.eclipse.jetty.server.session.DatabaseAdaptor
import org.eclipse.jetty.server.session.DefaultSessionCache
import org.eclipse.jetty.server.session.JDBCSessionDataStoreFactory
import org.eclipse.jetty.server.session.SessionHandler
import rep2recall.db.Db
import java.nio.file.Path
import java.util.concurrent.TimeUnit

object Api {
    val port = System.getenv("PORT")?.toInt() ?: 36393

    val router = EndpointGroup {
        before { ctx ->
            RateLimit(ctx).requestPerTimeUnit(10, TimeUnit.SECONDS)

            ctx.header<String>("Authorization")
                .check({ it.startsWith("Bearer ") })
                .getOrNull()?.let { authString ->
                    ctx.sessionAttribute(
                        "userId",
                        authString
                    )
                    return@before
                }

            if (System.getenv("DATABASE_URL").isNullOrEmpty()) {
                ctx.sessionAttribute(
                    "userId",
                    null
                )
            }
        }

        get("config", this::getConfig)
    }

    val sessionHandler = SessionHandler().apply {
        sessionCache = DefaultSessionCache(this).apply {
            sessionDataStore = JDBCSessionDataStoreFactory().apply {
                setDatabaseAdaptor(DatabaseAdaptor().apply {
                    setDriverInfo(Db.SQLITE_DRIVER, let {
                        val dbPath = Path.of(Db.root.toString(), "session.db")
                        "jdbc:sqlite:${dbPath.toUri().path}"
                    })
                })
            }.getSessionDataStore(sessionHandler)
        }
        httpOnly = true
    }

    @OpenApi(
        summary = "Get server config",
        responses = [
            OpenApiResponse("200", [OpenApiContent(Config::class)])
        ]
    )
    private fun getConfig(ctx: Context) {
        ctx.json(Config(
            baseURL = "http://localhost:$port"
        ))
    }
}