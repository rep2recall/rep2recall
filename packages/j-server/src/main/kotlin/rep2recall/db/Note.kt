package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.jodatime.datetime

object NoteTable: IdInitTable<String>("note") {
    override val id = QuizTable.varchar("id", 26).entityId()
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference("user_id", UserTable)
}

class Note(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Note>(NoteTable) {
        override fun new(id: String?, init: Note.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: Note.() -> Unit) = new(null, init)

        fun create(
                id: String? = null,
                user: User,
                attrs: List<NoteAttr.Ser>
        ): Note {
            val note = new(id) {
                this.userId = user.id
            }

            attrs.forEach {
                NoteAttr.create(it.key, it.value, note)
            }

            return note
        }
    }

    var updatedAt by NoteTable.updatedAt
    var userId by NoteTable.userId
    val user by User referencedOn NoteTable.userId

    val attrs by NoteAttr via NoteAttrTable

    override fun delete() {
        NoteAttrTable.deleteWhere { NoteAttrTable.noteId eq id }
        super.delete()
    }
}