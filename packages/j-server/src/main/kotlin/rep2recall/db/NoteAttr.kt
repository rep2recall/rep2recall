package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime

object NoteAttrTable: IdInitTable<String>("note_attr") {
    override val id = QuizTable.varchar("id", 26).entityId()
    val updatedAt = datetime("updated_at").nullable()

    val key = varchar("key", 50)
    val value = varchar("value", 1000)
    val noteId = varchar("note_id", 26)

    override fun init() {
        uniqueIndex(key, noteId)
    }
}

class NoteAttr(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, NoteAttr>(NoteAttrTable) {
        override fun new(id: String?, init: NoteAttr.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: NoteAttr.() -> Unit) = new(null, init)

        fun create(
                key: String,
                value: String,
                noteId: String
        ): NoteAttr {
            return new {
                this.key = key
                this.value = value
                this.noteId = noteId
            }
        }
    }

    var updatedAt by NoteAttrTable.updatedAt

    var key by NoteAttrTable.key
    var value by NoteAttrTable.value

    var noteId by NoteAttrTable.noteId
}