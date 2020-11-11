package rep2recall.api

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.gson.JsonParser
import io.javalin.apibuilder.ApiBuilder.before
import io.javalin.apibuilder.ApiBuilder.path
import io.javalin.apibuilder.EndpointGroup
import io.javalin.http.util.RateLimit
import org.eclipse.jetty.server.session.DatabaseAdaptor
import org.eclipse.jetty.server.session.DefaultSessionCache
import org.eclipse.jetty.server.session.JDBCSessionDataStoreFactory
import org.eclipse.jetty.server.session.SessionHandler
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.transactions.transaction
import rep2recall.db.Db
import rep2recall.db.User
import rep2recall.db.UserTable
import java.io.ByteArrayInputStream
import java.util.*
import java.util.concurrent.TimeUnit

object Api {
    val db = Db(System.getenv("DATABASE_URL") ?: "session")

    private val firebaseApp = System.getenv("FIREBASE_SDK")?.let { sdk ->
        System.getenv("FIREBASE_CONFIG")?.let { config ->
            FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(ByteArrayInputStream(sdk.toByteArray())))
                    .setDatabaseUrl(JsonParser.parseString(config)
                            .asJsonObject.get("databaseURL").asString)
                    .build()
            )
        }
    }

    val router = EndpointGroup {
        before { ctx ->
            RateLimit(ctx).requestPerTimeUnit(10, TimeUnit.SECONDS)

            ctx.header<String>("Authorization")
                    .check({ it.startsWith("Basic ") })
                    .getOrNull()?.let { authString ->
                        val u = String(Base64.getDecoder()
                                .decode(authString.split(" ")[1])).split(':', limit = 2)
                        ctx.sessionAttribute(
                                "userId",
                                transaction(db.db) {
                                    User.find {
                                        (UserTable.apiKey eq u[1]) and (UserTable.email eq u[0])
                                    }.firstOrNull()?.id?.value
                                }
                        )
                        return@before
                    }

            ctx.header<String>("Authorization")
                    .check({ it.startsWith("Bearer ") })
                    .getOrNull()?.let { authString ->
                        ctx.sessionAttribute(
                                "userId",
                                (firebaseApp?.let { firebaseApp ->
                                    try {
                                        val d = FirebaseAuth.getInstance(firebaseApp)
                                                .verifyIdToken(authString.split(" ")[1])
                                        transaction(db.db) {
                                            (User.find { UserTable.email eq d.email }.firstOrNull()
                                                    ?: User.create(d.email, d.name, d.picture)).id.value
                                        }
                                    } catch (e: Error) {
                                        ctx.status(401).result(e.message ?: "Unauthorized")
                                        null
                                    }
                                })
                        )
                        return@before
                    }

            if (System.getenv("DATABASE_URL").isNullOrEmpty()) {
                ctx.sessionAttribute(
                        "userId",
                        transaction(db.db) {
                            User.find {
                                UserTable.email eq (System.getenv("DEFAULT_USER") ?: "")
                            }.firstOrNull()?.id?.value
                        }
                )
            }
        }

        path("note", NoteController.handler)
        path("preset", PresetController.handler)
        path("quiz", QuizController.handler)
        path("user", UserController.handler)
    }

    val sessionHandler = SessionHandler().apply {
        sessionCache = DefaultSessionCache(this).apply {
            sessionDataStore = JDBCSessionDataStoreFactory().apply {
                setDatabaseAdaptor(DatabaseAdaptor().apply {
                    setDriverInfo(db.driver, db.connectionUrl)
                })
            }.getSessionDataStore(sessionHandler)
        }
        httpOnly = true
    }
}