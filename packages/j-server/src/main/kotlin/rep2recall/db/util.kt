package rep2recall.db

import com.google.gson.Gson
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IdTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greater
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNull
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.regexp
import org.joda.time.DateTime
import org.joda.time.Duration
import java.util.regex.Pattern

val gson = Gson()

abstract class IdInitTable<T:Comparable<T>>(name: String = ""): IdTable<T>(name) {
    open fun init() {}
}

data class QuerySplit(
        val and: List<QuerySplitPart>,
        val or: List<QuerySplitPart>,
        val not: List<QuerySplitPart>
)

data class QuerySplitPart(
        val key: String? = null,
        val op: String? = null,
        val value: String
)

object QueryUtil {
    fun parse(
            q: String,
            ops: List<String>,
            parseOp: (QuerySplitPart) -> Op<Boolean>
    ): Op<Boolean> {
        val and = mutableListOf<QuerySplitPart>()
        val or = mutableListOf<QuerySplitPart>()
        val not = mutableListOf<QuerySplitPart>()

        splitBy(q, " ").map { seg ->
            var ls = and
            var value = seg

            when(seg.getOrNull(0)) {
                '-' -> {
                    ls = not
                    value = seg.substring(1)
                }
                '?' -> {
                    ls = or
                    value = seg.substring(1)
                }
            }

            var isAppended = false

            for (op in ops) {
                val ps = splitBy(value, op)

                if (!isAppended && ps.size > 1) {
                    ls.add(QuerySplitPart(
                            key = ps[0],
                            op = op,
                            value = unquote(ps[1])
                    ))
                    isAppended = true
                }
            }

            if (!isAppended) {
                ls.add(QuerySplitPart(
                        value = unquote(value)
                ))
            }
        }

        val segs = QuerySplit(and, or, not)

        val notCond = segs.not.map { parseOp(it) }.let {
            if (it.isNotEmpty()) it.reduce { acc, op -> acc and op } else null
        }?.let { not(it) }
        val andCond = segs.and.map { parseOp(it) }.let {
            if (it.isNotEmpty()) it.reduce { acc, op -> acc and op } else null
        }?.let { andCond ->
            notCond?.let {
                andCond and notCond
            } ?: andCond
        }

        return segs.or.map { parseOp(it) }.let {
            if (it.isNotEmpty()) it.reduce { acc, op -> acc or op } else null
        }?.let { orCond ->
            andCond?.let {
                orCond or andCond
            } ?: orCond
        } ?: Op.TRUE
    }

    @JvmName("compIdString")
    fun comp(p: QuerySplitPart, c: Column<EntityID<String>>) = when(p.op) {
        "<" -> c less p.value
        "<=" -> c lessEq p.value
        ">" -> c greater p.value
        ">=" -> c greaterEq p.value
        else -> c eq p.value
    }

    @JvmName("compIdStringNullable")
    fun comp(p: QuerySplitPart, c: Column<EntityID<String>?>) = when(p.value) {
        "NULL" -> c.isNull()
        else -> c eq p.value
    }

    @JvmName("compIntNullable")
    fun comp(p: QuerySplitPart, c: Column<Int?>) = p.value.toIntOrNull()?.let {
        when(p.op) {
            "<" -> c less it
            "<=" -> c lessEq it
            ">" -> c greater it
            ">=" -> c greaterEq it
            else -> c eq it
        }
    } ?: if (p.value == "NULL") {
        c.isNull()
    } else Op.FALSE

    @JvmName("compDateTimeNullable")
    fun comp(p: QuerySplitPart, c: Column<DateTime?>) = parseTime(p.value)?.let {
        when(p.op) {
            "<" -> c less it
            "<=" -> c lessEq it
            ">" -> c greater it
            ">=" -> c greaterEq it
            else -> c less it
        }
    } ?: if (p.value == "NULL") {
        c.isNull()
    } else Op.FALSE

    fun comp(p: QuerySplitPart): Op<Boolean> {
        val q: Op<Boolean> = when(p.op) {
            "=" -> NoteAttrTable.value eq p.value
            "~" -> NoteAttrTable.value regexp p.value
            else -> NoteAttrTable.value regexp Pattern.quote(p.value)
        }

        return p.key?.let {
            (NoteAttrTable.key eq p.key) and q
        } ?: q
    }

    private fun splitBy(q: String, splitter: String): List<String> {
        val m = getRegex(splitter).toPattern()
                .matcher(q)
        val matches = mutableListOf<String>()
        while (m.find()) {
            matches.add(m.group(1))
        }
        return matches.toList().filter { it.isNotBlank() }
    }

    private fun getRegex(splitter: String): Regex {
        val p = Pattern.quote(splitter)
        return Regex("(?:^|$p)((?:\"(?:[^\"]+)*\"|'(?:[^']+)*'|[^$p])+)")
    }

    private fun unquote(s: String): String {
        if (s.length > 1 && s[0] == '"' && s[s.length - 1] == '"') {
            return s.substring(1, s.length - 2)
        }
        return s
    }

    private fun parseTime(s: String): DateTime? {
        return Regex("(?<sign>[-+])?(?<n>\\d+(?:\\.\\d+)?)(?<u>[ywdh]|min|mo)?")
                .matchEntire(s)?.let { m ->
                    val sign = m.groups["sign"]?.let { if(it.value == "-") -1 else 1 } ?: 1
                    val duration = (m.groups["u"]?.let { when(it.value) {
                        "y" -> Duration.standardDays(365)
                        "w" -> Duration.standardDays(7)
                        "d" -> Duration.standardDays(1)
                        "min" -> Duration.standardMinutes(1)
                        "mo" -> Duration.standardDays(30)
                        else -> Duration.standardHours(1)
                    } } ?: Duration.standardHours(1))
                            .multipliedBy(m.groups["n"]!!.value.toLong() * sign)

                    DateTime.now().plus(duration)
                } ?: Regex("(?<y>\\d{4})[-/](?<mo>\\d{2})(?:[-/](?<d>\\d{2}))")
                .matchEntire(s)?.let { m ->
                    DateTime(
                            m.groups["y"]!!.value.toInt(),
                            m.groups["mo"]!!.value.toInt(),
                            m.groups["d"]?.value?.toInt() ?: 1,
                            0, 0
                    )
                }
    }
}