package rep2recall.db

import com.github.salomonbrys.kotson.fromJson
import com.google.gson.Gson
import com.google.gson.JsonObject
import org.jetbrains.exposed.dao.Entity
import org.jetbrains.exposed.dao.EntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.ReferenceOption
import org.jetbrains.exposed.sql.jodatime.datetime
import java.util.*

object PresetTable: InitTable("preset") {
    val updatedAt = datetime("updated_at").nullable()
    val userId = reference(
        "user_id",
        UserTable,
        onDelete = ReferenceOption.CASCADE,
        onUpdate = ReferenceOption.RESTRICT
    )

    val data = text("status")
}

class Preset(id: EntityID<UUID>): Entity<UUID>(id) {
    companion object: EntityClass<UUID, Preset>(PresetTable) {
        val gson = Gson()
    }

    var updatedAt by PresetTable.updatedAt
    var userId by PresetTable.userId

    var data: JsonObject by PresetTable.data.transform(
        { gson.toJson(it) },
        { gson.fromJson(it) }
    )
}
