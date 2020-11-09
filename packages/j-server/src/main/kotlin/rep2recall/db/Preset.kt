package rep2recall.db

import com.github.guepardoapps.kulid.ULID
import com.github.salomonbrys.kotson.fromJson
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.jodatime.datetime

object PresetTable: IdInitTable<String>("preset") {
    override val id = QuizTable.varchar("id", 26).entityId()
    val updatedAt = datetime("updated_at").nullable()

    val q = varchar("q", 100)
    val name = varchar("name", 50)
    val status = varchar("status", 500)
    val selected = varchar("selected", 5000)
    val opened = varchar("opened", 5000)
}

class Preset(id: EntityID<String>): Entity<String>(id) {
    companion object: EntityClass<String, Preset>(PresetTable) {
        override fun new(id: String?, init: Preset.() -> Unit) = super.new(id ?: ULID.random(), init)
        override fun new(init: Preset.() -> Unit) = new(null, init)

        fun create(
                q: String,
                name: String,
                status: Status,
                selected: List<String>,
                opened: List<String>
        ): Preset {
            return new {
                this.q = q
                this.name = name
                this.status = status
                this.selected = selected
                this.opened = opened
            }
        }
    }

    var updatedAt by PresetTable.updatedAt

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
}