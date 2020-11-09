package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime

object TemplateTable: IdInitTable<String>("template") {
    override val id = varchar("id", 26).entityId()
    val updatedAt = datetime("updated_at").nullable()

    val name = varchar("name", 100).index()
    val front = varchar("front", 1000)
    val back = varchar("back", 1000).nullable()
    val shared = varchar("shared", 1000).nullable()

    val userId = reference("user_id", UserTable)

    override fun init() {
        uniqueIndex(name, userId)
    }
}

class Template(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Template>(TemplateTable) {
        override fun new(id: String?, init: Template.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: Template.() -> Unit) = new(null, init)

        fun create(
                name: String,
                front: String,
                back: String? = null,
                shared: String? = null,
                user: User,
                id: String? = null
        ): Template {
            return new(id) {
                this.name = name
                this.front = front
                this.back = back
                this.shared = shared
                this.userId = user.id
            }
        }
    }

    var updatedAt by TemplateTable.updatedAt

    var name by TemplateTable.name
    var front by TemplateTable.front
    var back by TemplateTable.back
    var shared by TemplateTable.shared

    var userId by TemplateTable.userId
    @Suppress("unused")
    val user by User referencedOn TemplateTable.userId
}