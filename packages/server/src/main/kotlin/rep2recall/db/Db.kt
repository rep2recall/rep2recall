package rep2recall.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.transactions.transactionManager
import java.io.File
import java.net.URI
import java.nio.file.Path
import java.nio.file.Paths
import java.sql.ResultSet

class Db(
        dbString: String
) {
    val isJar = Db::class.java.getResource("Db.class").toString().startsWith("jar:")
    private val root: File = if (isJar) {
        File(Db::class.java.protectionDomain.codeSource.location.toURI()).parentFile
    } else {
        File(System.getProperty("user.dir"))
    }

    val db: Database
    val driver: String
    val connectionUrl: String
    private val username: String
    private val password: String
    private val dbPath: Path?

    val isLocal get() = dbPath != null

    fun <T:Any>exec(
            stmt: String,
            // args: Iterable<Pair<ColumnType, Any?>>, // safeString = unsafeString.Replace("'","''");
            transform: (ResultSet) -> T
    ): List<T> {
        val result = arrayListOf<T>()
        db.transactionManager.currentOrNull()?.exec(stmt) { rs ->
            while (rs.next()) {
                result += transform(rs)
            }
        }
        return result.toList()
    }

    init {
        if (dbString.contains("://")) {
            val uri = URI(dbString)
            val user = uri.userInfo.split(':', limit = 2)

            dbPath = null
            connectionUrl = "jdbc:postgresql://${uri.host}:${uri.port}${uri.path}"
            driver = "org.postgresql.Driver"
            username = user[0]
            password = user[1]
        } else {
            dbPath = Paths.get(root.toString(), dbString)
            connectionUrl = "jdbc:h2:${dbPath.toUri().path}"
            driver = "org.h2.Driver"
            username = ""
            password = ""
        }

        db = Database.connect(
                url = connectionUrl,
                driver = driver,
                user = username,
                password = password
        )

        transaction(db) {
            val tables = arrayOf(
                    NoteTable, NoteAttrTable, QuizTable, TemplateTable, UserTable
            )

            if (db.dialect.allTablesNames().isEmpty()) {
                SchemaUtils.create(*tables)
                tables.map {
                    it.init()
                }

                User.create("")
            }
        }
    }
}
