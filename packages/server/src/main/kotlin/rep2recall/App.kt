package rep2recall

import io.javalin.Javalin
import org.jetbrains.exposed.sql.StdOutSqlLogger
import org.jetbrains.exposed.sql.addLogger
import org.jetbrains.exposed.sql.transactions.transaction
import rep2recall.db.Db
import rep2recall.db.Note
import rep2recall.db.NoteAttr
import java.net.URI
import java.nio.file.Paths

fun main() {
//    val app = Javalin.create().start(System.getenv("PORT")?.toInt() ?: 8080)
//    app.get("/") { ctx -> ctx.result("Hello World") }
    Db.init("test.db")

    transaction {
        addLogger(StdOutSqlLogger)

        val n = Note.new {  }
        NoteAttr.new {
            key = "x"
            value = "b"
            note = n.id
        }
        NoteAttr.new {
            key = "y"
            value = "a"
            note = n.id
        }
    }

    transaction {
        println(Note.all())
    }
}
