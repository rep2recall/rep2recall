package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IdTable

object NoteTable: IdTable<String>() {
    override val id = varchar("id", 26).default(ULID.random()).entityId()
}

class Note(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Note>(NoteTable)

    val attrs by NoteAttr referrersOn NoteAttrTable.note
}