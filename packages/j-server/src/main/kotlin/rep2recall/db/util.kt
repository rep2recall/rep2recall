package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import com.github.salomonbrys.kotson.fromJson
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonElement
import com.talanlabs.avatargenerator.Avatar
import com.talanlabs.avatargenerator.IdenticonAvatar
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IdTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greater
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNull
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.like
import org.joda.time.DateTime
import org.joda.time.Duration
import java.awt.image.BufferedImage
import java.nio.file.Path
import java.security.SecureRandom
import java.util.*
import java.util.regex.Pattern

val gson: Gson = GsonBuilder()
//        .serializeNulls()
        .create()

val rand = SecureRandom()

fun random64(size: Int): String {
    val ba = ByteArray(size)
    rand.nextBytes(ba)
    return String(Base64.getEncoder().encode(ba))
            .replace(Regex("^=+"), "")
            .replace(Regex("=+$"), "")
}

fun randomFile(suffix: String, path: String): String {
    var filename = "${random64(16).sanitizeFilename()}$suffix"
    while (Path.of(path, filename).toFile().exists()) {
        filename = "${random64(16).sanitizeFilename()}$suffix"
    }

    return filename
}

val avatarBuilder: Avatar = IdenticonAvatar.newAvatarBuilder().build()

fun String.sanitizeFilename(): String? {
    val s = StringBuilder()
    for (c in toCharArray()) {
        if (c == '.' || Character.isJavaIdentifierPart(c)) {
            s.append(c)
        }
    }

    if (s.isEmpty()) {
        return null
    }

    return s.toString()
}

fun String.avatar(): BufferedImage {
    val s = if (isBlank()) random64(16) else this
    var h = 1125899906842597L // prime
    for (c in s.toCharArray()) {
        h = 31*h + c.toLong()
    }

    return avatarBuilder.create(h)
}

abstract class InitTable(name: String = ""): IdTable<String>(name) {
    override val id = varchar("id", 26).entityId()
    open fun init() {}
}

abstract class SerEntity(id: EntityID<String>): Entity<String>(id) {
    abstract fun serialize(): Any
}

abstract class ULIDEntityClass<Entity:SerEntity>(table: InitTable): EntityClass<String, Entity>(table) {
    override fun new(id: String?, init: Entity.() -> Unit) = super.new(id ?: ULID.random(), init)
    override fun new(init: Entity.() -> Unit) = new(null, init)
}

fun SerEntity.filterKey(select: Set<String>) = gson.fromJson<Map<String, JsonElement>>(gson.toJson(serialize()))
        .entries
        .filter { select.contains(it.key) }
        .associate { it.key to it.value }

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
    fun comp(p: QuerySplitPart, c: Column<EntityID<String>?>) = if (p.value == "NULL") c.isNull() else {
//        when(p.op) {
//            "<" -> c less p.value
//            "<=" -> c lessEq p.value
//            ">" -> c greater p.value
//            ">=" -> c greaterEq p.value
//            else -> c eq p.value
//        }
        c eq p.value
    }

    @JvmName("compString")
    fun comp(p: QuerySplitPart, c: Column<String>) = when(p.op) {
        "<" -> c less p.value
        "<=" -> c lessEq p.value
        ">" -> c greater p.value
        ">=" -> c greaterEq p.value
        "~" -> c like p.value
        "=" -> c eq p.value
        else -> c like "%${
            p.value.replace(Regex("[_%]"), "[\$&]")
        }%"
    }

    @JvmName("compStringNullable")
    fun comp(p: QuerySplitPart, c: Column<String?>) = if (p.value == "NULL") c.isNull() else {
        when(p.op) {
            "<" -> c less p.value
            "<=" -> c lessEq p.value
            ">" -> c greater p.value
            ">=" -> c greaterEq p.value
            "~" -> c like p.value
            "=" -> c eq p.value
            else -> c like "%${
                p.value.replace(Regex("[_%]"), "[\$&]")
            }%"

        }
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
        val q = comp(p, NoteAttrTable.value)

        return p.key?.let {
            (NoteAttrTable.key eq unquote(it)) and q
        } ?: (q or comp(p, TagTable.name))
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