package rep2recall

import io.javalin.Javalin
import org.jetbrains.exposed.sql.StdOutSqlLogger
import org.jetbrains.exposed.sql.addLogger
import org.jetbrains.exposed.sql.transactions.transaction
import rep2recall.db.Db
import rep2recall.db.Note
import rep2recall.db.User

fun main() {
//    val app = Javalin.create().start(System.getenv("PORT")?.toInt() ?: 8080)
//    app.get("/") { ctx -> ctx.result("Hello World") }
    Db.init("test.h2.db")

    transaction {
        addLogger(StdOutSqlLogger)

        val u = User.create("patarapolw@gmail.com")

        Note.create(
                user = u,
                attrs = sortedMapOf(
                        "x" to "b",
                        "y" to "a"
                )
        )

        Note.create(
                user = u,
                attrs = sortedMapOf(
                        "x" to "b",
                        "y" to "a"
                )
        )
    }

    transaction {
        println(Note.all().map { it.serialize() })
    }
}
