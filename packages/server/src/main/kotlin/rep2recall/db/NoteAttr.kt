package rep2recall.db

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable

object NoteAttrTable: IntIdTable() {
    val key = varchar("key", 50)
    val value = varchar("value", 1000)
    val note = reference("note", NoteTable)
}

class NoteAttr(id: EntityID<Int>): IntEntity(id) {
    companion object: IntEntityClass<NoteAttr>(NoteAttrTable) {
        fun init() {
            NoteAttrTable.uniqueIndex(NoteAttrTable.key, NoteAttrTable.note)
        }
    }

    var key by NoteAttrTable.key
    var value by NoteAttrTable.value
    var note by NoteAttrTable.note
}