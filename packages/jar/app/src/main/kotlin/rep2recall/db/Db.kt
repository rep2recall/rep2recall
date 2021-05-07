package rep2recall.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.transactions.transactionManager
import java.io.File
import java.nio.file.Path
import java.sql.ResultSet

object Db {
    val isJar = Db::class.java.getResource("Db.class")!!.toString().startsWith("jar:")
    val root: File = if (isJar) {
        File(Db::class.java.protectionDomain.codeSource.location.toURI()).parentFile
    } else {
        File(System.getProperty("user.dir"))
    }
    val mediaPath: Path = Path.of(root.toString(), "_media")

    const val H2_DRIVER = "org.h2.Driver"

    val dbPath = System.getenv("DATABASE_URL") ?: Path.of(root.toString(), "data").toString()
    val sessionPath = System.getenv("DATABASE_URL") ?: Path.of(root.toString(), "session").toString()

    val db = Database.connect(
        url = dbPath,
        driver = H2_DRIVER,
        user = System.getenv("H2_USER") ?: "",
        password = System.getenv("H2_PASS") ?: ""
    )

    fun exec(
        stmt: String,
        // args: Iterable<Pair<ColumnType, Any?>>, // safeString = unsafeString.Replace("'","''");
    ) {
        db.transactionManager.currentOrNull()?.exec(stmt)
    }

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
//        transaction(db) {
//            if (db.dialect.allTablesNames().isEmpty()) {
//                null
//            }
//        }
    }
}