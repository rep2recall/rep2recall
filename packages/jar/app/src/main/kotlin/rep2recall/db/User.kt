package rep2recall.db

import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime
import java.util.*

object UserTable: InitTable("user") {
    val updatedAt = datetime("updated_at").nullable()
    val identifier = text("identifier").uniqueIndex()
}

class User(id: EntityID<UUID>): Entity<UUID>(id) {
    companion object: EntityClass<UUID, User>(UserTable)

    var updatedAt by UserTable.updatedAt
    var identifier by UserTable.identifier
}
