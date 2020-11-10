package rep2recall.db

import com.github.salomonbrys.kotson.fromJson
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime

object PresetTable: InitTable("preset") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference("user_id", UserTable)

    val q = varchar("q", 100)
    val name = varchar("name", 50)
    val status = varchar("status", 500)
    val selected = varchar("selected", 5000)
    val opened = varchar("opened", 5000)
}

class Preset(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<Preset>(PresetTable) {
        fun create(
                user: User,
                p: Ser
        ): Preset {
            return new {
                this.userId = user.id
                this.q = p.q
                this.name = p.name
                this.status = p.status
                this.selected = p.selected
                this.opened = p.opened
            }
        }
    }

    var updatedAt by PresetTable.updatedAt
    var userId by NoteTable.userId
    val user by User referencedOn NoteTable.userId

    data class Status(
            val new: Boolean,
            val due: Boolean,
            val leech: Boolean,
            val graduated: Boolean
    )

    var q by PresetTable.q
    var name by PresetTable.name
    var status: Status by PresetTable.status.transform(
            { gson.toJson(it) },
            { gson.fromJson<Status>(it) }
    )
    var selected: List<String> by PresetTable.selected.transform(
            { it.joinToString("\u001f") },
            { it.split("\u001f") }
    )
    var opened by PresetTable.opened.transform(
            { it.joinToString("\u001f") },
            { it.split("\u001f") }
    )

    data class Ser(
            val id: String,
            val q: String,
            val name: String,
            val status: Status,
            val selected: List<String>,
            val opened: List<String>
    )

    override fun serialize() = Ser(
            id.value,
            q, name, status, selected, opened
    )
}