package rep2recall.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.transactions.transactionManager
import java.io.File
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

    private val username = ""
    private val password = ""
    private val dbPath = Paths.get(root.toString(), dbString)

    val driver = "org.h2.Driver"
    val connectionUrl = "jdbc:h2:${dbPath.toUri().path}"
    val db = Database.connect(
            url = connectionUrl,
            driver = driver,
            user = username,
            password = password
    )

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
        transaction(db) {
            val tables = arrayOf(
                    NoteAttrTable, QuizTable, TemplateTable, UserTable
            )

            if (db.dialect.allTablesNames().isEmpty()) {
                SchemaUtils.create(*tables)
                tables.map {
                    it.init()
                }

                User.create("default")
            }
        }
    }
}