package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID

object NoteAttrTable: IdInitTable<String>("note_attr") {
    override val id = QuizTable.varchar("id", 26).entityId()

    val key = varchar("key", 50)
    val value = varchar("value", 1000)
    val noteId = reference("note_id", NoteTable)

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
                note: Note
        ): NoteAttr {
            return new {
                this.key = key
                this.value = value
                this.noteId = note.id
            }
        }
    }

    var key by NoteAttrTable.key
    var value by NoteAttrTable.value

    var noteId by NoteAttrTable.noteId
    val note by Note referencedOn NoteAttrTable.noteId

    data class Ser(
            val key: String,
            val value: String
    )
}