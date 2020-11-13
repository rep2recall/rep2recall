package rep2recall.db

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.statements.api.PreparedStatementApi
import org.postgresql.util.PGobject
import org.jetbrains.exposed.sql.Function

class JsonbColumnType<T : Any>(
        private val stringify: (T) -> String,
        private val parse: (String) -> T
) : ColumnType() {
    override fun sqlType() = if(Db.driver == Db.POSTGRES_DRIVER) JSONB else TEXT

    override fun setParameter(stmt: PreparedStatementApi, index: Int, value: Any?) {
        super.setParameter(stmt, index, value.let {
            PGobject().apply {
                this.type = sqlType()
                this.value = value as String?
            }
        })
    }

    override fun valueFromDB(value: Any): Any {
        return when (value) {
            is PGobject -> parse(value.value)
            is String -> parse(value)
            else -> value
        }
    }

    override fun valueToString(value: Any?): String = when (value) {
        is Iterable<*> -> nonNullValueToString(value)
        else -> super.valueToString(value)
    }

    @Suppress("UNCHECKED_CAST")
    override fun notNullValueToDB(value: Any) = stringify(value as T)

    companion object {
        const val JSONB = "JSONB"
        const val TEXT = "TEXT"
    }
}

fun <T: Any> Table.jsonb(name: String, stringify: (T) -> String, parse: (String) -> T): Column<T> =
        registerColumn(name, JsonbColumnType(stringify, parse))


class JsonValue<T>(
        val expr: Expression<*>,
        override val columnType: ColumnType,
        val jsonPath: List<String>
) : Function<T>(columnType) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) = queryBuilder {
        val castJson = columnType.sqlType() != JsonbColumnType.JSONB
        if (castJson) append("(")
        append(expr)
        append(" #>")
        if (castJson) append(">")
        append(" '{${jsonPath.joinToString { escapeFieldName(it) }}}'")
        if (castJson) append(")::${columnType.sqlType()}")
    }

    companion object {
        private fun escapeFieldName(value: String) = value.map {
            fieldNameCharactersToEscape[it] ?: it
        }.joinToString("").let { "\"$it\"" }

        private val fieldNameCharactersToEscape = mapOf(
                // '\"' to "\'\'", // no need to escape single quote as we put string in double quotes
                '\"' to "\\\"",
                '\r' to "\\r",
                '\n' to "\\n"
        )
    }
}

inline fun <reified T> Column<*>.json(vararg jsonPath: String): JsonValue<T> {
    val columnType = when (T::class) {
        Boolean::class -> BooleanColumnType()
        Int::class -> IntegerColumnType()
        Float::class -> FloatColumnType()
        String::class -> TextColumnType()
        else -> JsonbColumnType({ error("Unexpected call") }, { error("Unexpected call") })
    }
    return JsonValue(this, columnType, jsonPath.toList())
}


class JsonContainsOp(expr1: Expression<*>, expr2: Expression<*>) : ComparisonOp(expr1, expr2, "??")

/** Checks if this expression contains some [t] value. */
infix fun <T> JsonValue<Any>.contains(t: T): JsonContainsOp =
        JsonContainsOp(this, SqlExpressionBuilder.run { this@contains.wrap(t) })

/** Checks if this expression contains some [other] expression. */
infix fun <T> JsonValue<Any>.contains(other: Expression<T>): JsonContainsOp =
        JsonContainsOp(this, other)