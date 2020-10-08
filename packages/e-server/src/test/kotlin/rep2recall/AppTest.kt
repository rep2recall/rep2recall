package rep2recall

import org.jetbrains.exposed.sql.StdOutSqlLogger
import org.jetbrains.exposed.sql.addLogger
import org.jetbrains.exposed.sql.transactions.transaction
import rep2recall.db.*
import java.util.regex.Pattern
import kotlin.test.Ignore
import kotlin.test.Test

class AppTest {
    @Test
    @Ignore
    fun `database run`() {
        /**
         * h2 database for local, postgres for online
         * extension `.mv.db` automatically added for local
         */
        val db = Db("test")

        transaction(db.db) {
            addLogger(StdOutSqlLogger)

            val u = User.create("patarapolw@gmail.com")

            Note.create(
                    user = u,
                    attrs = listOf(
                            NoteAttr.Ser("x", "b"),
                            NoteAttr.Ser("y", "a")
                    )
            )

            Note.create(
                    user = u,
                    attrs = listOf(
                            NoteAttr.Ser("x", "b"),
                            NoteAttr.Ser("y", "a")
                    )
            )
        }

        transaction(db.db) {
            addLogger(StdOutSqlLogger)

            val deck = listOf("hello*", "world").joinToString("\u001f")
            println(
                    Quiz
                            .find { QuizTable.deck regexp "^${Pattern.quote(deck)}\u001f" }
                            .map { it.serialize() }
            )
        }
    }

    @Test
    @Ignore
    fun `string split`() {
        val m = Regex("(?:^| )((?:\"(?:[^\"]+)*\"|'(?:[^']+)*'|[^ ])+)").toPattern()
                .matcher("a b 'c d'e")
        val matches = mutableListOf<String>()
        while (m.find()) {
            matches.add(m.group(1));
        }
        println(matches)
    }
}
