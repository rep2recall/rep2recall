package rep2recall

import com.papsign.ktor.openapigen.OpenAPIGen
import com.papsign.ktor.openapigen.openAPIGen
import io.ktor.application.*
import io.ktor.features.CallLogging
import io.ktor.features.ContentNegotiation
import io.ktor.features.DefaultHeaders
import io.ktor.gson.gson
import io.ktor.response.respond
import io.ktor.routing.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import rep2recall.api.edit
import java.text.DateFormat

val PORT = System.getenv("PORT")?.toInt() ?: 12345

fun main() {
    embeddedServer(
        Netty,
        watchPaths = listOf("api"),
        module = Application::module,
        port = PORT
    ).start(wait = true)
}

fun Application.module() {
    install(DefaultHeaders)
    install(CallLogging)
    install(OpenAPIGen) {
        info {
            version = "0.1"
            title = "Rep2Recall Desktop"
            contact {
                name = "Pacharapol Withayasakpunt"
                email = "patarapolw@gmail.com"
            }
            server("http://localhost:$PORT")
        }
    }
    install(ContentNegotiation) {
        gson {
            setDateFormat(DateFormat.LONG)
            setPrettyPrinting()
        }
    }

    routing {
        get("/openapi.json") {
            call.respond(application.openAPIGen.api.serialize())
        }
        route("/api") { routing {
            edit()
        } }
    }
}