package rep2recall.db

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID

object NoteAttrTable: IdInitTable<Int>("note_attr") {
    override val id = integer("id").autoIncrement().entityId()
    override val primaryKey by lazy { super.primaryKey ?: PrimaryKey(id) }

    val key = varchar("key", 50)
    val value = varchar("value", 1000)
    val noteId = reference("note_id", NoteTable)

    override fun init() {
        uniqueIndex(key, noteId)
    }
}

class NoteAttr(id: EntityID<Int>): IntEntity(id) {
    companion object: IntEntityClass<NoteAttr>(NoteAttrTable) {
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
    @Suppress("unused")
    val note by Note referencedOn NoteAttrTable.noteId

    data class Ser(
            val key: String,
            val value: String
    )

    fun serialize() = Ser(key, value)
}