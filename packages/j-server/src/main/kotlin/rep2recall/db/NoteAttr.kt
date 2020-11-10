package rep2recall.db

import org.jetbrains.exposed.dao.id.EntityID

object NoteAttrTable: InitTable("note_attr") {
    val key = varchar("key", 50)
    val value = varchar("value", 1000)
    val noteId = reference("note_id", NoteTable)

    override fun init() {
        uniqueIndex(key, noteId)
    }
}

class NoteAttr(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<NoteAttr>(NoteAttrTable) {
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

    override fun serialize() = Ser(key, value)
}