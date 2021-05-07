package rep2recall.db

import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.ReferenceOption
import org.jetbrains.exposed.sql.jodatime.datetime
import org.joda.time.DateTime
import org.joda.time.Duration
import java.util.*

object CardTable: InitTable("card") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference(
        "user_id",
        UserTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.RESTRICT
    )
    val noteId = reference(
        "note_id",
        NoteTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.RESTRICT
    )

    val deck = text("deck").nullable().index()
    val front = text("front").nullable()
    val back = text("back").nullable()
    val mnemonic = text("mnemonic").nullable()

    val srsLevel = integer("srs_level").nullable().index()
    val nextReview = datetime("next_review").nullable().index()
    val rightStreak = integer("right_streak").nullable().index()
    val wrongStreak = integer("wrong_streak").nullable().index()
    val maxRight = integer("max_right").nullable().index()
    val maxWrong = integer("max_wrong").nullable().index()
    val lastRight = datetime("last_right").nullable().index()
    val lastWrong = datetime("last_wrong").nullable().index()
}

class Card(id: EntityID<UUID>): Entity<UUID>(id) {
    companion object: EntityClass<UUID, Note>(NoteTable) {
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

    var updatedAt by CardTable.updatedAt
    var userId by CardTable.userId
    var noteId by CardTable.noteId

    var deck by CardTable.deck
    var front by CardTable.front
    var back by CardTable.back
    var mnemonic by CardTable.mnemonic

    var srsLevel by CardTable.srsLevel
    var nextReview by CardTable.nextReview
    var rightStreak by CardTable.rightStreak
    var wrongStreak by CardTable.wrongStreak
    var maxRight by CardTable.maxRight
    var maxWrong by CardTable.maxWrong
    var lastRight by CardTable.lastRight
    var lastWrong by CardTable.lastWrong

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
}
