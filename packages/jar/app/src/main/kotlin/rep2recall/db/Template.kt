package rep2recall.db

import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.ReferenceOption
import org.jetbrains.exposed.sql.jodatime.datetime
import java.util.*

object TemplateTable: InitTable("template") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference(
        "user_id",
        UserTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.RESTRICT
    )
    val cardId = reference(
        "card_id",
        CardTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.RESTRICT
    )

    val front = text("front")
    val back = text("back").default("")
    val shared = text("shared").default("")
}

class Template(id: EntityID<UUID>): Entity<UUID>(id) {
    companion object: EntityClass<UUID, Template>(TemplateTable)

    var updatedAt by TemplateTable.updatedAt
    var userId by TemplateTable.userId
    var cardId by TemplateTable.cardId
    var front by TemplateTable.front
    var back by TemplateTable.back
    var shared by TemplateTable.shared
}