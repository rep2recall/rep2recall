package rep2recall.db

import org.jetbrains.exposed.dao.id.IdTable
import org.jetbrains.exposed.sql.*
import rep2recall.api.Api
import java.util.regex.Pattern

abstract class IdInitTable<T:Comparable<T>>(name: String = ""): IdTable<T>(name) {
    open fun init() {}
}

//abstract class InitTable(name: String = ""): Table(name) {
//    open fun init() {}
//}

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
    ): Op<Boolean>? {
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
                            value = ps[1]
                    ))
                    isAppended = true
                }
            }

            if (!isAppended) {
                QuerySplitPart(
                        value = value
                )
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
        }
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
}
