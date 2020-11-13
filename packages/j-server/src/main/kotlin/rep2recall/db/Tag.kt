package rep2recall.db

import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.jodatime.datetime
import org.joda.time.DateTime

object TagTable: InitTable("tag") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference("user_id", UserTable)

    val name = text("name").index()

    override fun init() {
        uniqueIndex(userId, name)
    }
}

class Tag(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<Tag>(TagTable) {
        fun upsert(
                user: User,
                name: String
        ) = Tag.find {
            TagTable.userId eq user.id and (TagTable.name eq name)
        }.firstOrNull()?.let {
            it.updatedAt = DateTime.now()
            it
        } ?: Tag.new {
            userId = user.id
            this.name = name
        }
    }

    var updatedAt by TagTable.updatedAt
    var userId by TagTable.userId
    val user by User referencedOn TagTable.userId

    var name by TagTable.name

    override fun serialize() = name
}