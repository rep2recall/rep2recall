package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.jodatime.datetime
import org.joda.time.DateTime
import org.joda.time.Duration

object NoteTable: InitTable("note") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference("user_id", UserTable)

    val key = varchar("key", 26).index()

    val deck = varchar("deck", 200).nullable().index()
    val front = varchar("front", 1000).nullable()
    val back = varchar("back", 1000).nullable()
    val mnemonic = varchar("mnemonic", 1000).nullable()

    val srsLevel = integer("srs_level").nullable().index()
    val nextReview = datetime("next_review").nullable().index()
    val rightStreak = integer("right_streak").nullable().index()
    val wrongStreak = integer("wrong_streak").nullable().index()
    val maxRight = integer("max_right").nullable().index()
    val maxWrong = integer("max_wrong").nullable().index()
    val lastRight = datetime("last_right").nullable().index()
    val lastWrong = datetime("last_wrong").nullable().index()

    override fun init() {
        uniqueIndex(userId, key)
    }
}

object NoteTagTable: Table() {
    val noteId = reference("note_id", NoteTable.id)
    val tagId = reference("tag_id", TagTable.id)

    override val primaryKey = PrimaryKey(noteId, tagId)
}

class Note(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<Note>(NoteTable) {
        fun create(
                user: User,
                n: NoteSer
        ): Note {
            val id = ULID.random()
            val note = new(id) {
                this.userId = user.id
                this.key = n.key ?: id
                this.deck = n.deck
                this.front = n.front
                this.back = n.back
                this.mnemonic = n.mnemonic
                this.srsLevel = n.srsLevel
                this.nextReview = n.nextReview?.let { DateTime.parse(it) }
                this.rightStreak = n.rightStreak
                this.wrongStreak = n.wrongStreak
                this.maxRight = n.maxRight
                this.maxWrong = n.maxWrong
                this.lastRight = n.lastRight?.let { DateTime.parse(it) }
                this.lastWrong = n.lastWrong?.let { DateTime.parse(it) }
            }

            n.data.forEach {
                NoteAttr.create(it.key, it.value, note)
            }

            n.tags.forEach {
                Tag.upsert(user, it)
            }

            return note
        }

        val srsMap = listOf(
                Duration.standardHours(1),
                Duration.standardHours(4),
                Duration.standardHours(8),
                Duration.standardDays(1),
                Duration.standardDays(3),
                Duration.standardDays(1 * 7),
                Duration.standardDays(2 * 7),
                Duration.standardDays(4 * 7),
                Duration.standardDays(16 * 7)
        )
    }

    var updatedAt by NoteTable.updatedAt
    var userId by NoteTable.userId
    val user by User referencedOn NoteTable.userId

    var key by NoteTable.key

    var deck by NoteTable.deck
    var front by NoteTable.front
    var back by NoteTable.back
    var mnemonic by NoteTable.mnemonic

    var srsLevel by NoteTable.srsLevel
    var nextReview by NoteTable.nextReview
    var rightStreak by NoteTable.rightStreak
    var wrongStreak by NoteTable.wrongStreak
    var maxRight by NoteTable.maxRight
    var maxWrong by NoteTable.maxWrong
    var lastRight by NoteTable.lastRight
    var lastWrong by NoteTable.lastWrong

    val data by NoteAttr via NoteAttrTable
    var tags by Tag via NoteTagTable

    override fun delete() {
        NoteAttrTable.deleteWhere { NoteAttrTable.noteId eq id }
        super.delete()
    }

    fun markRight() = updateSrsLevel(1)
    fun markWrong() = updateSrsLevel(-1)
    fun markRepeat() = updateSrsLevel(0)

    private fun updateSrsLevel(dSrsLevel: Int) {
        updatedAt = DateTime.now()

        rightStreak = rightStreak ?: 0
        wrongStreak = wrongStreak ?: 0
        maxRight = maxRight ?: 0
        maxWrong = maxWrong ?: 0

        if (dSrsLevel > 0) {
            rightStreak = rightStreak!! + 1
            wrongStreak = 0
            lastRight = DateTime.now()

            if (rightStreak!! > maxRight!!) {
                maxRight = rightStreak
            }
        } else if (dSrsLevel < 0) {
            wrongStreak = wrongStreak!! + 1
            rightStreak = 0
            lastWrong = DateTime.now()

            if (wrongStreak!! > maxWrong!!) {
                maxWrong = wrongStreak
            }
        }

        srsLevel = (srsLevel ?: 0) + dSrsLevel

        if (srsLevel!! >= srsMap.size) {
            srsLevel = srsMap.size - 1
        }

        if (srsLevel!! < 0) {
            srsLevel = 0
        }

        nextReview = if (dSrsLevel > 0) {
            DateTime.now()
                    .plus(srsMap.elementAtOrElse(srsLevel!!) { Duration.standardHours(4) })
        } else {
            DateTime.now()
                    .plus(Duration.standardHours(1))
        }
    }

    override fun serialize() = NoteSer(
            nextReview = nextReview?.toString(),
            lastRight = lastRight?.toString(),
            lastWrong = lastWrong?.toString(),

            id = id.value,
            key = key,
            deck = deck,
            front = front,
            back = back,
            mnemonic = mnemonic,
            srsLevel = srsLevel,
            rightStreak = rightStreak,
            wrongStreak = wrongStreak,
            maxRight = maxRight,
            maxWrong = maxWrong,
            data = data.sortedBy { it.id }.map { it.serialize() },
            tags = tags.sortedBy { it.id }.map { it.serialize() }
    )
}

data class NoteSer(
        val nextReview: String? = null,
        val lastRight: String? = null,
        val lastWrong: String? = null,

        val id: String? = null,
        val key: String? = null,
        val deck: String? = null,
        val front: String? = null,
        val back: String? = null,
        val mnemonic: String? = null,
        val srsLevel: Int? = null,
        val rightStreak: Int? = null,
        val wrongStreak: Int? = null,
        val maxRight: Int? = null,
        val maxWrong: Int? = null,
        val data: List<NoteAttrSer> = listOf(),
        val tags: List<String> = listOf()
)

data class NotePartialSer(
        val nextReview: String? = null,
        val lastRight: String? = null,
        val lastWrong: String? = null,

        val id: String? = null,
        val key: String? = null,
        val deck: String? = null,
        val front: String? = null,
        val back: String? = null,
        val mnemonic: String? = null,
        val srsLevel: Int? = null,
        val rightStreak: Int? = null,
        val wrongStreak: Int? = null,
        val maxRight: Int? = null,
        val maxWrong: Int? = null,
        val data: List<NoteAttrSer>? = null,
        val tags: List<String>? = null
)