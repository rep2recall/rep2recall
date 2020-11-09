package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime
import org.joda.time.DateTime
import org.joda.time.Duration

object QuizTable: IdInitTable<String>("quiz") {
    override val id = varchar("id", 26).entityId()
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference("user_id", UserTable)

    val noteId = reference("note_id", NoteTable).nullable()
    val templateId = reference("template_id", TemplateTable).nullable()

    val deck = varchar("deck", 200)
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
        uniqueIndex(userId, noteId, templateId)
    }
}

class Quiz(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Quiz>(QuizTable) {
        override fun new(id: String?, init: Quiz.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: Quiz.() -> Unit) = new(null, init)

        fun create(
                user: User,
                note: Note?,
                template: Template?,
                deck: String,
                front: String? = null,
                back: String? = null,
                mnemonic: String? = null,
                srsLevel: Int? = null,
                nextReview: DateTime? = null,
                rightStreak: Int? = null,
                wrongStreak: Int? = null,
                maxRight: Int? = null,
                maxWrong: Int? = null,
                lastRight: DateTime? = null,
                lastWrong: DateTime? = null,
                id: String? = null
        ): Quiz {
            return  new(id) {
                userId = user.id
                noteId = note?.id
                templateId = template?.id
                this.deck = deck
                this.front = front
                this.back = back
                this.mnemonic = mnemonic
                this.srsLevel = srsLevel
                this.nextReview = nextReview
                this.rightStreak = rightStreak
                this.wrongStreak = wrongStreak
                this.maxRight = maxRight
                this.maxWrong = maxWrong
                this.lastRight = lastRight
                this.lastWrong = lastWrong
            }
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

    var updatedAt by QuizTable.updatedAt
    var userId by QuizTable.userId
    val user by User referencedOn QuizTable.userId

    var noteId by QuizTable.noteId

    var templateId by QuizTable.templateId
    val template by Template optionalReferencedOn QuizTable.templateId

    var deck: String by QuizTable.deck
    var front by QuizTable.front
    var back by QuizTable.back
    var mnemonic by QuizTable.mnemonic

    var srsLevel by QuizTable.srsLevel
    var nextReview by QuizTable.nextReview
    var rightStreak by QuizTable.rightStreak
    var wrongStreak by QuizTable.wrongStreak
    var maxRight by QuizTable.maxRight
    var maxWrong by QuizTable.maxWrong
    var lastRight by QuizTable.lastRight
    var lastWrong by QuizTable.lastWrong

    @Suppress("unused")
    fun markRight() = updateSrsLevel(1)
    @Suppress("unused")
    fun markWrong() = updateSrsLevel(-1)
    @Suppress("unused")
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
}