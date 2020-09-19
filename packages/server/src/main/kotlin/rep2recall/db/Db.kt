package rep2recall.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File
import java.net.URI
import java.nio.file.Paths

object Db {
    val root: File = if (Db::class.java.getResource("Db.class").toString().startsWith("jar:")) {
        File(Db::class.java.protectionDomain.codeSource.location.toURI()).parentFile
    } else {
        File(System.getProperty("user.dir"))
    }

    fun init(dbString: String, name: String? = null): Database {
        val db = if (dbString.contains("://")) {
            val uri = URI(dbString)
            val user = uri.userInfo.split(':', limit = 2)

            Database.connect(
                    url = "jdbc:postgresql://${uri.host}:${uri.port}${uri.path}",
                    driver = "org.postgresql.Driver",
                    user = user[0],
                    password = user[1]
            )
        } else {
            val dbPath = Paths.get(root.toString(), dbString)

            Database.connect(
                    url = "jdbc:sqlite:${dbPath.toUri().path}",
                    driver = "org.sqlite.JDBC",
                    user = "",
                    password = ""
            )
        }

        transaction(db) {
            if (db.dialect.allTablesNames().isEmpty()) {
                SchemaUtils.create(NoteTable, NoteAttrTable)
                NoteAttr.init()
            }
        }

        return db
    }
}
