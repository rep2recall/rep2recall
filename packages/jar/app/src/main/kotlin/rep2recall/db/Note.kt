package rep2recall.db

import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.ReferenceOption
import org.jetbrains.exposed.sql.jodatime.datetime
import java.util.*

object NoteTable: InitTable("note") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference(
        "user_id",
        UserTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.RESTRICT
    )
}

class Note(id: EntityID<UUID>): Entity<UUID>(id) {
    companion object: EntityClass<UUID, Note>(NoteTable)

    var updatedAt by NoteTable.updatedAt
    var userId by NoteTable.userId
}
