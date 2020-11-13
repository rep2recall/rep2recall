package rep2recall.db

import com.github.salomonbrys.kotson.fromJson
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime

object PresetTable: InitTable("preset") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference("user_id", UserTable)

    val q = text("q")
    val name = text("name")
    val status = jsonb(
            "status",
            { gson.toJson(it) },
            { gson.fromJson<PresetStatus>(it) }
    )
    val selected = text("selected")
    val opened = text("opened")
}

class Preset(id: EntityID<String>): SerEntity(id) {
    companion object: ULIDEntityClass<Preset>(PresetTable) {
        fun create(
                user: User,
                p: PresetSer
        ): Preset {
            return new(p.id) {
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
    var userId by PresetTable.userId
    val user by User referencedOn PresetTable.userId

    var q by PresetTable.q
    var name by PresetTable.name
    var status: PresetStatus by PresetTable.status
    var selected: List<String> by PresetTable.selected.transform(
            { it.joinToString("\u001f") },
            { it.split("\u001f") }
    )
    var opened by PresetTable.opened.transform(
            { it.joinToString("\u001f") },
            { it.split("\u001f") }
    )

    override fun serialize() = PresetSer(
            id.value,
            q, name, status, selected, opened
    )
}

data class PresetSer(
        val id: String? = null,
        val q: String,
        val name: String,
        val status: PresetStatus,
        val selected: List<String>,
        val opened: List<String>
)

data class PresetPartialSer(
        val id: String?,
        val q: String?,
        val name: String?,
        val status: PresetStatus?,
        val selected: List<String>?,
        val opened: List<String>?
)

data class PresetStatus(
        val new: Boolean,
        val due: Boolean,
        val leech: Boolean,
        val graduated: Boolean
)