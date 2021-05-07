package rep2recall.db

import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.ReferenceOption
import java.util.*

object NoteAttrTable: InitTable("note_attr") {
    val key = text("key")
    val value = text("value")
    val noteId = reference(
        "note_id",
        NoteTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.CASCADE
    )

    override fun init() {
        uniqueIndex(key, noteId)
    }
}

class NoteAttr(id: EntityID<UUID>): Entity<UUID>(id) {
    companion object: EntityClass<UUID, NoteAttr>(NoteAttrTable) {
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
}
