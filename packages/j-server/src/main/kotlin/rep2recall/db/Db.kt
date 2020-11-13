package rep2recall.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.TransactionManager
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.transactions.transactionManager
import java.io.File
import java.nio.file.Path
import java.sql.Connection
import java.sql.ResultSet

object Db {
    val isJar = Db::class.java.getResource("Db.class").toString().startsWith("jar:")
    val root: File = if (isJar) {
        File(Db::class.java.protectionDomain.codeSource.location.toURI()).parentFile
    } else {
        File(System.getProperty("user.dir"))
    }
    val mediaPath: Path = Path.of(root.toString(), "_media")

    private const val DEFAULT_SQLITE_DB_NAME = "data.db"
    const val SQLITE_DRIVER = "org.sqlite.JDBC"
    const val POSTGRES_DRIVER = "org.postgresql.Driver"

    val driver: String
    val connectionUrl: String
    val db: Database

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
        mediaPath.toFile().mkdir()

        val databaseURL = System.getenv("DATABASE_URL") ?: DEFAULT_SQLITE_DB_NAME
        val m = Regex("postgres(ql)?://(?<user>[^:]+):(?<pass>[^@]+)@(?<r>.+)")
                .matchEntire(databaseURL)

        driver = m?.let { POSTGRES_DRIVER } ?: SQLITE_DRIVER
        connectionUrl = m?.let {
            "jdbc:postgresql://${it.groups["r"]!!.value}"
        } ?: let {
            val dbPath = Path.of(root.toString(), databaseURL)
            "jdbc:sqlite:${dbPath.toUri().path}"
        }
        db = m?.let {
                    Database.connect(
                            url = connectionUrl,
                            driver = driver,
                            user = it.groups["user"]!!.value,
                            password = it.groups["pass"]!!.value
                    )
                } ?: Database.connect(
                        url = connectionUrl,
                        driver = driver,
                        user = "",
                        password = ""
                )

        m ?: let {
            TransactionManager.manager.defaultIsolationLevel =
                    Connection.TRANSACTION_SERIALIZABLE
        }

        transaction(db) {
            if (db.dialect.allTablesNames().isEmpty()) {
                val tables = arrayOf(
                        UserTable, NoteAttrTable, NoteTable, PresetTable,
                        TagTable
                )

                SchemaUtils.create(*tables)
                tables.map {
                    it.init()
                }

                SchemaUtils.create(NoteTagTable)

                User.create("")
            }
        }
    }
}