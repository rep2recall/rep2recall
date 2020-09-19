package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID

object TemplateTable: IdInitTable<String>() {
    override val id = varchar("id", 26).entityId()

    val name = varchar("name", 100).index()
    val description = varchar("description", 1000).nullable()
    val front = varchar("front", 1000)
    val back = varchar("back", 1000).nullable()

    val userId = reference("user_id", UserTable)
}

class Template(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Template>(TemplateTable) {
        override fun new(id: String?, init: Template.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: Template.() -> Unit) = new(null, init)

        fun create(
                name: String,
                description: String? = null,
                front: String,
                back: String? = null,
                user: User,
                id: String? = null
        ): Template {
            return new(id) {
                this.name = name
                this.description = description
                this.front = front
                this.back = back
                this.userId = user.id
            }
        }
    }

    var name by TemplateTable.name
    var description by TemplateTable.description
    var front by TemplateTable.front
    var back by TemplateTable.back

    var userId by TemplateTable.userId
    val user by User referencedOn TemplateTable.userId

    data class Ser(
            val id: String,
            val name: String,
            val description: String?,
            val front: String,
            val back: String?,
            val userId: String
    )

    fun serialize() = Ser(
            id = id.value,
            name = name,
            description = description,
            front = front,
            back = back,
            userId = userId.value
    )
}